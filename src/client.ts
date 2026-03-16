import type { AnySerpConfig, SearchAdapter, SearchRequest, SearchResponse, SearchType } from './types.js';
import { AnySerpError } from './types.js';
import { createSerperAdapter } from './providers/serper.js';
import { createSerpApiAdapter } from './providers/serpapi.js';
import { createGoogleAdapter } from './providers/google.js';
import { createBingAdapter } from './providers/bing.js';
import { createBraveAdapter } from './providers/brave.js';

export class AnySerpRegistry {
  private adapters = new Map<string, SearchAdapter>();

  register(name: string, adapter: SearchAdapter): void {
    this.adapters.set(name, adapter);
  }

  get(name: string): SearchAdapter | undefined {
    return this.adapters.get(name);
  }

  all(): SearchAdapter[] {
    return Array.from(this.adapters.values());
  }

  names(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export class AnySerp {
  private registry: AnySerpRegistry;
  private config: AnySerpConfig;
  private aliases: Record<string, string>;

  constructor(config: AnySerpConfig = {}) {
    this.config = config;
    this.registry = new AnySerpRegistry();
    this.aliases = config.aliases || {};
    this.registerProviders();
  }

  private registerProviders(): void {
    const config = this.config;

    // Serper
    const serperKey = config.serper?.apiKey || process.env.SERPER_API_KEY;
    if (serperKey) {
      this.registry.register('serper', createSerperAdapter(serperKey));
    }

    // SerpAPI
    const serpApiKey = config.serpapi?.apiKey || process.env.SERPAPI_API_KEY;
    if (serpApiKey) {
      this.registry.register('serpapi', createSerpApiAdapter(serpApiKey));
    }

    // Google Custom Search
    const googleKey = config.google?.apiKey || process.env.GOOGLE_CSE_API_KEY;
    const engineId = config.google?.engineId || process.env.GOOGLE_CSE_ENGINE_ID;
    if (googleKey && engineId) {
      this.registry.register('google', createGoogleAdapter(googleKey, engineId));
    }

    // Bing Web Search
    const bingKey = config.bing?.apiKey || process.env.BING_API_KEY;
    if (bingKey) {
      this.registry.register('bing', createBingAdapter(bingKey));
    }

    // Brave Search
    const braveKey = config.brave?.apiKey || process.env.BRAVE_API_KEY;
    if (braveKey) {
      this.registry.register('brave', createBraveAdapter(braveKey));
    }
  }

  /**
   * Search using a specific provider.
   * Provider is specified as "provider/query" or just uses the first available.
   */
  async search(request: SearchRequest | string): Promise<SearchResponse> {
    const req = typeof request === 'string' ? { query: request } : { ...request };

    // Apply defaults
    if (this.config.defaults) {
      if (req.num === undefined && this.config.defaults.num) req.num = this.config.defaults.num;
      if (req.country === undefined && this.config.defaults.country) req.country = this.config.defaults.country;
      if (req.language === undefined && this.config.defaults.language) req.language = this.config.defaults.language;
      if (req.safe === undefined && this.config.defaults.safe !== undefined) req.safe = this.config.defaults.safe;
    }

    // Check for provider prefix in query
    let providerName: string | undefined;
    if (req.query.includes('/')) {
      const slashIndex = req.query.indexOf('/');
      const maybeProvider = req.query.substring(0, slashIndex);
      if (this.registry.get(maybeProvider) || this.aliases[maybeProvider]) {
        providerName = this.aliases[maybeProvider] || maybeProvider;
        req.query = req.query.substring(slashIndex + 1);
      }
    }

    // Check aliases
    if (providerName && this.aliases[providerName]) {
      providerName = this.aliases[providerName];
    }

    if (providerName) {
      const adapter = this.registry.get(providerName);
      if (!adapter) {
        throw new AnySerpError(400, `Provider "${providerName}" not configured`, { provider_name: providerName });
      }
      return adapter.search(req);
    }

    // No provider specified — use first available that supports the type
    const type = req.type || 'web';
    for (const adapter of this.registry.all()) {
      if (adapter.supportsType(type)) {
        return adapter.search(req);
      }
    }

    throw new AnySerpError(400, `No provider configured. Set an API key for at least one provider.`);
  }

  /**
   * Search with fallback across multiple providers.
   */
  async searchWithFallback(
    request: SearchRequest,
    providers?: string[],
  ): Promise<SearchResponse> {
    const providerList = providers || this.registry.names();
    const type = request.type || 'web';

    let lastError: Error | undefined;

    for (const name of providerList) {
      const adapter = this.registry.get(name);
      if (!adapter || !adapter.supportsType(type)) continue;

      try {
        return await adapter.search(request);
      } catch (err) {
        lastError = err as Error;
      }
    }

    throw lastError || new AnySerpError(400, 'No providers available for fallback');
  }

  /**
   * Search all configured providers and return combined results.
   */
  async searchAll(request: SearchRequest): Promise<SearchResponse[]> {
    const type = request.type || 'web';
    const adapters = this.registry.all().filter(a => a.supportsType(type));

    const results = await Promise.allSettled(
      adapters.map(a => a.search(request)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<SearchResponse> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  /**
   * List configured providers.
   */
  providers(): string[] {
    return this.registry.names();
  }

  /**
   * Get the registry for direct adapter access.
   */
  getRegistry(): AnySerpRegistry {
    return this.registry;
  }
}
