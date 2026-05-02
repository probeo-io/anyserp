import type { SearchAdapter, SearchRequest, SearchResponse, SearchResult, SearchType, KnowledgePanel, AnswerBox, AiOverview, AiOverviewTextBlock, AiOverviewReference } from '../types.js';
import { AnySerpError } from '../types.js';

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';

const SUPPORTED_TYPES: readonly SearchType[] = ['web', 'images', 'news', 'videos', 'places'];

const ENGINE_MAP: Partial<Record<SearchType, string>> = {
  web: 'google',
  images: 'google_images',
  news: 'google_news',
  videos: 'google_videos',
  places: 'google_maps',
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
      } else if (type === 'places') {
        for (const [i, r] of (data.local_results || []).entries()) {
          results.push({
            position: i + 1,
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
            kgmid: r.kgmid,
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

      // AI Overview: extract page_token from search results and optionally fetch full content
      const pageToken = data.ai_overview?.page_token;
      if (pageToken && request.includeAiOverview) {
        try {
          const aiData = await makeRequest({
            engine: 'google_ai_overview',
            page_token: pageToken,
          });
          response.aiOverview = mapAiOverview(aiData, pageToken);
        } catch {
          // AI overview fetch failed — don't fail the whole search
        }
      } else if (pageToken) {
        // Still expose the page token so callers can fetch later
        response.aiOverview = {
          textBlocks: [],
          references: [],
          pageToken,
        };
      }

      return response;
    },
  };
}

function mapTextBlock(block: any): AiOverviewTextBlock {
  const mapped: AiOverviewTextBlock = {
    type: block.type || 'paragraph',
  };
  if (block.answer) mapped.answer = block.answer;
  if (block.answer_highlight) mapped.answerHighlight = block.answer_highlight;
  if (block.link) mapped.link = block.link;
  if (block.reference_indexes?.length) mapped.referenceIndexes = block.reference_indexes;
  if (block.related_searches?.length) {
    mapped.relatedSearches = block.related_searches.map((rs: any) => ({
      query: rs.query || '',
      link: rs.link,
    }));
  }

  // Nested items (lists)
  if (block.items?.length) {
    mapped.items = block.items.map(mapTextBlock);
  }

  // Table
  if (block.table) {
    mapped.table = {
      headers: block.table.headers || [],
      rows: block.table.rows || [],
    };
  }

  // Code
  if (block.type === 'code_blocks') {
    mapped.language = block.language;
    mapped.code = block.code;
  }

  // Video
  if (block.type === 'video') {
    mapped.video = {
      title: block.title,
      link: block.link,
      duration: block.duration,
      source: block.source,
      channel: block.channel,
    };
  }

  return mapped;
}

function mapAiOverview(data: any, pageToken: string): AiOverview {
  const textBlocks: AiOverviewTextBlock[] = (data.text_blocks || []).map(mapTextBlock);

  const references: AiOverviewReference[] = (data.reference_links || []).map((ref: any) => ({
    index: ref.index,
    title: ref.title,
    url: ref.link,
    snippet: ref.snippet,
    date: ref.date,
    source: ref.source,
    thumbnail: ref.thumbnail,
  }));

  return {
    markdown: data.markdown,
    textBlocks,
    references,
    pageToken,
  };
}
