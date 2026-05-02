import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSerperAdapter } from '../../src/providers/serper.js';
import { AnySerpError } from '../../src/types.js';

describe('Serper adapter', () => {
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

  it('has name "serper"', () => {
    const adapter = createSerperAdapter('test-key');
    expect(adapter.name).toBe('serper');
  });

  it('supports all search types including places', () => {
    const adapter = createSerperAdapter('test-key');
    expect(adapter.supportsType('web')).toBe(true);
    expect(adapter.supportsType('images')).toBe(true);
    expect(adapter.supportsType('news')).toBe(true);
    expect(adapter.supportsType('videos')).toBe(true);
    expect(adapter.supportsType('places')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends POST to correct endpoint with API key header', async () => {
    mockFetch({ organic: [] });
    const adapter = createSerperAdapter('my-key');
    await adapter.search({ query: 'hello' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://google.serper.dev/search');
    expect(opts?.method).toBe('POST');
    expect(opts?.headers).toMatchObject({ 'X-API-KEY': 'my-key' });
  });

  it('uses /images endpoint for image search', async () => {
    mockFetch({ images: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({ query: 'cats', type: 'images' });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://google.serper.dev/images');
  });

  it('uses /news endpoint for news search', async () => {
    mockFetch({ news: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({ query: 'headlines', type: 'news' });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://google.serper.dev/news');
  });

  it('uses /videos endpoint for video search', async () => {
    mockFetch({ videos: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({ query: 'tutorials', type: 'videos' });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://google.serper.dev/videos');
  });

  it('sends query parameters in body', async () => {
    mockFetch({ organic: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({
      query: 'test',
      num: 20,
      page: 2,
      country: 'gb',
      language: 'en',
      dateRange: 'week',
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.q).toBe('test');
    expect(body.num).toBe(20);
    expect(body.page).toBe(2);
    expect(body.gl).toBe('gb');
    expect(body.hl).toBe('en');
    expect(body.tbs).toBe('qdr:w');
  });

  it('does not send page when page is 1', async () => {
    mockFetch({ organic: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({ query: 'test', page: 1 });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.page).toBeUndefined();
  });

  // ─── Response normalization: web ────────────────────────────────────

  it('normalizes web organic results', async () => {
    mockFetch({
      organic: [
        { title: 'Result 1', link: 'https://example.com', snippet: 'Desc 1', domain: 'example.com', date: '2024-01-01' },
        { title: 'Result 2', link: 'https://test.com', snippet: 'Desc 2' },
      ],
      searchParameters: { timeTaken: 0.5 },
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'test' });

    expect(res.provider).toBe('serper');
    expect(res.query).toBe('test');
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Result 1',
      url: 'https://example.com',
      description: 'Desc 1',
      domain: 'example.com',
      datePublished: '2024-01-01',
    });
    expect(res.results[1].position).toBe(2);
    expect(res.searchTime).toBe(500);
  });

  // ─── Response normalization: images ─────────────────────────────────

  it('normalizes image results', async () => {
    mockFetch({
      images: [{
        title: 'Cat pic',
        link: 'https://img.com/cat',
        snippet: 'A cat',
        imageUrl: 'https://img.com/cat.jpg',
        imageWidth: 800,
        imageHeight: 600,
        domain: 'img.com',
        thumbnailUrl: 'https://img.com/cat_thumb.jpg',
      }],
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'cats', type: 'images' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Cat pic',
      imageUrl: 'https://img.com/cat.jpg',
      imageWidth: 800,
      imageHeight: 600,
      thumbnail: 'https://img.com/cat_thumb.jpg',
    });
  });

  // ─── Response normalization: news ───────────────────────────────────

  it('normalizes news results', async () => {
    mockFetch({
      news: [{
        title: 'Breaking News',
        link: 'https://news.com/1',
        snippet: 'Something happened',
        source: 'CNN',
        date: '2024-03-01',
        imageUrl: 'https://news.com/img.jpg',
      }],
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'news', type: 'news' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Breaking News',
      source: 'CNN',
      datePublished: '2024-03-01',
      thumbnail: 'https://news.com/img.jpg',
    });
  });

  // ─── Response normalization: videos ─────────────────────────────────

  it('normalizes video results', async () => {
    mockFetch({
      videos: [{
        title: 'Tutorial',
        link: 'https://youtube.com/watch?v=1',
        snippet: 'Learn stuff',
        duration: '10:30',
        channel: 'TechChannel',
        imageUrl: 'https://img.youtube.com/thumb.jpg',
        date: '2024-02-15',
      }],
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'tutorial', type: 'videos' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Tutorial',
      duration: '10:30',
      channel: 'TechChannel',
      thumbnail: 'https://img.youtube.com/thumb.jpg',
    });
  });

  // ─── Enrichments ────────────────────────────────────────────────────

  it('maps relatedSearches', async () => {
    mockFetch({
      organic: [],
      relatedSearches: [{ query: 'related 1' }, { query: 'related 2' }],
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'test' });
    expect(res.relatedSearches).toEqual(['related 1', 'related 2']);
  });

  it('maps peopleAlsoAsk', async () => {
    mockFetch({
      organic: [],
      peopleAlsoAsk: [{
        question: 'What is X?',
        snippet: 'X is...',
        title: 'About X',
        link: 'https://x.com',
      }],
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'test' });
    expect(res.peopleAlsoAsk).toHaveLength(1);
    expect(res.peopleAlsoAsk![0].question).toBe('What is X?');
  });

  it('maps knowledgeGraph to knowledgePanel', async () => {
    mockFetch({
      organic: [],
      knowledgeGraph: {
        title: 'Entity',
        type: 'Organization',
        description: 'A company',
        descriptionSource: 'Wikipedia',
        descriptionLink: 'https://en.wikipedia.org/wiki/Entity',
        imageUrl: 'https://img.com/entity.jpg',
        attributes: { founded: '2020' },
      },
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'entity' });

    expect(res.knowledgePanel).toMatchObject({
      title: 'Entity',
      type: 'Organization',
      description: 'A company',
      source: 'Wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Entity',
      imageUrl: 'https://img.com/entity.jpg',
      attributes: { founded: '2020' },
    });
  });

  it('maps answerBox', async () => {
    mockFetch({
      organic: [],
      answerBox: {
        snippet: 'The answer is 42',
        title: 'Quick answer',
        link: 'https://example.com/answer',
      },
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'answer' });
    expect(res.answerBox).toMatchObject({
      snippet: 'The answer is 42',
      title: 'Quick answer',
      url: 'https://example.com/answer',
    });
  });

  it('uses answerBox.answer when snippet is missing', async () => {
    mockFetch({
      organic: [],
      answerBox: { answer: 'fallback answer' },
    });

    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'test' });
    expect(res.answerBox!.snippet).toBe('fallback answer');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ message: 'Unauthorized' }, 401);
    const adapter = createSerperAdapter('bad-key');

    try {
      await adapter.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      const e = err as AnySerpError;
      expect(e.code).toBe(401);
      expect(e.metadata.provider_name).toBe('serper');
    }
  });

  it('handles non-JSON error response', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );
    const adapter = createSerperAdapter('k');

    try {
      await adapter.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).code).toBe(500);
    }
  });

  it('handles empty organic array', async () => {
    mockFetch({ organic: [] });
    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'obscure' });
    expect(res.results).toEqual([]);
  });

  it('handles missing organic field', async () => {
    mockFetch({});
    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'test' });
    expect(res.results).toEqual([]);
  });

  // ─── Places ─────────────────────────────────────────────────────────

  it('uses /places endpoint for places search', async () => {
    mockFetch({ places: [] });
    const adapter = createSerperAdapter('k');
    await adapter.search({ query: 'coffee shops', type: 'places' });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://google.serper.dev/places');
  });

  it('maps places results to SearchResult with places fields', async () => {
    mockFetch({
      places: [{
        title: 'Blue Bottle Coffee',
        address: '300 Webster St, Oakland, CA',
        rating: 4.6,
        ratingCount: 850,
        type: 'Coffee shop',
        phoneNumber: '+1 510-653-3394',
        website: 'https://bluebottlecoffee.com',
        imageUrl: 'https://example.com/img.jpg',
        hours: 'Open ⋅ Closes 6 PM',
      }],
    });
    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'coffee', type: 'places' });

    expect(res.results).toHaveLength(1);
    const r = res.results[0];
    expect(r.title).toBe('Blue Bottle Coffee');
    expect(r.url).toBe('https://bluebottlecoffee.com');
    expect(r.description).toBe('300 Webster St, Oakland, CA');
    expect(r.address).toBe('300 Webster St, Oakland, CA');
    expect(r.phone).toBe('+1 510-653-3394');
    expect(r.rating).toBe(4.6);
    expect(r.reviewCount).toBe(850);
    expect(r.placeType).toBe('Coffee shop');
    expect(r.hours).toBe('Open ⋅ Closes 6 PM');
    expect(r.thumbnail).toBe('https://example.com/img.jpg');
  });

  it('handles empty places array', async () => {
    mockFetch({ places: [] });
    const adapter = createSerperAdapter('k');
    const res = await adapter.search({ query: 'nowhere', type: 'places' });
    expect(res.results).toEqual([]);
  });
});
