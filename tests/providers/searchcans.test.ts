import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSearchCansAdapter } from '../../src/providers/searchcans.js';
import { AnySerpError } from '../../src/types.js';

describe('SearchCans adapter', () => {
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

  it('has name "searchcans"', () => {
    expect(createSearchCansAdapter('k').name).toBe('searchcans');
  });

  it('supports web and news only', () => {
    const a = createSearchCansAdapter('k');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('images')).toBe(false);
    expect(a.supportsType('videos')).toBe(false);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends POST with Bearer auth and body params', async () => {
    mockFetch({ organic_results: [] });
    const a = createSearchCansAdapter('my-key');
    await a.search({ query: 'hello' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://www.searchcans.com/api/search');
    expect(opts?.method).toBe('POST');

    const headers = opts?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-key');

    const body = JSON.parse(opts?.body as string);
    expect(body.s).toBe('hello');
    expect(body.t).toBe('google');
  });

  it('sends page, country, language in body', async () => {
    mockFetch({ organic_results: [] });
    const a = createSearchCansAdapter('k');
    await a.search({ query: 'test', page: 2, country: 'gb', language: 'en' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.p).toBe(2);
    expect(body.gl).toBe('gb');
    expect(body.hl).toBe('en');
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes organic_results', async () => {
    mockFetch({
      organic_results: [
        { title: 'R1', link: 'https://r1.com', snippet: 'D1', displayed_link: 'r1.com', date: '2024-01-01' },
      ],
    });

    const a = createSearchCansAdapter('k');
    const res = await a.search({ query: 'test' });

    expect(res.provider).toBe('searchcans');
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'R1',
      url: 'https://r1.com',
      description: 'D1',
      domain: 'r1.com',
    });
  });

  it('handles results field fallback', async () => {
    mockFetch({
      results: [
        { title: 'R1', url: 'https://r1.com', description: 'D1', domain: 'r1.com' },
      ],
    });

    const a = createSearchCansAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].url).toBe('https://r1.com');
  });

  it('maps peopleAlsoAsk', async () => {
    mockFetch({
      organic_results: [],
      people_also_ask: [{ question: 'Why?', snippet: 'Because', link: 'https://q.com' }],
    });

    const a = createSearchCansAdapter('k');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk).toHaveLength(1);
    expect(res.peopleAlsoAsk![0].url).toBe('https://q.com');
  });

  it('maps knowledge_panel', async () => {
    mockFetch({
      organic_results: [],
      knowledge_panel: {
        title: 'Entity',
        type: 'Org',
        description: 'A company',
      },
    });

    const a = createSearchCansAdapter('k');
    const res = await a.search({ query: 'entity' });
    expect(res.knowledgePanel).toMatchObject({
      title: 'Entity',
      type: 'Org',
      description: 'A company',
    });
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ error: 'Invalid key' }, 401);
    const a = createSearchCansAdapter('bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).metadata.provider_name).toBe('searchcans');
    }
  });

  it('handles empty results', async () => {
    mockFetch({ organic_results: [] });
    const a = createSearchCansAdapter('k');
    const res = await a.search({ query: 'nothing' });
    expect(res.results).toEqual([]);
  });
});
