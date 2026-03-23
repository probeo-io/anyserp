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
  /** Fetch AI Overview content when available (requires SearchAPI). */
  includeAiOverview?: boolean;
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
  peopleAlsoAsk?: PeopleAlsoAsk[];
  knowledgePanel?: KnowledgePanel;
  answerBox?: AnswerBox;
  aiOverview?: AiOverview;
}

// ─── AI Overview ──────────────────────────────────────────────────────────────

export interface AiOverview {
  /** Markdown-formatted AI overview content. */
  markdown?: string;
  /** Structured text blocks. */
  textBlocks: AiOverviewTextBlock[];
  /** Sources cited in the overview. */
  references: AiOverviewReference[];
  /** Page token used to fetch this overview (for caching/debugging). */
  pageToken?: string;
}

export interface AiOverviewTextBlock {
  type: 'paragraph' | 'header' | 'ordered_list' | 'unordered_list' | 'table' | 'code_blocks' | 'video';
  /** The text content. */
  answer?: string;
  /** Highlighted portion of the answer. */
  answerHighlight?: string;
  /** Nested items (for list types). */
  items?: AiOverviewTextBlock[];
  /** Table data (for table type). */
  table?: { headers: string[]; rows: string[][] };
  /** Code language (for code_blocks type). */
  language?: string;
  /** Code content (for code_blocks type). */
  code?: string;
  /** Video metadata. */
  video?: { title?: string; link?: string; duration?: string; source?: string; channel?: string };
  /** Indexes into the references array. */
  referenceIndexes?: number[];
  /** Link associated with this block. */
  link?: string;
  /** Related searches within this block. */
  relatedSearches?: { query: string; link?: string }[];
}

export interface PeopleAlsoAsk {
  question: string;
  snippet?: string;
  title?: string;
  url?: string;
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

export interface AiOverviewReference {
  index: number;
  title?: string;
  url?: string;
  snippet?: string;
  date?: string;
  source?: string;
  thumbnail?: string;
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
