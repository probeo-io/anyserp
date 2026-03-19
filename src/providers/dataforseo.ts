import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox } from '../types.js';
import { AnySerpError } from '../types.js';

const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';

// DataForSEO uses location codes — default to US (2840)
const COUNTRY_LOCATION_MAP: Record<string, number> = {
  us: 2840, gb: 2826, ca: 2124, au: 2036, de: 2276, fr: 2250,
  es: 2724, it: 2380, br: 2076, in: 2356, jp: 2392, kr: 2410,
  mx: 2484, nl: 2528, se: 2752, no: 2578, dk: 2208, fi: 2246,
  pl: 2616, ru: 2643, za: 2710, ar: 2032, cl: 2152, co: 2170,
  pt: 2620, be: 2056, at: 2040, ch: 2756, ie: 2372, nz: 2554,
  sg: 2702, hk: 2344, tw: 2158, ph: 2608, th: 2764, my: 2458,
  id: 2360, vn: 2704, tr: 2792, il: 2376, ae: 2784, sa: 2682,
  eg: 2818, ng: 2566, ke: 2404,
};

const SE_TYPE_MAP: Record<SearchType, string> = {
  web: 'organic',
  images: 'organic',  // images come as items in organic results
  news: 'news',
  videos: 'organic',  // videos come as items in organic results
};

export function createDataForSeoAdapter(login: string, password: string): SearchAdapter {
  const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

  async function makeRequest(path: string, tasks: Record<string, unknown>[]): Promise<any> {
    const res = await fetch(`${DATAFORSEO_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(tasks),
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      const msg = errorBody?.status_message || res.statusText;
      throw new AnySerpError(res.status, msg, { provider_name: 'dataforseo', raw: errorBody });
    }

    const data = await res.json();

    // DataForSEO wraps everything in status codes
    if (data.status_code && data.status_code >= 40000) {
      throw new AnySerpError(
        data.status_code >= 50000 ? 502 : 400,
        data.status_message || 'DataForSEO error',
        { provider_name: 'dataforseo', raw: data },
      );
    }

    const task = data.tasks?.[0];
    if (!task) {
      throw new AnySerpError(502, 'No task in DataForSEO response', { provider_name: 'dataforseo', raw: data });
    }

    if (task.status_code >= 40000) {
      throw new AnySerpError(
        task.status_code >= 50000 ? 502 : 400,
        task.status_message || 'DataForSEO task error',
        { provider_name: 'dataforseo', raw: task },
      );
    }

    return task;
  }

  return {
    name: 'dataforseo',

    supportsType(type: SearchType): boolean {
      return type === 'web' || type === 'news';
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const seType = SE_TYPE_MAP[type];
      const path = `/serp/google/${seType}/live/advanced`;

      const task: Record<string, unknown> = {
        keyword: request.query,
        depth: request.num || 10,
      };

      if (request.country) {
        const locationCode = COUNTRY_LOCATION_MAP[request.country.toLowerCase()];
        if (locationCode) task.location_code = locationCode;
      }
      if (request.language) task.language_code = request.language;
      if (request.page && request.page > 1) {
        // DataForSEO doesn't have a page param — use depth offset
        task.depth = (request.num || 10) * request.page;
      }

      const taskResult = await makeRequest(path, [task]);
      const resultData = taskResult.result?.[0];

      const results: SearchResult[] = [];
      let knowledgePanel: KnowledgePanel | undefined;
      let answerBox: AnswerBox | undefined;

      if (resultData?.items) {
        let position = 0;
        for (const item of resultData.items) {
          if (item.type === 'organic') {
            position++;
            results.push({
              position,
              title: item.title || '',
              url: item.url || '',
              description: item.description || '',
              domain: item.domain,
              datePublished: item.timestamp,
            });
          } else if (item.type === 'knowledge_graph') {
            knowledgePanel = {
              title: item.title || '',
              type: item.sub_title,
              description: item.description,
              imageUrl: item.image_url,
            };
          } else if (item.type === 'featured_snippet') {
            answerBox = {
              snippet: item.description || item.title || '',
              title: item.title,
              url: item.url,
            };
          } else if (item.type === 'people_also_ask') {
            // Handled below after loop
          } else if (item.type === 'news_search' && type === 'news') {
            // News items from the news endpoint
            position++;
            results.push({
              position,
              title: item.title || '',
              url: item.url || '',
              description: item.snippet || item.description || '',
              source: item.source,
              datePublished: item.timestamp || item.datetime,
              thumbnail: item.image_url,
            });
          }
        }
      }

      const response: SearchResponse = {
        provider: 'dataforseo',
        query: request.query,
        results,
        totalResults: resultData?.se_results_count,
      };

      if (knowledgePanel) response.knowledgePanel = knowledgePanel;
      if (answerBox) response.answerBox = answerBox;

      const paaItems = resultData?.items?.filter((i: any) => i.type === 'people_also_ask');
      if (paaItems?.length) {
        const questions: any[] = [];
        for (const paa of paaItems) {
          if (paa.items) {
            for (const q of paa.items) {
              questions.push({
                question: q.title || '',
                snippet: q.description,
                url: q.url,
              });
            }
          }
        }
        if (questions.length) response.peopleAlsoAsk = questions;
      }

      return response;
    },
  };
}
