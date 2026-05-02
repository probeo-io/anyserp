import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox } from '../types.js';
import { AnySerpError } from '../types.js';

const VALUESERP_BASE = 'https://api.valueserp.com/search';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images', 'news', 'videos'];

const SEARCH_TYPE_MAP: Partial<Record<SearchType, string>> = {
  web: 'web',
  images: 'images',
  news: 'news',
  videos: 'videos',
};

const TIME_PERIOD_MAP: Record<string, string> = {
  day: 'last_day',
  week: 'last_week',
  month: 'last_month',
  year: 'last_year',
};

export function createValueSerpAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(params: Record<string, string>): Promise<any> {
    const url = new URL(VALUESERP_BASE);
    params.api_key = apiKey;
    params.output = 'json';
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.error || res.statusText, { provider_name: 'valueserp', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'valueserp',

    supportsType(type: SearchType): boolean {
      return SUPPORTED_TYPES.includes(type);
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const params: Record<string, string> = {
        q: request.query,
        search_type: SEARCH_TYPE_MAP[type]!,
      };

      if (request.num) params.num = String(request.num);
      if (request.page && request.page > 1) params.page = String(request.page);
      if (request.country) params.gl = request.country;
      if (request.language) params.hl = request.language;
      if (request.safe) params.safe = 'active';
      if (request.dateRange) params.time_period = TIME_PERIOD_MAP[request.dateRange];

      const data = await makeRequest(params);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.organic_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            domain: r.domain,
            datePublished: r.date,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.image_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.title || '',
            imageUrl: r.original || r.image,
            imageWidth: r.original_width,
            imageHeight: r.original_height,
            thumbnail: r.thumbnail,
            source: r.source,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.news_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            source: r.source,
            datePublished: r.date,
            thumbnail: r.thumbnail,
          });
        }
      } else if (type === 'videos') {
        for (const [i, r] of (data.video_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || r.description || '',
            duration: r.duration,
            channel: r.channel,
            thumbnail: r.thumbnail,
            datePublished: r.date,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'valueserp',
        query: request.query,
        results,
        totalResults: data.search_information?.total_results,
        searchTime: data.search_information?.time_taken_displayed
          ? parseFloat(data.search_information.time_taken_displayed) * 1000
          : undefined,
        relatedSearches: data.related_searches?.map((r: any) => r.query),
      };

      if (data.people_also_ask?.length) {
        response.peopleAlsoAsk = data.people_also_ask.map((q: any) => ({
          question: q.question || '',
          snippet: q.snippet,
          title: q.title,
          url: q.link,
        }));
      }

      if (data.knowledge_graph) {
        const kg = data.knowledge_graph;
        response.knowledgePanel = {
          title: kg.title || '',
          type: kg.type,
          description: kg.description,
          source: kg.source?.name,
          sourceUrl: kg.source?.link,
          imageUrl: kg.image,
        };
      }

      if (data.answer_box) {
        response.answerBox = {
          snippet: data.answer_box.snippet || data.answer_box.answer || '',
          title: data.answer_box.title,
          url: data.answer_box.link,
        };
      }

      return response;
    },
  };
}
