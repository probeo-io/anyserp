import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel } from '../types.js';
import { AnySerpError } from '../types.js';

const BRIGHTDATA_API_BASE = 'https://api.brightdata.com/request';

const TBM_MAP: Record<SearchType, string | undefined> = {
  web: undefined,
  images: 'isch',
  news: 'nws',
  videos: 'vid',
};

export function createBrightDataAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(searchUrl: string): Promise<any> {
    const res = await fetch(BRIGHTDATA_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        zone: 'serp',
        url: searchUrl,
        format: 'raw',
      }),
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.message || res.statusText, { provider_name: 'brightdata', raw: errorBody });
    }

    return res.json();
  }

  function buildSearchUrl(request: SearchRequest, type: SearchType): string {
    const params = new URLSearchParams();
    params.set('q', request.query);

    const tbm = TBM_MAP[type];
    if (tbm) params.set('tbm', tbm);

    if (request.country) params.set('gl', request.country);
    if (request.language) params.set('hl', request.language);
    if (request.num) params.set('num', String(request.num));
    if (request.page && request.page > 1) {
      params.set('start', String((request.page - 1) * (request.num || 10)));
    }
    if (request.safe) params.set('safe', 'active');

    params.set('brd_json', '1');

    return `https://www.google.com/search?${params.toString()}`;
  }

  return {
    name: 'brightdata',

    supportsType(): boolean {
      return true;
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const searchUrl = buildSearchUrl(request, type);
      const data = await makeRequest(searchUrl);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.organic || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.description || '',
            domain: r.display_link,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.organic || data.images || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.description || r.title || '',
            imageUrl: r.original || r.link,
            thumbnail: r.thumbnail,
            source: r.display_link,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.organic || data.news || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.description || '',
            source: r.display_link,
            datePublished: r.date,
          });
        }
      } else if (type === 'videos') {
        for (const [i, r] of (data.organic || data.videos || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.description || '',
            thumbnail: r.thumbnail,
            duration: r.duration,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'brightdata',
        query: request.query,
        results,
      };

      if (data.knowledge_panel) {
        const kp = data.knowledge_panel;
        response.knowledgePanel = {
          title: kp.title || '',
          type: kp.type,
          description: kp.description,
          imageUrl: kp.image,
        };
      }

      if (data.people_also_ask?.length) {
        response.peopleAlsoAsk = data.people_also_ask.map((q: any) => ({
          question: q.question || '',
          snippet: q.snippet,
          title: q.title,
          url: q.link || q.url,
        }));
      }

      if (data.related_searches) {
        response.relatedSearches = data.related_searches.map((r: any) =>
          typeof r === 'string' ? r : r.query || r.title || '',
        );
      }

      return response;
    },
  };
}
