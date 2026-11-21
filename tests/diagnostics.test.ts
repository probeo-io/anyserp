import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnySerp, AnySerpError, AnySerpAggregateError } from '../src/index.js';
import type { SearchAdapter, SearchRequest } from '../src/index.js';

const response = (provider: string, query = 'q') => ({ provider, query, results: [] });
function client(defaultProvider?: string) {
  const c = new AnySerp(defaultProvider === undefined ? {} : { defaultProvider });
  // Isolate fixture registry from developer environment credentials.
  for (const name of c.providers()) c.getRegistry().register(name, adapter(name, () => { throw Error('unexpected'); }, false));
  return c;
}
function adapter(name: string, search: SearchAdapter['search'], supported = true): SearchAdapter {
  return { name, search, supportsType: () => supported };
}
afterEach(() => vi.unstubAllEnvs());
describe('explicit default routing', () => {
  it('stays selected when another provider is added; prefixes override it', async () => {
    const c = client('chosen');
    c.getRegistry().register('earlier', adapter('earlier', async r => response('earlier', r.query)));
    c.getRegistry().register('chosen', adapter('chosen', async r => response('chosen', r.query)));
    expect((await c.search('q')).provider).toBe('chosen');
    expect((await c.search('earlier/q')).provider).toBe('earlier');
  });
  it.each(['', 'missing', 'unsupported'])('rejects invalid default %s before searching', async name => {
    const c = client(name);
    const search = vi.fn(async () => response('unsupported'));
    c.getRegistry().register('unsupported', adapter('unsupported', search, false));
    await expect(c.search('q')).rejects.toMatchObject({ code: 400 });
    expect(search).not.toHaveBeenCalled();
  });
  it('preserves legacy first eligible routing and alias precedence', async () => {
    const c = new AnySerp({ defaultProvider: 'missing', aliases: { fast: 'fixture' } });
    c.getRegistry().register('fixture', adapter('fixture', async r => response('fixture', r.query)));
    expect((await c.search('fast/q')).query).toBe('q');
    const legacy = client();
    legacy.getRegistry().register('first', adapter('first', async () => response('first')));
    expect((await legacy.search('q')).provider).toBe('first');
  });
});
describe('request scoped diagnostics', () => {
  it('retains earlier fallback errors on success and isolates adapter mutation', async () => {
    const c = client(); const error = Error('private upstream detail'); const request = { query: 'original' };
    c.getRegistry().register('bad', adapter('bad', async r => { r.query = 'mutated'; throw error; }));
    c.getRegistry().register('good', adapter('good', async r => response('good', r.query)));
    const result = await c.searchWithFallbackDetailed(request, ['absent', 'bad', 'good']);
    expect(result).toEqual({ response: response('good', 'original'), failures: [{ provider: 'bad', error }] });
    expect(request.query).toBe('original');
    expect((await c.searchWithFallback(request, ['good'])).provider).toBe('good');
  });
  it('aggregates all failures with last actual status and safe headline', async () => {
    const c = client(); const first = new AnySerpError(429, 'secret'); const last = new AnySerpError(503, 'secret2');
    c.getRegistry().register('a', adapter('a', async () => { throw first; }));
    c.getRegistry().register('b', adapter('b', async () => { throw last; }));
    const error = await c.searchWithFallback({ query: 'q' }, ['a', 'b']).catch(e => e);
    expect(error).toBeInstanceOf(AnySerpAggregateError);
    expect(error).toBeInstanceOf(AnySerpError);
    expect(error.code).toBe(503);
    expect(error.message).not.toContain('secret');
    expect(error.failures).toEqual([{ provider: 'a', error: first }, { provider: 'b', error: last }]);
    expect(Object.isFrozen(error.failures[0])).toBe(true);
    c.getRegistry().register('b', adapter('b', async () => { throw 'non-error'; }));
    await expect(c.searchWithFallbackDetailed({ query: 'q' }, ['a', 'b'])).rejects.toMatchObject({ code: 502 });
    await expect(c.searchWithFallbackDetailed({ query: 'q' }, ['missing'])).rejects.toMatchObject({ code: 400 });
  });
  it('captures synchronous throws, stable order, all failures and empty scope', async () => {
    const c = client(); const one = Error('one'); const two = Error('two');
    c.getRegistry().register('a', adapter('a', () => { throw one; }));
    c.getRegistry().register('b', adapter('b', async () => { throw two; }));
    expect((await c.searchAllDetailed({ query: 'q' })).failures).toEqual([{ provider: 'a', error: one }, { provider: 'b', error: two }]);
    expect(await c.searchAll({ query: 'q' })).toEqual([]);
    expect(await client().searchAllDetailed({ query: 'q' })).toEqual({ responses: [], failures: [] });
  });
  it('isolates concurrent calls and parallel request copies', async () => {
    const c = client();
    c.getRegistry().register('mutator', adapter('mutator', async r => { r.query = 'changed'; throw Error('failed'); }));
    c.getRegistry().register('good', adapter('good', async r => { await Promise.resolve(); return response('good', r.query); }));
    const requests: SearchRequest[] = [{ query: 'one' }, { query: 'two' }];
    const results = await Promise.all(requests.map(r => c.searchAllDetailed(r)));
    expect(results.map(r => r.responses[0].query)).toEqual(['one', 'two']);
    expect(requests.map(r => r.query)).toEqual(['one', 'two']);
    expect(results[0].failures).not.toBe(results[1].failures);
  });
});
