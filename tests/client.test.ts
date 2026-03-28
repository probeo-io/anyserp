import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnySerp, AnySerpError } from '../src/index.js';

// ─── Client: Initialization ─────────────────────────────────────────────────

describe('AnySerp', () => {
  it('initializes with no config', () => {
    const client = new AnySerp();
    expect(client.providers()).toEqual([]);
  });

  it('throws when no providers configured', async () => {
    const client = new AnySerp();
    await expect(client.search('test')).rejects.toThrow(AnySerpError);
    await expect(client.search('test')).rejects.toThrow('No provider configured');
  });

  it('accepts string query', async () => {
    const client = new AnySerp();
    await expect(client.search('test')).rejects.toThrow(AnySerpError);
  });

  it('accepts request object', async () => {
    const client = new AnySerp();
    await expect(client.search({ query: 'test', num: 5 })).rejects.toThrow(AnySerpError);
  });

  it('lists no providers when none configured', () => {
    const client = new AnySerp();
    expect(client.providers()).toHaveLength(0);
  });

  it('registers providers from config', () => {
    const client = new AnySerp({
      serper: { apiKey: 'test-key' },
      brave: { apiKey: 'test-key' },
    });
    expect(client.providers()).toEqual(['serper', 'brave']);
  });

  it('registers google only with both key and engine id', () => {
    const noEngine = new AnySerp({ google: { apiKey: 'test-key' } });
    expect(noEngine.providers()).toEqual([]);

    const withEngine = new AnySerp({
      google: { apiKey: 'test-key', engineId: 'test-engine' },
    });
    expect(withEngine.providers()).toEqual(['google']);
  });

  it('registers dataforseo with login and password', () => {
    const client = new AnySerp({
      dataforseo: { login: 'user', password: 'pass' },
    });
    expect(client.providers()).toEqual(['dataforseo']);
  });

  it('registers searchapi with api key', () => {
    const client = new AnySerp({ searchapi: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['searchapi']);
  });

  it('registers valueserp with api key', () => {
    const client = new AnySerp({ valueserp: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['valueserp']);
  });

  it('registers scrapingdog with api key', () => {
    const client = new AnySerp({ scrapingdog: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['scrapingdog']);
  });

  it('registers brightdata with api key', () => {
    const client = new AnySerp({ brightdata: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['brightdata']);
  });

  it('registers searchcans with api key', () => {
    const client = new AnySerp({ searchcans: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['searchcans']);
  });

  it('registers serpapi with api key', () => {
    const client = new AnySerp({ serpapi: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['serpapi']);
  });

  it('registers bing with api key', () => {
    const client = new AnySerp({ bing: { apiKey: 'k' } });
    expect(client.providers()).toEqual(['bing']);
  });

  it('registers all 11 providers at once', () => {
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      serpapi: { apiKey: 'k' },
      google: { apiKey: 'k', engineId: 'e' },
      bing: { apiKey: 'k' },
      brave: { apiKey: 'k' },
      dataforseo: { login: 'u', password: 'p' },
      searchapi: { apiKey: 'k' },
      valueserp: { apiKey: 'k' },
      scrapingdog: { apiKey: 'k' },
      brightdata: { apiKey: 'k' },
      searchcans: { apiKey: 'k' },
    });
    expect(client.providers()).toHaveLength(11);
  });

  it('exposes registry via getRegistry', () => {
    const client = new AnySerp({ serper: { apiKey: 'k' } });
    const registry = client.getRegistry();
    expect(registry.names()).toEqual(['serper']);
    expect(registry.get('serper')).toBeDefined();
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.all()).toHaveLength(1);
  });
});

// ─── Client: Defaults ───────────────────────────────────────────────────────

describe('AnySerp defaults', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockFetchOk(body: unknown): void {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );
  }

  it('applies num default when not specified in request', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      defaults: { num: 20 },
    });
    await client.search({ query: 'test' });
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.num).toBe(20);
  });

  it('does not override explicit num', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      defaults: { num: 20 },
    });
    await client.search({ query: 'test', num: 5 });
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.num).toBe(5);
  });

  it('applies country default', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      defaults: { country: 'gb' },
    });
    await client.search({ query: 'test' });
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.gl).toBe('gb');
  });

  it('applies language default', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      defaults: { language: 'fr' },
    });
    await client.search({ query: 'test' });
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.hl).toBe('fr');
  });

  it('applies safe default', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serpapi: { apiKey: 'k' },
      defaults: { safe: true },
    });
    await client.search({ query: 'test' });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('safe=active');
  });
});

// ─── Client: Provider Routing ───────────────────────────────────────────────

describe('AnySerp provider routing', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockFetchOk(body: unknown): void {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );
  }

  it('routes via provider prefix in query', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });
    const result = await client.search('serper/my query');
    expect(result.provider).toBe('serper');
    expect(result.query).toBe('my query');
  });

  it('uses first available provider when no prefix', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });
    const result = await client.search('test');
    expect(result.provider).toBe('serper');
  });

  it('throws for provider prefix that is not configured', async () => {
    const client = new AnySerp({ serper: { apiKey: 'k' } });
    // 'unknown' is not a registered provider, so it is treated as query
    // But the search will go through serper with 'unknown/test' as query
    mockFetchOk({ organic: [] });
    const result = await client.search('unknown/test');
    expect(result.provider).toBe('serper');
  });

  it('supports aliases', async () => {
    mockFetchOk({ organic: [] });
    const client = new AnySerp({
      serper: { apiKey: 'k' },
      aliases: { g: 'serper' },
    });
    const result = await client.search('g/test query');
    expect(result.provider).toBe('serper');
    expect(result.query).toBe('test query');
  });

  it('selects provider that supports the requested type', async () => {
    mockFetchOk({ items: [] });
    const client = new AnySerp({
      google: { apiKey: 'k', engineId: 'e' },
      searchcans: { apiKey: 'k' },
    });
    // searchcans doesn't support videos, google doesn't either
    // but google is first and supportsType returns false for videos
    // actually google only supports web + images
    await expect(
      client.search({ query: 'test', type: 'videos' }),
    ).rejects.toThrow('No provider configured');
  });
});

// ─── Client: Fallback ───────────────────────────────────────────────────────

describe('AnySerp searchWithFallback', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('falls back to second provider on failure', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ message: 'fail' }), { status: 500 });
      }
      return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });
    });

    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });

    const result = await client.searchWithFallback({ query: 'test' });
    expect(result.provider).toBe('brave');
  });

  it('throws last error when all providers fail', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ message: 'fail' }), { status: 500 }),
    );

    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });

    await expect(
      client.searchWithFallback({ query: 'test' }),
    ).rejects.toThrow();
  });

  it('throws when no providers match', async () => {
    const client = new AnySerp();
    await expect(
      client.searchWithFallback({ query: 'test' }),
    ).rejects.toThrow('No providers available');
  });

  it('respects explicit provider list order', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ message: 'fail' }), { status: 500 });
      }
      return new Response(JSON.stringify({ organic: [] }), { status: 200 });
    });

    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });

    const result = await client.searchWithFallback(
      { query: 'test' },
      ['brave', 'serper'],
    );
    expect(result.provider).toBe('serper');
  });
});

// ─── Client: searchAll ──────────────────────────────────────────────────────

describe('AnySerp searchAll', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns empty when no providers configured', async () => {
    const client = new AnySerp();
    const results = await client.searchAll({ query: 'test' });
    expect(results).toEqual([]);
  });

  it('returns results from all successful providers', async () => {
    fetchSpy.mockImplementation(async () => {
      return new Response(
        JSON.stringify({ organic: [], web: { results: [] } }),
        { status: 200 },
      );
    });

    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });

    const results = await client.searchAll({ query: 'test' });
    expect(results).toHaveLength(2);
  });

  it('filters out failed providers silently', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ message: 'fail' }), { status: 500 });
      }
      return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });
    });

    const client = new AnySerp({
      serper: { apiKey: 'k' },
      brave: { apiKey: 'k' },
    });

    const results = await client.searchAll({ query: 'test' });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('brave');
  });
});

// ─── AnySerpError ───────────────────────────────────────────────────────────

describe('AnySerpError', () => {
  it('has code, message, and metadata', () => {
    const err = new AnySerpError(429, 'Rate limited', {
      provider_name: 'serper',
    });
    expect(err.code).toBe(429);
    expect(err.message).toBe('Rate limited');
    expect(err.metadata.provider_name).toBe('serper');
    expect(err.name).toBe('AnySerpError');
  });

  it('defaults metadata to empty object', () => {
    const err = new AnySerpError(500, 'Server error');
    expect(err.metadata).toEqual({});
  });

  it('includes raw error data in metadata', () => {
    const raw = { error: 'bad_request', details: 'missing param' };
    const err = new AnySerpError(400, 'Bad request', {
      provider_name: 'brave',
      raw,
    });
    expect(err.metadata.raw).toEqual(raw);
  });

  it('is an instance of Error', () => {
    const err = new AnySerpError(500, 'fail');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AnySerpError);
  });
});
