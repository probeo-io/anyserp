import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataForSeoAdapter } from '../../src/providers/dataforseo.js';
import { AnySerpError } from '../../src/types.js';

describe('DataForSEO adapter', () => {
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

  function mockTaskResponse(items: unknown[], extras: Record<string, unknown> = {}): void {
    mockFetch({
      tasks: [{
        status_code: 20000,
        result: [{ items, se_results_count: 100, ...extras }],
      }],
    });
  }

  it('has name "dataforseo"', () => {
    expect(createDataForSeoAdapter('u', 'p').name).toBe('dataforseo');
  });

  it('supports web and news only', () => {
    const a = createDataForSeoAdapter('u', 'p');
    expect(a.supportsType('web')).toBe(true);
    expect(a.supportsType('news')).toBe(true);
    expect(a.supportsType('images')).toBe(false);
    expect(a.supportsType('videos')).toBe(false);
  });

  // ─── Request formation ──────────────────────────────────────────────

  it('sends POST with Basic auth header', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('myuser', 'mypass');
    await a.search({ query: 'test' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain('https://api.dataforseo.com/v3/serp/google/organic/live/advanced');
    expect(opts?.method).toBe('POST');

    const authHeader = (opts?.headers as Record<string, string>)['Authorization'];
    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('myuser:mypass');
  });

  it('uses news path for news type', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('u', 'p');
    await a.search({ query: 'headlines', type: 'news' });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('/serp/google/news/live/advanced');
  });

  it('sends keyword and depth in task body', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('u', 'p');
    await a.search({ query: 'test', num: 20 });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].keyword).toBe('test');
    expect(body[0].depth).toBe(20);
  });

  it('maps country code to location_code', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('u', 'p');
    await a.search({ query: 'test', country: 'gb' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].location_code).toBe(2826);
  });

  it('sends language_code', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('u', 'p');
    await a.search({ query: 'test', language: 'fr' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].language_code).toBe('fr');
  });

  it('adjusts depth for pagination', async () => {
    mockTaskResponse([]);
    const a = createDataForSeoAdapter('u', 'p');
    await a.search({ query: 'test', page: 3, num: 10 });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].depth).toBe(30);
  });

  // ─── Response normalization ─────────────────────────────────────────

  it('normalizes organic results', async () => {
    mockTaskResponse([
      { type: 'organic', title: 'Result 1', url: 'https://r1.com', description: 'Desc 1', domain: 'r1.com', timestamp: '2024-01-01' },
      { type: 'organic', title: 'Result 2', url: 'https://r2.com', description: 'Desc 2' },
    ]);

    const a = createDataForSeoAdapter('u', 'p');
    const res = await a.search({ query: 'test' });

    expect(res.provider).toBe('dataforseo');
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({
      position: 1,
      title: 'Result 1',
      url: 'https://r1.com',
      description: 'Desc 1',
    });
    expect(res.totalResults).toBe(100);
  });

  it('maps knowledge_graph items to knowledgePanel', async () => {
    mockTaskResponse([
      { type: 'knowledge_graph', title: 'Entity', sub_title: 'Org', description: 'A company', image_url: 'https://img.jpg' },
    ]);

    const a = createDataForSeoAdapter('u', 'p');
    const res = await a.search({ query: 'entity' });

    expect(res.knowledgePanel).toMatchObject({
      title: 'Entity',
      type: 'Org',
      description: 'A company',
      imageUrl: 'https://img.jpg',
    });
  });

  it('maps featured_snippet to answerBox', async () => {
    mockTaskResponse([
      { type: 'featured_snippet', description: 'The answer', title: 'Quick', url: 'https://a.com' },
    ]);

    const a = createDataForSeoAdapter('u', 'p');
    const res = await a.search({ query: 'test' });
    expect(res.answerBox).toMatchObject({
      snippet: 'The answer',
      title: 'Quick',
      url: 'https://a.com',
    });
  });

  it('maps people_also_ask items', async () => {
    mockTaskResponse([
      {
        type: 'people_also_ask',
        items: [
          { title: 'What is X?', description: 'X is...', url: 'https://x.com' },
        ],
      },
    ]);

    const a = createDataForSeoAdapter('u', 'p');
    const res = await a.search({ query: 'test' });
    expect(res.peopleAlsoAsk).toHaveLength(1);
    expect(res.peopleAlsoAsk![0].question).toBe('What is X?');
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('throws AnySerpError on HTTP error', async () => {
    mockFetch({ status_message: 'Auth failed' }, 401);
    const a = createDataForSeoAdapter('bad', 'bad');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).code).toBe(401);
      expect((err as AnySerpError).metadata.provider_name).toBe('dataforseo');
    }
  });

  it('throws on task-level error status code', async () => {
    mockFetch({
      tasks: [{
        status_code: 40000,
        status_message: 'Invalid keyword',
      }],
    });

    const a = createDataForSeoAdapter('u', 'p');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).message).toBe('Invalid keyword');
    }
  });

  it('throws on top-level error status code', async () => {
    mockFetch({
      status_code: 50000,
      status_message: 'Server error',
    });

    const a = createDataForSeoAdapter('u', 'p');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).code).toBe(502);
    }
  });

  it('throws when no task in response', async () => {
    mockFetch({ tasks: [] });
    const a = createDataForSeoAdapter('u', 'p');

    try {
      await a.search({ query: 'test' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AnySerpError);
      expect((err as AnySerpError).message).toBe('No task in DataForSEO response');
    }
  });
});
