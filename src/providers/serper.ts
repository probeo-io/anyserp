import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox } from '../types.js';
import { AnySerpError } from '../types.js';

const SERPER_API_BASE = 'https://google.serper.dev';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images', 'news', 'videos', 'places'];

const TYPE_ENDPOINTS: Partial<Record<SearchType, string>> = {
  web: '/search',
  images: '/images',
  news: '/news',
  videos: '/videos',
  places: '/places',
};

const DATE_MAP: Record<string, string> = {
  day: 'qdr:d',
  week: 'qdr:w',
  month: 'qdr:m',
  year: 'qdr:y',
};

export function createSerperAdapter(apiKey: string): SearchAdapter {
  async function makeRequest(endpoint: string, body: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${SERPER_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorBody: any;
      try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
      throw new AnySerpError(res.status, errorBody?.message || res.statusText, { provider_name: 'serper', raw: errorBody });
    }

    return res.json();
  }

  return {
    name: 'serper',

    supportsType(type: SearchType): boolean {
      return SUPPORTED_TYPES.includes(type);
    },

    async search(request: SearchRequest): Promise<SearchResponse> {
      const type = request.type || 'web';
      const endpoint = TYPE_ENDPOINTS[type]!;

      const body: Record<string, unknown> = { q: request.query };
      if (request.num) body.num = request.num;
      if (request.page && request.page > 1) body.page = request.page;
      if (request.country) body.gl = request.country;
      if (request.language) body.hl = request.language;
      if (request.dateRange) body.tbs = DATE_MAP[request.dateRange];

      const data = await makeRequest(endpoint, body);

      const results: SearchResult[] = [];

      if (type === 'web') {
        for (const [i, r] of (data.organic || []).entries()) {
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
        for (const [i, r] of (data.images || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            imageUrl: r.imageUrl,
            imageWidth: r.imageWidth,
            imageHeight: r.imageHeight,
            domain: r.domain,
            thumbnail: r.thumbnailUrl,
          });
        }
      } else if (type === 'news') {
        for (const [i, r] of (data.news || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            source: r.source,
            datePublished: r.date,
            thumbnail: r.imageUrl,
          });
        }
      } else if (type === 'videos') {
        for (const [i, r] of (data.videos || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.link || '',
            description: r.snippet || '',
            duration: r.duration,
            channel: r.channel,
            thumbnail: r.imageUrl,
            datePublished: r.date,
          });
        }
      } else if (type === 'places') {
        for (const [i, r] of (data.places || []).entries()) {
          results.push({
            position: i + 1,
            title: r.title || '',
            url: r.website || '',
            description: r.address || '',
            thumbnail: r.imageUrl,
            address: r.address,
            phone: r.phoneNumber,
            rating: r.rating,
            reviewCount: r.ratingCount,
            placeType: r.type,
            hours: r.hours,
          });
        }
      }

      const response: SearchResponse = {
        provider: 'serper',
        query: request.query,
        results,
        searchTime: data.searchParameters?.timeTaken ? data.searchParameters.timeTaken * 1000 : undefined,
        relatedSearches: data.relatedSearches?.map((r: any) => r.query),
      };

      if (data.peopleAlsoAsk?.length) {
        response.peopleAlsoAsk = data.peopleAlsoAsk.map((p: any) => ({
          question: p.question || '',
          snippet: p.snippet,
          title: p.title,
          url: p.link,
        }));
      }

      if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        response.knowledgePanel = {
          title: kg.title || '',
          type: kg.type,
          description: kg.description,
          source: kg.descriptionSource,
          sourceUrl: kg.descriptionLink,
          imageUrl: kg.imageUrl,
          attributes: kg.attributes,
        };
      }

      if (data.answerBox) {
        response.answerBox = {
          snippet: data.answerBox.snippet || data.answerBox.answer || '',
          title: data.answerBox.title,
          url: data.answerBox.link,
        };
      }

      return response;
    },
  };
}
