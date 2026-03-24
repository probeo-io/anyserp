# @probeo/anyserp

Unified SERP API router. Route search requests across Google, Bing, Brave, and more with a single API. Self-hosted, zero fees.

## Install

```bash
npm install @probeo/anyserp
```

## Quick Start

Set your API keys as environment variables:

```bash
export SERPER_API_KEY=...
export BRAVE_API_KEY=...
```

```typescript
import { AnySerp } from "@probeo/anyserp";

const client = new AnySerp();

// Search with the first available provider
const results = await client.search("best typescript frameworks");
console.log(results.results[0].title, results.results[0].url);
```

## Supported Providers

| Provider | Env Var | Web | Images | News | Videos |
|----------|---------|-----|--------|------|--------|
| Serper | `SERPER_API_KEY` | Yes | Yes | Yes | Yes |
| SerpAPI | `SERPAPI_API_KEY` | Yes | Yes | Yes | Yes |
| Google CSE | `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ENGINE_ID` | Yes | Yes | No | No |
| Bing | `BING_API_KEY` | Yes | Yes | Yes | Yes |
| Brave | `BRAVE_API_KEY` | Yes | Yes | Yes | Yes |
| DataForSEO | `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | Yes | No | Yes | No |
| SearchAPI | `SEARCHAPI_API_KEY` | Yes | Yes | Yes | Yes |
| ValueSERP | `VALUESERP_API_KEY` | Yes | Yes | Yes | Yes |
| ScrapingDog | `SCRAPINGDOG_API_KEY` | Yes | Yes | Yes | No |
| Bright Data | `BRIGHTDATA_API_KEY` | Yes | Yes | Yes | Yes |
| SearchCans | `SEARCHCANS_API_KEY` | Yes | No | Yes | No |

## Provider Routing

Specify a provider with `provider/query` format:

```typescript
// Use a specific provider
const results = await client.search("serper/typescript frameworks");

// Or just search with the first available
const results = await client.search("typescript frameworks");
```

## Search Options

```typescript
const results = await client.search({
  query: "typescript frameworks",
  num: 20,             // number of results
  page: 2,             // page number
  country: "us",       // country code
  language: "en",      // language code
  safe: true,          // safe search
  type: "web",         // web, images, news, videos
  dateRange: "month",  // day, week, month, year
});
```

## Fallback Routing

Try multiple providers in order. If one fails, the next is attempted:

```typescript
const results = await client.searchWithFallback(
  { query: "typescript frameworks" },
  ["serper", "brave", "bing"],
);
```

## Search All Providers

Search all configured providers and get combined results:

```typescript
const allResults = await client.searchAll({
  query: "typescript frameworks",
});

for (const result of allResults) {
  console.log(`${result.provider}: ${result.results.length} results`);
}
```

## Unified Response Format

All providers return the same `SearchResponse` shape:

```typescript
interface SearchResponse {
  provider: string;
  query: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;
  relatedSearches?: string[];
  knowledgePanel?: KnowledgePanel;
  answerBox?: AnswerBox;
}

interface SearchResult {
  position: number;
  title: string;
  url: string;
  description: string;
  domain?: string;
  datePublished?: string;
  // Image fields
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  // News fields
  source?: string;
  // Video fields
  duration?: string;
  channel?: string;
}
```

## Configuration

### Programmatic

```typescript
const client = new AnySerp({
  serper: { apiKey: "..." },
  brave: { apiKey: "..." },
  google: { apiKey: "...", engineId: "..." },
  dataforseo: { login: "...", password: "..." },
  searchapi: { apiKey: "..." },
  valueserp: { apiKey: "..." },
  scrapingdog: { apiKey: "..." },
  brightdata: { apiKey: "..." },
  searchcans: { apiKey: "..." },
  defaults: {
    num: 10,
    country: "us",
    language: "en",
    safe: true,
  },
  aliases: {
    fast: "serper",
    default: "brave",
  },
});
```

### Environment Variables

```bash
export SERPER_API_KEY=...
export SERPAPI_API_KEY=...
export GOOGLE_CSE_API_KEY=...
export GOOGLE_CSE_ENGINE_ID=...
export BING_API_KEY=...
export BRAVE_API_KEY=...
export DATAFORSEO_LOGIN=...
export DATAFORSEO_PASSWORD=...
export SEARCHAPI_API_KEY=...
export VALUESERP_API_KEY=...
export SCRAPINGDOG_API_KEY=...
export BRIGHTDATA_API_KEY=...
export SEARCHCANS_API_KEY=...
```

## People Also Ask

Available from 8 providers (Serper, SerpAPI, SearchAPI, ValueSERP, DataForSEO, ScrapingDog, Bright Data, SearchCans):

```typescript
const results = await client.search("how to start an LLC");
for (const paa of results.peopleAlsoAsk ?? []) {
  console.log(paa.question, paa.snippet);
}
```

## AI Overview

Fetch Google's AI-generated overview content (requires SearchAPI):

```typescript
const results = await client.search({
  query: "how to start an LLC",
  includeAiOverview: true,
});

if (results.aiOverview) {
  console.log(results.aiOverview.markdown);
  for (const ref of results.aiOverview.references) {
    console.log(`  [${ref.index}] ${ref.title} - ${ref.url}`);
  }
}
```

## Also Available

- **Python**: [`anyserp`](https://github.com/probeo-io/anyserp-py) on PyPI
- **Go**: [`anyserp-go`](https://github.com/probeo-io/anyserp-go)

## License

MIT
