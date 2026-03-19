import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType } from '../types.js';
import { AnySerpError } from '../types.js';

const SCRAPINGDOG_BASE = 'https://api.scrapingdog.com';

const ENDPOINT_MAP: Record<SearchType, string> = {
  web: '/google',
  images: '/google_images',
  news: '/google_news',
  videos: '/google', // videos come as part of regular results
};

export function createScrapingDogAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(endpoint: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${SCRAPINGDOG_BASE}${endpoint}`);
    params.api_key = apiKey;
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.error || res.statusText, { provider_name: 'scrapingdog', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'scrapingdog',

    supportsType(type: SearchType): boolean {
      return type === 'web' || type === 'images' || type === 'news';
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const endpoint = ENDPOINT_MAP[type];
      const params: Record<string, string> = {
        query: request.query,
      };

      if (request.num) params.results = String(request.num);
      if (request.page && request.page > 1) params.page = String(request.page - 1); // 0-indexed
      if (request.country) params.country = request.country;
      if (request.language) params.language = request.language;

      const data = await makeRequest(endpoint, params);

      const results: SearchResult[] = [];

      if (type === 'web') {
        const organic = Array.isArray(data) ? data : (data.organic_results || data.organic_data || []);
        for (const [i, r] of organic.entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || r.url || '',
            description: r.snippet || r.description || '',
            domain: r.displayed_link || r.domain,
            datePublished: r.date,
          });
        }
      } else if (type === 'images') {
        const images = Array.isArray(data) ? data : (data.image_results || []);
        for (const [i, r] of images.entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || r.url || '',
            description: r.title || '',
            imageUrl: r.original || r.image,
            imageWidth: r.original_width,
            imageHeight: r.original_height,
            thumbnail: r.thumbnail,
            source: r.source,
          });
        }
      } else if (type === 'news') {
        const news = Array.isArray(data) ? data : (data.news_results || []);
        for (const [i, r] of news.entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || r.url || '',
            description: r.snippet || r.description || '',
            source: r.source,
            datePublished: r.date,
            thumbnail: r.thumbnail || r.image,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'scrapingdog',
        query: request.query,
        results,
      };

      if (data.people_also_ask?.length) {
        response.peopleAlsoAsk = data.people_also_ask.map((q: any) => ({
          question: q.question || '',
          snippet: q.snippet,
          title: q.title,
          url: q.link,
        }));
      }

      return response;
    },
  };
}
