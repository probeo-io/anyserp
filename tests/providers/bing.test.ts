import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBingAdapter } from '../../src/providers/bing.js';
import { AnySerpError } from '../../src/types.js';

describe('Bing adapter', () => {
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

  it('has name "bing"', () => {
    expect(createBingAdapter('k').name).toBe('bing');
  });

  it('supports all search types', () => {
    const a = createBingAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET to bing API with subscription key header', async () => {
    mockFetch({ webPages: { value: [] } });
    const a = createBingAdapter('my-key');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://api.bing.microsoft.com');
    expect(url.pathname).toBe('/v7.0/search');
    expect(url.searchParams.get('q')).toBe('hello');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('my-key');
  });

  it('uses /images/search for image type', async () => {
    mockFetch({ value: [] });
    const a = createBingAdapter('k');
    await a.search({ query: 'cats', type: 'images' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v7.0/images/search');
  });

  it('uses /news/search for news type', async () => {
    mockFetch({ value: [] });
    const a = createBingAdapter('k');
    await a.search({ query: 'headlines', type: 'news' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v7.0/news/search');
  });

  it('uses /videos/search for video type', async () => {
    mockFetch({ value: [] });
    const a = createBingAdapter('k');
    await a.search({ query: 'tutorials', type: 'videos' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v7.0/videos/search');
  });

  it('passes count, offset, country, language, safe, freshness', async () => {
    mockFetch({ webPages: { value: [] } });
    const a = createBingAdapter('k');
    await a.search({
      query: 'test',
      num: 20,
      page: 3,
      country: 'gb',
      language: 'en',
      safe: true,
      dateRange: 'week',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('count')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('40');
    expect(url.searchParams.get('cc')).toBe('gb');
    expect(url.searchParams.get('setLang')).toBe('en');
    expect(url.searchParams.get('safeSearch')).toBe('Strict');
    expect(url.searchParams.get('freshness')).toBe('Week');
  });

  it('does not set freshness for year (no mapping)', async () => {
    mockFetch({ webPages: { value: [] } });
    const a = createBingAdapter('k');
    await a.search({ query: 'test', dateRange: 'year' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.has('freshness')).toBe(false);
  });

  // ─── Response normalization: web ────────────────────────────────────

  it('normalizes web results from webPages.value', async () => {
    mockFetch({
      webPages: {
        value: [{
          name: 'Example',
          url: 'https://example.com',
          snippet: 'An example',
          displayUrl: 'https://example.com',
          dateLastCrawled: '2024-01-15',
        }],
        totalEstimatedMatches: 50000,
      },
    });

    const a = createBingAdapter('k');
    const res = await a.search({ query: 'example' });

    expect(res.provider).toBe('bing');
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Example',
      url: 'https://example.com',
      description: 'An example',
      domain: 'example.com',
    });
    expect(res.totalResults).toBe(50000);
  });

  // ─── Response normalization: images ─────────────────────────────────

  it('normalizes image results from value', async () => {
    mockFetch({
      value: [{
        name: 'Cat',
        hostPageUrl: 'https://img.com/cats',
        contentUrl: 'https://img.com/cat.jpg',
        width: 800,
        height: 600,
        thumbnailUrl: 'https://img.com/cat_thumb.jpg',
        hostPageDisplayUrl: 'img.com/cats',
      }],
    });

    const a = createBingAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });

    expect(res.results[0]).toMatchObject({
      title: 'Cat',
      url: 'https://img.com/cats',
      imageUrl: 'https://img.com/cat.jpg',
      imageWidth: 800,
      imageHeight: 600,
      thumbnail: 'https://img.com/cat_thumb.jpg',
    });
  });

  // ─── Response normalization: news ───────────────────────────────────

  it('normalizes news results', async () => {
    mockFetch({
      value: [{
        name: 'Headline',
        url: 'https://news.com/1',
        description: 'Breaking news',
        provider: [{ name: 'CNN' }],
        datePublished: '2024-03-01T12:00:00Z',
        image: { thumbnail: { contentUrl: 'https://news.com/img.jpg' } },
      }],
    });

    const a = createBingAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });

    expect(res.results[0]).toMatchObject({
      title: 'Headline',
      source: 'CNN',
      datePublished: '2024-03-01T12:00:00Z',
      thumbnail: 'https://news.com/img.jpg',
    });
  });

  // ─── Response normalization: videos ─────────────────────────────────

  it('normalizes video results', async () => {
    mockFetch({
      value: [{
        name: 'Tutorial',
        contentUrl: 'https://youtube.com/1',
        hostPageUrl: 'https://youtube.com/watch',
        description: 'A tutorial',
        duration: 'PT10M30S',
        creator: { name: 'TechChannel' },
        thumbnailUrl: 'https://thumb.jpg',
        datePublished: '2024-02-01',
      }],
    });

    const a = createBingAdapter('k');
    const res = await a.search({ query: 'tutorial', type: 'videos' });

    expect(res.results[0]).toMatchObject({
      title: 'Tutorial',
      url: 'https://youtube.com/1',
      duration: 'PT10M30S',
      channel: 'TechChannel',
    });
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: { message: 'Invalid key' } }, 401);
    const a = createBingAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).code).toBe(401);
      expect((err as AnySerpError).metadata.provider_name).toBe('bing');
    }
  });

  it('handles empty webPages', async () => {
    mockFetch({ webPages: { value: [] } });
    const a = createBingAdapter('k');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });

  it('handles missing webPages', async () => {
    mockFetch({});
    const a = createBingAdapter('k');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });
});
