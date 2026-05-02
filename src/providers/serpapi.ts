import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox } from '../types.js';
import { AnySerpError } from '../types.js';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images', 'news', 'videos', 'places'];

const ENGINE_MAP: Partial<Record<SearchType, string>> = {
  web: 'google',
  images: 'google_images',
  news: 'google_news',
  videos: 'google_videos',
  places: 'google_local',
};

const DATE_MAP: Record<string, string> = {
  day: 'qdr:d',
  week: 'qdr:w',
  month: 'qdr:m',
  year: 'qdr:y',
};

export function createSerpApiAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(params: Record<string, string>): Promise<any> {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('output', 'json');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.error || res.statusText, { provider_name: 'serpapi', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'serpapi',

    supportsType(type: SearchType): boolean {
      return SUPPORTED_TYPES.includes(type);
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const params: Record<string, string> = {
        engine: ENGINE_MAP[type]!,
        q: request.query,
      };

      if (request.num) params.num = String(request.num);
      if (request.page && request.page > 1) params.start = String((request.page - 1) * (request.num || 10));
      if (request.country) params.gl = request.country;
      if (request.language) params.hl = request.language;
      if (request.safe) params.safe = 'active';
      if (request.dateRange) params.tbs = DATE_MAP[request.dateRange];

      const data = await makeRequest(params);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.organic_results || []).entries()) {
          results.push({
            position: r.position || i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            domain: r.displayed_link,
            datePublished: r.date,
            thumbnail: r.thumbnail,
          });
        }
      } else if (type === 'images') {
        for (const [i, r] of (data.images_results || []).entries()) {
          results.push({
            position: r.position || i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            imageUrl: r.original,
            imageWidth: r.original_width,
            imageHeight: r.original_height,
            thumbnail: r.thumbnail,
            source: r.source,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.news_results || []).entries()) {
          results.push({
            position: r.position || i + 1,
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
            position: r.position || i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            duration: r.duration,
            channel: r.channel?.name,
            thumbnail: r.thumbnail?.static,
            datePublished: r.date,
          });
        }
      } else if (type === 'places') {
        for (const [i, r] of (data.local_results || []).entries()) {
          results.push({
            position: r.position || i + 1,
            title: r.title || '',
            url: r.website || '',
            description: r.address || '',
            thumbnail: r.thumbnail,
            address: r.address,
            phone: r.phone,
            rating: r.rating,
            reviewCount: r.reviews,
            placeType: r.type,
            hours: r.hours,
            coordinates: r.gps_coordinates
              ? { lat: r.gps_coordinates.latitude, lng: r.gps_coordinates.longitude }
              : undefined,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'serpapi',
        query: request.query,
        results,
        totalResults: data.search_information?.total_results,
        searchTime: data.search_information?.time_taken_displayed
          ? parseFloat(data.search_information.time_taken_displayed) * 1000
          : undefined,
        relatedSearches: data.related_searches?.map((r: any) => r.query),
      };

      if (data.related_questions?.length) {
        response.peopleAlsoAsk = data.related_questions.map((q: any) => ({
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
          imageUrl: kg.header_images?.[0]?.image,
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
