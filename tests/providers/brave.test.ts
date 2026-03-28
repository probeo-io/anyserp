import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBraveAdapter } from '../../src/providers/brave.js';
import { AnySerpError } from '../../src/types.js';

describe('Brave adapter', () => {
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

  it('has name "brave"', () => {
    expect(createBraveAdapter('k').name).toBe('brave');
  });

  it('supports all search types', () => {
    const a = createBraveAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('videos')).toBe(true);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET with X-Subscription-Token header', async () => {
    mockFetch({ web: { results: [] } });
    const a = createBraveAdapter('my-token');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://api.search.brave.com');
    expect(url.pathname).toBe('/res/v1/web/search');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['X-Subscription-Token']).toBe('my-token');
  });

  it('uses correct endpoints per type', async () => {
    const types = [
      { type: 'web' as const, path: '/res/v1/web/search' },
      { type: 'images' as const, path: '/res/v1/images/search' },
      { type: 'news' as const, path: '/res/v1/news/search' },
      { type: 'videos' as const, path: '/res/v1/videos/search' },
    ];

    for (const { type, path } of types) {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ web: { results: [] }, results: [] }), { status: 200 }),
      );
      const a = createBraveAdapter('k');
      await a.search({ query: 'test', type });
      const url = new URL(fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string);
      expect(url.pathname).toBe(path);
    }
  });

  it('passes count, offset, country, language, safe, freshness', async () => {
    mockFetch({ web: { results: [] } });
    const a = createBraveAdapter('k');
    await a.search({
      query: 'test',
      num: 15,
      page: 2,
      country: 'us',
      language: 'en',
      safe: true,
      dateRange: 'month',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('count')).toBe('15');
    expect(url.searchParams.get('offset')).toBe('15');
    expect(url.searchParams.get('country')).toBe('us');
    expect(url.searchParams.get('search_lang')).toBe('en');
    expect(url.searchParams.get('safesearch')).toBe('strict');
    expect(url.searchParams.get('freshness')).toBe('pm');
  });

  // ─── Response normalization: web ────────────────────────────────────

  it('normalizes web results', async () => {
    mockFetch({
      web: {
        results: [{
          title: 'Example',
          url: 'https://example.com',
          description: 'An example',
          meta_url: { hostname: 'example.com' },
          page_age: '2024-01-01',
          thumbnail: { src: 'https://thumb.jpg' },
        }],
      },
      query: {
        related_searches: [{ query: 'related term' }],
      },
    });

    const a = createBraveAdapter('k');
    const res = await a.search({ query: 'example' });

    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Example',
      url: 'https://example.com',
      description: 'An example',
      domain: 'example.com',
      thumbnail: 'https://thumb.jpg',
    });
    expect(res.relatedSearches).toEqual(['related term']);
  });

  // ─── Response normalization: images ─────────────────────────────────

  it('normalizes image results', async () => {
    mockFetch({
      results: [{
        title: 'Cat',
        url: 'https://img.com/cat',
        description: 'A cat',
        properties: { url: 'https://img.com/cat.jpg', width: 800, height: 600 },
        thumbnail: { src: 'https://img.com/cat_thumb.jpg' },
        source: 'ImgSite',
      }],
    });

    const a = createBraveAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });

    expect(res.results[0]).toMatchObject({
      imageUrl: 'https://img.com/cat.jpg',
      imageWidth: 800,
      imageHeight: 600,
      source: 'ImgSite',
    });
  });

  // ─── Response normalization: news ───────────────────────────────────

  it('normalizes news results', async () => {
    mockFetch({
      results: [{
        title: 'News',
        url: 'https://news.com/1',
        description: 'Breaking',
        meta_url: { hostname: 'news.com' },
        age: '2 hours ago',
        thumbnail: { src: 'https://news.com/img.jpg' },
      }],
    });

    const a = createBraveAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });
    expect(res.results[0].source).toBe('news.com');
    expect(res.results[0].datePublished).toBe('2 hours ago');
  });

  // ─── Response normalization: videos ─────────────────────────────────

  it('normalizes video results', async () => {
    mockFetch({
      results: [{
        title: 'Video',
        url: 'https://youtube.com/1',
        description: 'A video',
        thumbnail: { src: 'https://thumb.jpg' },
        age: '1 day ago',
      }],
    });

    const a = createBraveAdapter('k');
    const res = await a.search({ query: 'video', type: 'videos' });
    expect(res.results[0].thumbnail).toBe('https://thumb.jpg');
    expect(res.results[0].datePublished).toBe('1 day ago');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ message: 'Forbidden' }, 403);
    const a = createBraveAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).code).toBe(403);
      expect((err as AnySerpError).metadata.provider_name).toBe('brave');
    }
  });

  it('handles empty web results', async () => {
    mockFetch({ web: { results: [] } });
    const a = createBraveAdapter('k');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });
});
