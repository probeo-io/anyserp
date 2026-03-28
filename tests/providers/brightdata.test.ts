import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrightDataAdapter } from '../../src/providers/brightdata.js';
import { AnySerpError } from '../../src/types.js';

describe('Bright Data adapter', () => {
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

  it('has name "brightdata"', () => {
    expect(createBrightDataAdapter('k').name).toBe('brightdata');
  });

  it('supports all search types', () => {
    const a = createBrightDataAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends POST with Bearer auth and constructed Google URL', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('my-token');
    await a.search({ query: 'hello' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.brightdata.com/request');
    expect(opts?.method).toBe('POST');

    const headers = opts?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');

    const body = JSON.parse(opts?.body as string);
    expect(body.zone).toBe('serp');
    expect(body.format).toBe('raw');
    expect(body.url).toContain('https://www.google.com/search?');
    expect(body.url).toContain('q=hello');
    expect(body.url).toContain('brd_json=1');
  });

  it('sets tbm=isch for image search', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('k');
    await a.search({ query: 'cats', type: 'images' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.url).toContain('tbm=isch');
  });

  it('sets tbm=nws for news search', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('k');
    await a.search({ query: 'headlines', type: 'news' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.url).toContain('tbm=nws');
  });

  it('sets tbm=vid for video search', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('k');
    await a.search({ query: 'tutorials', type: 'videos' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.url).toContain('tbm=vid');
  });

  it('includes gl, hl, num, start, safe in constructed URL', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('k');
    await a.search({
      query: 'test',
      num: 20,
      page: 3,
      country: 'gb',
      language: 'en',
      safe: true,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    const searchUrl = new URL(body.url);
    expect(searchUrl.searchParams.get('gl')).toBe('gb');
    expect(searchUrl.searchParams.get('hl')).toBe('en');
    expect(searchUrl.searchParams.get('num')).toBe('20');
    expect(searchUrl.searchParams.get('start')).toBe('40');
    expect(searchUrl.searchParams.get('safe')).toBe('active');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      organic: [
        { title: 'R1', link: 'https://r1.com', description: 'D1', display_link: 'r1.com' },
      ],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.provider).toBe('brightdata');
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'R1',
      url: 'https://r1.com',
      description: 'D1',
      domain: 'r1.com',
    });
  });

  it('normalizes image results', async () => {
    mockFetch({
      organic: [{
        title: 'Cat',
        link: 'https://img.com/cat.jpg',
        description: 'A cat',
        original: 'https://img.com/cat_full.jpg',
        thumbnail: 'https://thumb.jpg',
        display_link: 'img.com',
      }],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });
    expect(res.results[0].imageUrl).toBe('https://img.com/cat_full.jpg');
  });

  it('normalizes news results', async () => {
    mockFetch({
      organic: [{
        title: 'News',
        link: 'https://news.com/1',
        description: 'Breaking',
        display_link: 'news.com',
        date: '2024-03-01',
      }],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });
    expect(res.results[0].source).toBe('news.com');
    expect(res.results[0].datePublished).toBe('2024-03-01');
  });

  it('normalizes video results', async () => {
    mockFetch({
      organic: [{
        title: 'Video',
        link: 'https://yt.com/1',
        description: 'A video',
        thumbnail: 'https://thumb.jpg',
        duration: '5:00',
      }],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'vid', type: 'videos' });
    expect(res.results[0].duration).toBe('5:00');
  });

  // ─── Enrichments ────────────────────────────────────────────────────

  it('maps knowledge_panel', async () => {
    mockFetch({
      organic: [],
      knowledge_panel: {
        title: 'Entity',
        type: 'Org',
        description: 'Desc',
        image: 'https://img.jpg',
      },
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'entity' });
    expect(res.knowledgePanel!.title).toBe('Entity');
  });

  it('maps peopleAlsoAsk', async () => {
    mockFetch({
      organic: [],
      people_also_ask: [{ question: 'Why?', snippet: 'Because', link: 'https://q.com' }],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk).toHaveLength(1);
    expect(res.peopleAlsoAsk![0].url).toBe('https://q.com');
  });

  it('maps relatedSearches as strings', async () => {
    mockFetch({
      organic: [],
      related_searches: ['term1', 'term2'],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.relatedSearches).toEqual(['term1', 'term2']);
  });

  it('maps relatedSearches as objects', async () => {
    mockFetch({
      organic: [],
      related_searches: [{ query: 'term1' }, { title: 'term2' }],
    });

    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.relatedSearches).toEqual(['term1', 'term2']);
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ message: 'Forbidden' }, 403);
    const a = createBrightDataAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).metadata.provider_name).toBe('brightdata');
    }
  });

  it('handles empty organic array', async () => {
    mockFetch({ organic: [] });
    const a = createBrightDataAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.results).toEqual([]);
  });
});
