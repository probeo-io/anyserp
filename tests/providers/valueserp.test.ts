import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createValueSerpAdapter } from '../../src/providers/valueserp.js';
import { AnySerpError } from '../../src/types.js';

describe('ValueSERP adapter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockFetch(body: unknown, status = 200): void {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), { status }),
    );
  }

  it('has name "valueserp"', () => {
    expect(createValueSerpAdapter('k').name).toBe('valueserp');
  });

  it('supports all search types', () => {
    const a = createValueSerpAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET with api_key and search_type params', async () => {
    mockFetch({ organic_results: [] });
    const a = createValueSerpAdapter('my-key');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://api.valueserp.com');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('api_key')).toBe('my-key');
    expect(url.searchParams.get('q')).toBe('hello');
    expect(url.searchParams.get('search_type')).toBe('web');
    expect(url.searchParams.get('output')).toBe('json');
  });

  it('sets search_type for each type', async () => {
    const types = [
      { type: 'images' as const, searchType: 'images' },
      { type: 'news' as const, searchType: 'news' },
      { type: 'videos' as const, searchType: 'videos' },
    ];

    for (const { type, searchType } of types) {
      mockFetch({ organic_results: [] });
      const a = createValueSerpAdapter('k');
      await a.search({ query: 'test', type });
      const url = new URL(fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string);
      expect(url.searchParams.get('search_type')).toBe(searchType);
    }
  });

  it('passes all query parameters', async () => {
    mockFetch({ organic_results: [] });
    const a = createValueSerpAdapter('k');
    await a.search({
      query: 'test',
      num: 20,
      page: 3,
      country: 'gb',
      language: 'en',
      safe: true,
      dateRange: 'year',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('num')).toBe('20');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('gl')).toBe('gb');
    expect(url.searchParams.get('hl')).toBe('en');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('time_period')).toBe('last_year');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      organic_results: [
        { title: 'R1', link: 'https://r1.com', snippet: 'D1', domain: 'r1.com', date: '2024-01-01' },
      ],
      search_information: { total_results: 3000, time_taken_displayed: '0.5' },
      related_searches: [{ query: 'rel' }],
    });

    const a = createValueSerpAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'R1',
      url: 'https://r1.com',
    });
    expect(res.totalResults).toBe(3000);
    expect(res.searchTime).toBe(500);
    expect(res.relatedSearches).toEqual(['rel']);
  });

  it('normalizes image results', async () => {
    mockFetch({
      image_results: [{
        title: 'Img',
        link: 'https://img.com/1',
        original: 'https://img.com/1_full.jpg',
        original_width: 800,
        original_height: 600,
        thumbnail: 'https://thumb.jpg',
        source: 'ImgSite',
      }],
    });

    const a = createValueSerpAdapter('k');
    const res = await a.search({ query: 'img', type: 'images' });
    expect(res.results[0].imageUrl).toBe('https://img.com/1_full.jpg');
    expect(res.results[0].description).toBe('Img'); // uses title as desc
  });

  it('normalizes news results', async () => {
    mockFetch({
      news_results: [{
        title: 'News',
        link: 'https://news.com/1',
        snippet: 'Breaking',
        source: 'Reuters',
        date: '2024-03-01',
        thumbnail: 'https://img.jpg',
      }],
    });

    const a = createValueSerpAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });
    expect(res.results[0].source).toBe('Reuters');
  });

  it('normalizes video results', async () => {
    mockFetch({
      video_results: [{
        title: 'Vid',
        link: 'https://yt.com/1',
        snippet: 'A video',
        duration: '5:00',
        channel: 'MyCh',
        thumbnail: 'https://thumb.jpg',
        date: '2024-02-01',
      }],
    });

    const a = createValueSerpAdapter('k');
    const res = await a.search({ query: 'vid', type: 'videos' });
    expect(res.results[0].channel).toBe('MyCh');
    expect(res.results[0].duration).toBe('5:00');
  });

  // ─── Enrichments ────────────────────────────────────────────────────

  it('maps peopleAlsoAsk, knowledgePanel, answerBox', async () => {
    mockFetch({
      organic_results: [],
      people_also_ask: [{ question: 'Why?', snippet: 'Because' }],
      knowledge_graph: {
        title: 'Entity',
        type: 'Org',
        description: 'Desc',
        source: { name: 'Wiki', link: 'https://wiki.org' },
        image: 'https://img.jpg',
      },
      answer_box: { snippet: '42', title: 'Answer', link: 'https://a.com' },
    });

    const a = createValueSerpAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.peopleAlsoAsk).toHaveLength(1);
    expect(res.knowledgePanel!.title).toBe('Entity');
    expect(res.answerBox!.snippet).toBe('42');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: 'Invalid key' }, 401);
    const a = createValueSerpAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).metadata.provider_name).toBe('valueserp');
    }
  });
});
