// ─── Search Request ──────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  num?: number;           // number of results (default 10)
  page?: number;          // page number (default 1)
  country?: string;       // country code (e.g., "us", "gb")
  language?: string;      // language code (e.g., "en", "fr")
  safe?: boolean;         // safe search
  type?: SearchType;      // web, images, news, videos
  dateRange?: DateRange;  // time filter
}

export type SearchType = 'web' | 'images' | 'news' | 'videos';

export type DateRange = 'day' | 'week' | 'month' | 'year';

// ─── Search Response ─────────────────────────────────────────────────────────

export interface SearchResponse {
  provider: string;
  query: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;    // ms
  relatedSearches?: string[];
  knowledgePanel?: KnowledgePanel;
  answerBox?: AnswerBox;
}

export interface SearchResult {
  position: number;
  title: string;
  url: string;
  description: string;
  domain?: string;
  datePublished?: string;
  thumbnail?: string;
  // Image-specific
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  // News-specific
  source?: string;
  // Video-specific
  duration?: string;
  channel?: string;
}

export interface KnowledgePanel {
  title: string;
  type?: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  attributes?: Record<string, string>;
  imageUrl?: string;
}

export interface AnswerBox {
  snippet: string;
  title?: string;
  url?: string;
}

// ─── Provider Adapter ────────────────────────────────────────────────────────

export interface SearchAdapter {
  readonly name: string;
  search(request: SearchRequest): Promise<SearchResponse>;
  supportsType(type: SearchType): boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface AnySerpErrorMetadata {
  provider_name?: string;
  raw?: unknown;
}

export class AnySerpError extends Error {
  readonly code: number;
  readonly metadata: AnySerpErrorMetadata;

  constructor(code: number, message: string, metadata: AnySerpErrorMetadata = {}) {
    super(message);
    this.name = 'AnySerpError';
    this.code = code;
    this.metadata = metadata;
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  apiKey?: string;
  engineId?: string;     // Google CSE engine ID
}

export interface DataForSeoConfig {
  login?: string;
  password?: string;
}

export interface AnySerpConfig {
  serper?: ProviderConfig;
  serpapi?: ProviderConfig;
  google?: ProviderConfig;
  bing?: ProviderConfig;
  brave?: ProviderConfig;
  dataforseo?: DataForSeoConfig;
  searchapi?: ProviderConfig;
  valueserp?: ProviderConfig;
  scrapingdog?: ProviderConfig;
  brightdata?: ProviderConfig;
  searchcans?: ProviderConfig;
  custom?: Record<string, { baseURL: string; apiKey?: string }>;
  defaults?: {
    num?: number;
    country?: string;
    language?: string;
    safe?: boolean;
  };
  aliases?: Record<string, string>;
}
