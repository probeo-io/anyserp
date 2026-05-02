import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType } from '../types.js';
import { AnySerpError } from '../types.js';

const GOOGLE_CSE_BASE = 'https://www.googleapis.com/customsearch/v1';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images'];

const TYPE_MAP: Partial<Record<SearchType, string>> = {
  images: 'image',
};

const DATE_MAP: Record<string, string> = {
  day: 'd1',
  week: 'w1',
  month: 'm1',
  year: 'y1',
};

export function createGoogleAdapter(apiKey: string, engineId: string): SearchAdapter {
  async function makeRequest(params: Record<string, string>): Promise<any> {
    const url = new URL(GOOGLE_CSE_BASE);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', engineId);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      const msg = errorBody?.error?.message || res.statusText;
      throw new AnySerpError(res.status, msg, { provider_name: 'google', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'google',

    supportsType(type: SearchType): boolean {
      return SUPPORTED_TYPES.includes(type);
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const params: Record<string, string> = { q: request.query };

      if (request.num) params.num = String(Math.min(request.num, 10)); // CSE max 10
      if (request.page && request.page > 1) params.start = String(((request.page - 1) * (request.num || 10)) + 1);
      if (request.country) params.gl = request.country;
      if (request.language) params.lr = `lang_${request.language}`;
      if (request.safe) params.safe = 'active';
      if (request.dateRange) params.dateRestrict = DATE_MAP[request.dateRange];

      const searchType = TYPE_MAP[type];
      if (searchType) params.searchType = searchType;

      const data = await makeRequest(params);

      const results: SearchResult[] = [];
      for (const [i, item] of (data.items || []).entries()) {
        const result: SearchResult = {
          position: i + 1,
          title: item.title || '',
          url: item.link || '',
          description: item.snippet || '',
          domain: item.displayLink,
        };

        if (type === 'images' && item.image) {
          result.imageUrl = item.link;
          result.imageWidth = item.image.width;
          result.imageHeight = item.image.height;
          result.thumbnail = item.image.thumbnailLink;
        }

        if (item.pagemap?.metatags?.[0]?.['article:published_time']) {
          result.datePublished = item.pagemap.metatags[0]['article:published_time'];
        }

        results.push(result);
      }

      return {
        provider: 'google',
        query: request.query,
        results,
        totalResults: data.searchInformation?.totalResults
          ? parseInt(data.searchInformation.totalResults, 10)
          : undefined,
        searchTime: data.searchInformation?.searchTime
          ? data.searchInformation.searchTime * 1000
          : undefined,
      };
    },
  };
}
