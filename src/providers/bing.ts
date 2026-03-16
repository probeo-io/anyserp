import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType } from '../types.js';
import { AnySerpError } from '../types.js';

const BING_API_BASE = 'https://api.bing.microsoft.com/v7.0';

const TYPE_ENDPOINTS: Record<SearchType, string> = {
  web: '/search',
  images: '/images/search',
  news: '/news/search',
  videos: '/videos/search',
};

const FRESHNESS_MAP: Record<string, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

export function createBingAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(endpoint: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${BING_API_BASE}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      const msg = errorBody?.error?.message || res.statusText;
      throw new AnySerpError(res.status, msg, { provider_name: 'bing', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'bing',

    supportsType(): boolean {
      return true;
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const endpoint = TYPE_ENDPOINTS[type];
      const params: Record<string, string> = { q: request.query };

      if (request.num) params.count = String(request.num);
      if (request.page && request.page > 1) params.offset = String((request.page - 1) * (request.num || 10));
      if (request.country) params.cc = request.country;
      if (request.language) params.setLang = request.language;
      if (request.safe) params.safeSearch = 'Strict';
      if (request.dateRange && FRESHNESS_MAP[request.dateRange]) {
        params.freshness = FRESHNESS_MAP[request.dateRange];
      }

      const data = await makeRequest(endpoint, params);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.webPages?.value || []).entries()) {
          results.push({
            position: i + 1,
            title: r.name || '',
            url: r.url || '',
            description: r.snippet || '',
            domain: r.displayUrl ? new URL(r.url).hostname : undefined,
            datePublished: r.dateLastCrawled,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.value || []).entries()) {
          results.push({
            position: i + 1,
            title: r.name || '',
            url: r.hostPageUrl || '',
            description: r.name || '',
            imageUrl: r.contentUrl,
            imageWidth: r.width,
            imageHeight: r.height,
            thumbnail: r.thumbnailUrl,
            domain: r.hostPageDisplayUrl ? new URL(r.hostPageUrl).hostname : undefined,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.value || []).entries()) {
          results.push({
            position: i + 1,
            title: r.name || '',
            url: r.url || '',
            description: r.description || '',
            source: r.provider?.[0]?.name,
            datePublished: r.datePublished,
            thumbnail: r.image?.thumbnail?.contentUrl,
          });
        }
      } else if (type === 'videos') {
        for (const [i, r] of (data.value || []).entries()) {
          results.push({
            position: i + 1,
            title: r.name || '',
            url: r.contentUrl || r.hostPageUrl || '',
            description: r.description || '',
            duration: r.duration,
            channel: r.creator?.name,
            thumbnail: r.thumbnailUrl,
            datePublished: r.datePublished,
          });
        }
      }

      return {
        provider: 'bing',
        query: request.query,
        results,
        totalResults: data.webPages?.totalEstimatedMatches || data.totalEstimatedMatches,
      };
    },
  };
}
