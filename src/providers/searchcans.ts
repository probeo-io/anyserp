import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType } from '../types.js';
import { AnySerpError } from '../types.js';

const SEARCHCANS_API_BASE = 'https://www.searchcans.com/api/search';

export function createSearchCansAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(body: Record<string, unknown>): Promise<any> {
    const res = await fetch(SEARCHCANS_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.error || res.statusText, { provider_name: 'searchcans', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'searchcans',

    supportsType(type: SearchType): boolean {
      return type === 'web' || type === 'news';
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const body: Record<string, unknown> = {
        s: request.query,
        t: 'google',
      };

      if (request.page) body.p = request.page;
      if (request.country) body.gl = request.country;
      if (request.language) body.hl = request.language;

      const data = await makeRequest(body);

      const results: SearchResult[] = [];

      const organic = data.organic_results || data.results || [];
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

      const response: SearchResponse = {
        provider: 'searchcans',
        query: request.query,
        results,
      };

      if (data.people_also_ask?.length) {
        response.peopleAlsoAsk = data.people_also_ask.map((q: any) => ({
          question: q.question || '',
          snippet: q.snippet,
          title: q.title,
          url: q.link || q.url,
        }));
      }

      if (data.knowledge_panel) {
        response.knowledgePanel = {
          title: data.knowledge_panel.title || '',
          type: data.knowledge_panel.type,
          description: data.knowledge_panel.description,
        };
      }

      return response;
    },
  };
}
