import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSearchApiAdapter } from '../../src/providers/searchapi.js';
import { AnySerpError } from '../../src/types.js';

describe('SearchAPI adapter', () => {
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

  it('has name "searchapi"', () => {
    expect(createSearchApiAdapter('k').name).toBe('searchapi');
  });

  it('supports all search types including places', () => {
    const a = createSearchApiAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
    expect(a.supportsType('places')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET with Bearer auth and engine param', async () => {
    mockFetch({ organic_results: [] });
    const a = createSearchApiAdapter('my-key');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://www.searchapi.io');
    expect(url.searchParams.get('engine')).toBe('google');
    expect(url.searchParams.get('q')).toBe('hello');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-key');
  });

  it('sets engine per search type', async () => {
    const engines = [
      { type: 'images' as const, engine: 'google_images' },
      { type: 'news' as const, engine: 'google_news' },
      { type: 'videos' as const, engine: 'google_videos' },
    ];

    for (const { type, engine } of engines) {
      mockFetch({ organic_results: [] });
      const a = createSearchApiAdapter('k');
      await a.search({ query: 'test', type });
      const url = new URL(fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string);
      expect(url.searchParams.get('engine')).toBe(engine);
    }
  });

  it('passes all query parameters', async () => {
    mockFetch({ organic_results: [] });
    const a = createSearchApiAdapter('k');
    await a.search({
      query: 'test',
      num: 20,
      page: 3,
      country: 'us',
      language: 'en',
      safe: true,
      dateRange: 'week',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('num')).toBe('20');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('gl')).toBe('us');
    expect(url.searchParams.get('hl')).toBe('en');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('time_period')).toBe('last_week');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      organic_results: [{
        title: 'Result',
        link: 'https://r.com',
        snippet: 'Description',
        displayed_link: 'r.com',
        date: '2024-01-01',
        thumbnail: 'https://thumb.jpg',
      }],
      search_information: {
        total_results: 5000,
        time_taken_displayed: '0.32',
      },
      related_searches: [{ query: 'related' }],
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Result',
      url: 'https://r.com',
      description: 'Description',
    });
    expect(res.totalResults).toBe(5000);
    expect(res.searchTime).toBe(320);
    expect(res.relatedSearches).toEqual(['related']);
  });

  it('normalizes image results', async () => {
    mockFetch({
      images: [{
        title: 'Cat',
        link: 'https://img.com/cat',
        snippet: 'A cat',
        original: 'https://img.com/cat.jpg',
        original_width: 1920,
        original_height: 1080,
        thumbnail: 'https://thumb.jpg',
        source: 'ImgSite',
      }],
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });

    expect(res.results[0]).toMatchObject({
      imageUrl: 'https://img.com/cat.jpg',
      imageWidth: 1920,
      imageHeight: 1080,
    });
  });

  it('normalizes news results', async () => {
    mockFetch({
      news_results: [{
        title: 'Headline',
        link: 'https://news.com/1',
        snippet: 'Breaking',
        source: { name: 'Reuters' },
        date: '2024-03-01',
        thumbnail: 'https://img.jpg',
      }],
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });
    expect(res.results[0].source).toBe('Reuters');
  });

  it('normalizes video results', async () => {
    mockFetch({
      video_results: [{
        title: 'Tutorial',
        link: 'https://yt.com/1',
        snippet: 'Learn',
        duration: '10:30',
        channel: { name: 'TechCh' },
        thumbnail: 'https://thumb.jpg',
        date: '2024-02-01',
      }],
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'tutorial', type: 'videos' });
    expect(res.results[0].channel).toBe('TechCh');
    expect(res.results[0].duration).toBe('10:30');
  });

  // ─── Enrichments ────────────────────────────────────────────────────

  it('maps peopleAlsoAsk', async () => {
    mockFetch({
      organic_results: [],
      people_also_ask: [{ question: 'Why?', snippet: 'Because', title: 'T', link: 'https://q.com' }],
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk![0].question).toBe('Why?');
  });

  it('maps knowledgePanel', async () => {
    mockFetch({
      organic_results: [],
      knowledge_graph: {
        title: 'Entity',
        type: 'Org',
        description: 'Desc',
        source: { name: 'Wiki', link: 'https://wiki.org' },
        image: 'https://img.jpg',
      },
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'entity' });
    expect(res.knowledgePanel!.source).toBe('Wiki');
    expect(res.knowledgePanel!.sourceUrl).toBe('https://wiki.org');
  });

  it('maps answerBox', async () => {
    mockFetch({
      organic_results: [],
      answer_box: { snippet: '42', title: 'Answer', link: 'https://a.com' },
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.answerBox!.snippet).toBe('42');
  });

  // ─── AI Overview ────────────────────────────────────────────────────

  it('exposes page token when AI overview not requested', async () => {
    mockFetch({
      organic_results: [],
      ai_overview: { page_token: 'token123' },
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.aiOverview).toBeDefined();
    expect(res.aiOverview!.pageToken).toBe('token123');
    expect(res.aiOverview!.textBlocks).toEqual([]);
  });

  it('fetches full AI overview when includeAiOverview is true', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        markdown: '# AI Answer',
        text_blocks: [{
          type: 'paragraph',
          answer: 'The answer is...',
          answer_highlight: 'answer',
          reference_indexes: [0],
        }],
        reference_links: [{
          index: 0,
          title: 'Source',
          link: 'https://source.com',
          snippet: 'From source',
          date: '2024-01-01',
          source: 'SourceSite',
          thumbnail: 'https://thumb.jpg',
        }],
      }), { status: 200 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });

    expect(res.aiOverview).toBeDefined();
    expect(res.aiOverview!.markdown).toBe('# AI Answer');
    expect(res.aiOverview!.textBlocks).toHaveLength(1);
    expect(res.aiOverview!.textBlocks[0].answer).toBe('The answer is...');
    expect(res.aiOverview!.textBlocks[0].referenceIndexes).toEqual([0]);
    expect(res.aiOverview!.references).toHaveLength(1);
    expect(res.aiOverview!.references[0].url).toBe('https://source.com');
  });

  it('handles AI overview fetch failure gracefully', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response('fail', { status: 500 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });
    // Should not throw, AI overview just won't be present
    expect(res.provider).toBe('searchapi');
  });

  it('maps nested list items in AI overview text blocks', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        text_blocks: [{
          type: 'ordered_list',
          items: [
            { type: 'paragraph', answer: 'Item 1' },
            { type: 'paragraph', answer: 'Item 2' },
          ],
        }],
        reference_links: [],
      }), { status: 200 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });

    expect(res.aiOverview!.textBlocks[0].type).toBe('ordered_list');
    expect(res.aiOverview!.textBlocks[0].items).toHaveLength(2);
  });

  it('maps table type in AI overview', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        text_blocks: [{
          type: 'table',
          table: { headers: ['A', 'B'], rows: [['1', '2']] },
        }],
        reference_links: [],
      }), { status: 200 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });
    expect(res.aiOverview!.textBlocks[0].table).toEqual({
      headers: ['A', 'B'],
      rows: [['1', '2']],
    });
  });

  it('maps code_blocks type in AI overview', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        text_blocks: [{
          type: 'code_blocks',
          language: 'javascript',
          code: 'console.log("hi")',
        }],
        reference_links: [],
      }), { status: 200 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });
    expect(res.aiOverview!.textBlocks[0].language).toBe('javascript');
    expect(res.aiOverview!.textBlocks[0].code).toBe('console.log("hi")');
  });

  it('maps video type in AI overview', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          organic_results: [],
          ai_overview: { page_token: 'tok' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        text_blocks: [{
          type: 'video',
          title: 'My Video',
          link: 'https://yt.com/1',
          duration: '5:00',
          source: 'YouTube',
          channel: 'MyCh',
        }],
        reference_links: [],
      }), { status: 200 });
    });

    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'test', includeAiOverview: true });
    expect(res.aiOverview!.textBlocks[0].video).toMatchObject({
      title: 'My Video',
      link: 'https://yt.com/1',
      duration: '5:00',
      channel: 'MyCh',
    });
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: 'Invalid key' }, 401);
    const a = createSearchApiAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).metadata.provider_name).toBe('searchapi');
    }
  });

  // ─── Places ─────────────────────────────────────────────────────────

  it('sets engine=google_maps for places search', async () => {
    mockFetch({ local_results: [] });
    const a = createSearchApiAdapter('k');
    await a.search({ query: 'tacos', type: 'places' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('engine')).toBe('google_maps');
  });

  it('maps local_results to SearchResult with places fields', async () => {
    mockFetch({
      local_results: [{
        title: 'Taqueria El Farolito',
        website: 'https://elfaro.com',
        address: '2950 24th St, San Francisco, CA',
        phone: '+1 415-641-0758',
        rating: 4.5,
        reviews: 1200,
        type: 'Mexican restaurant',
        hours: 'Open ⋅ Closes 2 AM',
        thumbnail: 'https://example.com/taco.jpg',
        gps_coordinates: { latitude: 37.7527, longitude: -122.4153 },
      }],
    });
    const a = createSearchApiAdapter('k');
    const res = await a.search({ query: 'tacos', type: 'places' });

    expect(res.results).toHaveLength(1);
    const r = res.results[0];
    expect(r.title).toBe('Taqueria El Farolito');
    expect(r.url).toBe('https://elfaro.com');
    expect(r.address).toBe('2950 24th St, San Francisco, CA');
    expect(r.phone).toBe('+1 415-641-0758');
    expect(r.rating).toBe(4.5);
    expect(r.reviewCount).toBe(1200);
    expect(r.placeType).toBe('Mexican restaurant');
    expect(r.hours).toBe('Open ⋅ Closes 2 AM');
    expect(r.coordinates).toEqual({ lat: 37.7527, lng: -122.4153 });
  });
});
