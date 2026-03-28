import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGoogleAdapter } from '../../src/providers/google.js';
import { AnySerpError } from '../../src/types.js';

describe('Google CSE adapter', () => {
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

  it('has name "google"', () => {
    expect(createGoogleAdapter('k', 'e').name).toBe('google');
  });

  it('supports only web and images', () => {
    const a = createGoogleAdapter('k', 'e');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(false);
    expect(a.supportsType('videos')).toBe(false);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET with key and cx params', async () => {
    mockFetch({ items: [] });
    const a = createGoogleAdapter('my-key', 'my-engine');
    await a.search({ query: 'test' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://www.googleapis.com');
    expect(url.pathname).toBe('/customsearch/v1');
    expect(url.searchParams.get('key')).toBe('my-key');
    expect(url.searchParams.get('cx')).toBe('my-engine');
    expect(url.searchParams.get('q')).toBe('test');
  });

  it('caps num at 10', async () => {
    mockFetch({ items: [] });
    const a = createGoogleAdapter('k', 'e');
    await a.search({ query: 'test', num: 50 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('num')).toBe('10');
  });

  it('sets searchType=image for image search', async () => {
    mockFetch({ items: [] });
    const a = createGoogleAdapter('k', 'e');
    await a.search({ query: 'cats', type: 'images' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('searchType')).toBe('image');
  });

  it('passes pagination, country, language, safe, dateRange', async () => {
    mockFetch({ items: [] });
    const a = createGoogleAdapter('k', 'e');
    await a.search({
      query: 'test',
      num: 10,
      page: 2,
      country: 'gb',
      language: 'en',
      safe: true,
      dateRange: 'day',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('start')).toBe('11');
    expect(url.searchParams.get('gl')).toBe('gb');
    expect(url.searchParams.get('lr')).toBe('lang_en');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('dateRestrict')).toBe('d1');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      items: [{
        title: 'Example',
        link: 'https://example.com',
        snippet: 'An example site',
        displayLink: 'example.com',
      }],
      searchInformation: { totalResults: '5000', searchTime: 0.25 },
    });

    const a = createGoogleAdapter('k', 'e');
    const res = await a.search({ query: 'example' });

    expect(res.provider).toBe('google');
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Example',
      url: 'https://example.com',
      description: 'An example site',
      domain: 'example.com',
    });
    expect(res.totalResults).toBe(5000);
    expect(res.searchTime).toBe(250);
  });

  it('normalizes image results with image metadata', async () => {
    mockFetch({
      items: [{
        title: 'Cat',
        link: 'https://img.com/cat.jpg',
        snippet: 'A cat image',
        displayLink: 'img.com',
        image: {
          width: 1920,
          height: 1080,
          thumbnailLink: 'https://img.com/cat_thumb.jpg',
        },
      }],
    });

    const a = createGoogleAdapter('k', 'e');
    const res = await a.search({ query: 'cat', type: 'images' });

    expect(res.results[0]).toMatchObject({
      imageUrl: 'https://img.com/cat.jpg',
      imageWidth: 1920,
      imageHeight: 1080,
      thumbnail: 'https://img.com/cat_thumb.jpg',
    });
  });

  it('extracts datePublished from pagemap metatags', async () => {
    mockFetch({
      items: [{
        title: 'Article',
        link: 'https://blog.com/post',
        snippet: 'Blog post',
        pagemap: {
          metatags: [{ 'article:published_time': '2024-06-15T10:00:00Z' }],
        },
      }],
    });

    const a = createGoogleAdapter('k', 'e');
    const res = await a.search({ query: 'blog' });
    expect(res.results[0].datePublished).toBe('2024-06-15T10:00:00Z');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on API error', async () => {
    mockFetch({ error: { message: 'API key invalid' } }, 403);
    const a = createGoogleAdapter('bad', 'e');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      const e = err as AnySerpError;
      expect(e.code).toBe(403);
      expect(e.message).toBe('API key invalid');
      expect(e.metadata.provider_name).toBe('google');
    }
  });

  it('handles missing items', async () => {
    mockFetch({});
    const a = createGoogleAdapter('k', 'e');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });
});
