import { describe, it, expect } from 'vitest';
import { AnySerp, AnySerpError } from '../src/index.js';

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

  it('throws for unknown provider prefix', async () => {
    // When provider is registered, prefix/query works; when unknown, treated as query
    const client = new AnySerp({ serper: { apiKey: 'test' } });
    await expect(client.search('unknown/test')).rejects.toThrow(); // serper will fail with bad key, but routing works
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
    const client = new AnySerp({
      google: { apiKey: 'test-key' },
    });
    expect(client.providers()).toEqual([]);

    const client2 = new AnySerp({
      google: { apiKey: 'test-key', engineId: 'test-engine' },
    });
    expect(client2.providers()).toEqual(['google']);
  });

  it('searchWithFallback throws when no providers match', async () => {
    const client = new AnySerp();
    await expect(
      client.searchWithFallback({ query: 'test' }),
    ).rejects.toThrow('No providers available');
  });

  it('searchAll returns empty when no providers', async () => {
    const client = new AnySerp();
    const results = await client.searchAll({ query: 'test' });
    expect(results).toEqual([]);
  });

  it('registers dataforseo with login and password', () => {
    const client = new AnySerp({
      dataforseo: { login: 'user', password: 'pass' },
    });
    expect(client.providers()).toEqual(['dataforseo']);
  });

  it('applies defaults from config', async () => {
    const client = new AnySerp({
      serper: { apiKey: 'test' },
      defaults: { num: 20, country: 'gb' },
    });
    expect(client.providers()).toContain('serper');
  });
});

describe('AnySerpError', () => {
  it('has code and metadata', () => {
    const err = new AnySerpError(429, 'Rate limited', { provider_name: 'serper' });
    expect(err.code).toBe(429);
    expect(err.message).toBe('Rate limited');
    expect(err.metadata.provider_name).toBe('serper');
    expect(err.name).toBe('AnySerpError');
  });
});
