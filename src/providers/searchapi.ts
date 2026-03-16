import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox } from '../types.js';
import { AnySerpError } from '../types.js';

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';

const ENGINE_MAP: Record<SearchType, string> = {
  web: 'google',
  images: 'google_images',
  news: 'google_news',
  videos: 'google_videos',
};

const TIME_PERIOD_MAP: Record<string, string> = {
  day: 'last_day',
  week: 'last_week',
  month: 'last_month',
  year: 'last_year',
};

export function createSearchApiAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(params: Record<string, string>): Promise<any> {
    const url = new URL(SEARCHAPI_BASE);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.error || res.statusText, { provider_name: 'searchapi', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'searchapi',

    supportsType(): boolean {
      return true;
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const params: Record<string, string> = {
        engine: ENGINE_MAP[type],
        q: request.query,
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
            domain: r.displayed_link ? new URL(r.link).hostname : undefined,
            datePublished: r.date,
            thumbnail: r.thumbnail,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.images || data.image_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || r.original || '',
            description: r.snippet || r.title || '',
            imageUrl: r.original || r.image,
            imageWidth: r.original_width,
            imageHeight: r.original_height,
            thumbnail: r.thumbnail,
            source: r.source,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.news_results || data.organic_results || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            source: r.source?.name || r.source,
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
            channel: r.channel?.name || r.channel,
            thumbnail: r.thumbnail,
            datePublished: r.date,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'searchapi',
        query: request.query,
        results,
        totalResults: data.search_information?.total_results,
        searchTime: data.search_information?.time_taken_displayed
          ? parseFloat(data.search_information.time_taken_displayed) * 1000
          : undefined,
        relatedSearches: data.related_searches?.map((r: any) => r.query),
      };

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
