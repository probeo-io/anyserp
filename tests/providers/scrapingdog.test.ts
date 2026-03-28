import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScrapingDogAdapter } from '../../src/providers/scrapingdog.js';
import { AnySerpError } from '../../src/types.js';

describe('ScrapingDog adapter', () => {
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

  it('has name "scrapingdog"', () => {
    expect(createScrapingDogAdapter('k').name).toBe('scrapingdog');
  });

  it('supports web, images, and news only', () => {
    const a = createScrapingDogAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('images')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('videos')).toBe(false);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends GET to correct endpoint with api_key', async () => {
    mockFetch({ organic_results: [] });
    const a = createScrapingDogAdapter('my-key');
    await a.search({ query: 'hello' });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe('https://api.scrapingdog.com');
    expect(url.pathname).toBe('/google');
    expect(url.searchParams.get('api_key')).toBe('my-key');
    expect(url.searchParams.get('query')).toBe('hello');
  });

  it('uses /google_images for images', async () => {
    mockFetch({ image_results: [] });
    const a = createScrapingDogAdapter('k');
    await a.search({ query: 'cats', type: 'images' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/google_images');
  });

  it('uses /google_news for news', async () => {
    mockFetch({ news_results: [] });
    const a = createScrapingDogAdapter('k');
    await a.search({ query: 'headlines', type: 'news' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/google_news');
  });

  it('passes results count, 0-indexed page, country, language', async () => {
    mockFetch({ organic_results: [] });
    const a = createScrapingDogAdapter('k');
    await a.search({
      query: 'test',
      num: 20,
      page: 3,
      country: 'gb',
      language: 'en',
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('results')).toBe('20');
    expect(url.searchParams.get('page')).toBe('2'); // 0-indexed
    expect(url.searchParams.get('country')).toBe('gb');
    expect(url.searchParams.get('language')).toBe('en');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes web results from organic_results', async () => {
    mockFetch({
      organic_results: [
        { title: 'R1', link: 'https://r1.com', snippet: 'D1', displayed_link: 'r1.com', date: '2024-01-01' },
      ],
    });

    const a = createScrapingDogAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'R1',
      url: 'https://r1.com',
      description: 'D1',
    });
  });

  it('handles array response format for web', async () => {
    mockFetch([
      { title: 'R1', link: 'https://r1.com', snippet: 'D1' },
    ]);

    const a = createScrapingDogAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.results).toHaveLength(1);
  });

  it('normalizes image results', async () => {
    mockFetch({
      image_results: [{
        title: 'Cat',
        link: 'https://img.com/cat',
        original: 'https://img.com/cat.jpg',
        original_width: 800,
        original_height: 600,
        thumbnail: 'https://thumb.jpg',
        source: 'ImgSite',
      }],
    });

    const a = createScrapingDogAdapter('k');
    const res = await a.search({ query: 'cat', type: 'images' });
    expect(res.results[0].imageUrl).toBe('https://img.com/cat.jpg');
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

    const a = createScrapingDogAdapter('k');
    const res = await a.search({ query: 'news', type: 'news' });
    expect(res.results[0].source).toBe('Reuters');
  });

  it('maps peopleAlsoAsk', async () => {
    mockFetch({
      organic_results: [],
      people_also_ask: [{ question: 'Why?', snippet: 'Because' }],
    });

    const a = createScrapingDogAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk).toHaveLength(1);
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: 'Invalid key' }, 403);
    const a = createScrapingDogAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).metadata.provider_name).toBe('scrapingdog');
    }
  });
});
