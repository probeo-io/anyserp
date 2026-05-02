import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType } from '../types.js';
import { AnySerpError } from '../types.js';

const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images', 'news', 'videos'];

const TYPE_ENDPOINTS: Partial<Record<SearchType, string>> = {
  web: '/web/search',
  images: '/images/search',
  news: '/news/search',
  videos: '/videos/search',
};

const FRESHNESS_MAP: Record<string, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
  year: 'py',
};

export function createBraveAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(endpoint: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${BRAVE_API_BASE}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      const msg = errorBody?.message || res.statusText;
      throw new AnySerpError(res.status, msg, { provider_name: 'brave', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'brave',

    supportsType(type: SearchType): boolean {
      return SUPPORTED_TYPES.includes(type);
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const endpoint = TYPE_ENDPOINTS[type]!;
      const params: Record<string, string> = { q: request.query };

      if (request.num) params.count = String(request.num);
      if (request.page && request.page > 1) params.offset = String((request.page - 1) * (request.num || 10));
      if (request.country) params.country = request.country;
      if (request.language) params.search_lang = request.language;
      if (request.safe) params.safesearch = 'strict';
      if (request.dateRange) params.freshness = FRESHNESS_MAP[request.dateRange];

      const data = await makeRequest(endpoint, params);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.web?.results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.url || '',
            description: r.description || '',
            domain: r.meta_url?.hostname,
            datePublished: r.page_age,
            thumbnail: r.thumbnail?.src,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.url || '',
            description: r.description || r.title || '',
            imageUrl: r.properties?.url,
            imageWidth: r.properties?.width,
            imageHeight: r.properties?.height,
            thumbnail: r.thumbnail?.src,
            source: r.source,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.url || '',
            description: r.description || '',
            source: r.meta_url?.hostname,
            datePublished: r.age,
            thumbnail: r.thumbnail?.src,
          });
        }
      } else if (type === 'videos') {
        for (const [i, r] of (data.results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.url || '',
            description: r.description || '',
            thumbnail: r.thumbnail?.src,
            datePublished: r.age,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'brave',
        query: request.query,
        results,
      };

      if (type === 'web' && data.query?.related_searches) {
        response.relatedSearches = data.query.related_searches.map((r: any) => r.query || r);
      }

      return response;
    },
  };
}
