import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSerpApiAdapter } from '../../src/providers/serpapi.js';
import { AnySerpError } from '../../src/types.js';

describe('SerpAPI adapter', () => {
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

  it('has name "serpapi"', () => {
    expect(createSerpApiAdapter('k').name).toBe('serpapi');
  });

  it('supports all search types', () => {
    const a = createSerpApiAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET to serpapi.com with api_key and engine', async () => {
    mockFetch({ organic_results: [] });
    const a = createSerpApiAdapter('my-key');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://serpapi.com');
    expect(url.pathname).toBe('/search.json');
    expect(url.searchParams.get('api_key')).toBe('my-key');
    expect(url.searchParams.get('engine')).toBe('google');
    expect(url.searchParams.get('q')).toBe('hello');
    expect(url.searchParams.get('output')).toBe('json');
  });

  it('sets engine for image search', async () => {
    mockFetch({ images_results: [] });
    const a = createSerpApiAdapter('k');
    await a.search({ query: 'cats', type: 'images' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('engine')).toBe('google_images');
  });

  it('sets engine for news search', async () => {
    mockFetch({ news_results: [] });
    const a = createSerpApiAdapter('k');
    await a.search({ query: 'news', type: 'news' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('engine')).toBe('google_news');
  });

  it('sets engine for video search', async () => {
    mockFetch({ video_results: [] });
    const a = createSerpApiAdapter('k');
    await a.search({ query: 'videos', type: 'videos' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('engine')).toBe('google_videos');
  });

  it('passes all query parameters', async () => {
    mockFetch({ organic_results: [] });
    const a = createSerpApiAdapter('k');
    await a.search({
      query: 'test',
      num: 15,
      page: 3,
      country: 'us',
      language: 'en',
      safe: true,
      dateRange: 'month',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('num')).toBe('15');
    expect(url.searchParams.get('start')).toBe('30'); // (3-1) * 15
    expect(url.searchParams.get('gl')).toBe('us');
    expect(url.searchParams.get('hl')).toBe('en');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('tbs')).toBe('qdr:m');
  });

  it('calculates start offset with default num', async () => {
    mockFetch({ organic_results: [] });
    const a = createSerpApiAdapter('k');
    await a.search({ query: 'test', page: 2 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('start')).toBe('10'); // (2-1) * 10
  });

  // ─── Response normalization: web ────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      organic_results: [{
        position: 1,
        title: 'First',
        link: 'https://first.com',
        snippet: 'First result',
        displayed_link: 'first.com',
        date: '2024-01-01',
        thumbnail: 'https://thumb.com/1.jpg',
      }],
      search_information: {
        total_results: 1000,
        time_taken_displayed: '0.45',
      },
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.provider).toBe('serpapi');
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'First',
      url: 'https://first.com',
      description: 'First result',
      domain: 'first.com',
      datePublished: '2024-01-01',
      thumbnail: 'https://thumb.com/1.jpg',
    });
    expect(res.totalResults).toBe(1000);
    expect(res.searchTime).toBe(450);
  });

  // ─── Response normalization: images ─────────────────────────────────

  it('normalizes image results', async () => {
    mockFetch({
      images_results: [{
        position: 1,
        title: 'Cat',
        link: 'https://img.com/cat',
        snippet: 'A cat',
        original: 'https://img.com/cat_full.jpg',
        original_width: 1920,
        original_height: 1080,
        thumbnail: 'https://img.com/cat_thumb.jpg',
        source: 'imgsite.com',
      }],
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });

    expect(res.results[0]).toMatchObject({
      imageUrl: 'https://img.com/cat_full.jpg',
      imageWidth: 1920,
      imageHeight: 1080,
      thumbnail: 'https://img.com/cat_thumb.jpg',
      source: 'imgsite.com',
    });
  });

  // ─── Response normalization: news ───────────────────────────────────

  it('normalizes news results with nested source', async () => {
    mockFetch({
      news_results: [{
        position: 1,
        title: 'Headline',
        link: 'https://news.com/1',
        snippet: 'News snippet',
        source: { name: 'Reuters' },
        date: '2 hours ago',
        thumbnail: 'https://news.com/img.jpg',
      }],
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'headlines', type: 'news' });
    expect(res.results[0].source).toBe('Reuters');
  });

  // ─── Response normalization: videos ─────────────────────────────────

  it('normalizes video results', async () => {
    mockFetch({
      video_results: [{
        position: 1,
        title: 'Video Title',
        link: 'https://youtube.com/1',
        snippet: 'Video desc',
        duration: '5:30',
        channel: { name: 'MyChannel' },
        thumbnail: { static: 'https://thumb.jpg' },
        date: '1 day ago',
      }],
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'videos', type: 'videos' });

    expect(res.results[0]).toMatchObject({
      duration: '5:30',
      channel: 'MyChannel',
      thumbnail: 'https://thumb.jpg',
      datePublished: '1 day ago',
    });
  });

  // ─── Enrichments ────────────────────────────────────────────────────

  it('maps related_questions to peopleAlsoAsk', async () => {
    mockFetch({
      organic_results: [],
      related_questions: [{ question: 'Why?', snippet: 'Because', title: 'T', link: 'https://q.com' }],
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk![0].question).toBe('Why?');
  });

  it('maps knowledge_graph to knowledgePanel', async () => {
    mockFetch({
      organic_results: [],
      knowledge_graph: {
        title: 'Apple Inc.',
        type: 'Corporation',
        description: 'Tech company',
        source: { name: 'Wikipedia', link: 'https://wiki.org' },
        header_images: [{ image: 'https://img.com/apple.jpg' }],
      },
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'apple' });

    expect(res.knowledgePanel).toMatchObject({
      title: 'Apple Inc.',
      type: 'Corporation',
      source: 'Wikipedia',
      sourceUrl: 'https://wiki.org',
      imageUrl: 'https://img.com/apple.jpg',
    });
  });

  it('maps answer_box to answerBox', async () => {
    mockFetch({
      organic_results: [],
      answer_box: { snippet: '42', title: 'Answer', link: 'https://a.com' },
    });

    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.answerBox!.snippet).toBe('42');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: 'Invalid API key' }, 401);
    const a = createSerpApiAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      const e = err as AnySerpError;
      expect(e.code).toBe(401);
      expect(e.message).toBe('Invalid API key');
      expect(e.metadata.provider_name).toBe('serpapi');
    }
  });

  it('handles empty results', async () => {
    mockFetch({ organic_results: [] });
    const a = createSerpApiAdapter('k');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });
});
