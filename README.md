# @probeo/anyserp

[![npm version](https://img.shields.io/npm/v/@probeo/anyserp)](https://www.npmjs.com/package/@probeo/anyserp)
[![npm downloads](https://img.shields.io/npm/dm/@probeo/anyserp)](https://www.npmjs.com/package/@probeo/anyserp)
[![license](https://img.shields.io/npm/l/@probeo/anyserp)](https://github.com/probeo-io/anyserp/blob/main/LICENSE)
[![CI](https://github.com/probeo-io/anyserp/actions/workflows/ci.yml/badge.svg)](https://github.com/probeo-io/anyserp/actions/workflows/ci.yml)

Unified SERP API router. Route search requests across Google, Bing, Brave, and more with a single API. Self-hosted, zero fees.

## Why anyserp?

One SDK, 11 SERP providers. Switch providers without changing your code. Every provider returns the same unified response format, so your application logic stays clean regardless of which provider is behind the request. Your API keys, your infrastructure, zero routing fees. Use `searchWithFallback()` to try the next eligible provider after a failure; `search()` makes a single provider attempt.

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

| Provider | Env Var | Web | Images | News | Videos | Places |
|----------|---------|-----|--------|------|--------|--------|
| Serper | `SERPER_API_KEY` | Yes | Yes | Yes | Yes | Yes |
| SerpAPI | `SERPAPI_API_KEY` | Yes | Yes | Yes | Yes | Yes |
| Google CSE | `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ENGINE_ID` | Yes | Yes | No | No | No |
| Bing | `BING_API_KEY` | Yes | Yes | Yes | Yes | No |
| Brave | `BRAVE_API_KEY` | Yes | Yes | Yes | Yes | No |
| DataForSEO | `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | Yes | No | Yes | No | No |
| SearchAPI | `SEARCHAPI_API_KEY` | Yes | Yes | Yes | Yes | Yes |
| ValueSERP | `VALUESERP_API_KEY` | Yes | Yes | Yes | Yes | No |
| ScrapingDog | `SCRAPINGDOG_API_KEY` | Yes | Yes | Yes | No | No |
| Bright Data | `BRIGHTDATA_API_KEY` | Yes | Yes | Yes | Yes | No |
| SearchCans | `SEARCHCANS_API_KEY` | Yes | No | Yes | No | No |

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

## See Also

| Package | Description |
|---|---|
| [anyserp-py](https://github.com/probeo-io/anyserp-py) | Python version of this package |
| [anyserp-go](https://github.com/probeo-io/anyserp-go) | Go version of this package |
| [@probeo/anymodel](https://github.com/probeo-io/anymodel) | Unified LLM router for TypeScript |
| [@probeo/workflow](https://github.com/probeo-io/workflow) | Stage-based pipeline engine for TypeScript |

## Support

If anyserp is useful to you, consider giving it a star. It helps others discover the project.

## License

MIT

## Explicit default provider (0.6.0 source)

Set `new AnySerp({ defaultProvider: 'brave' })` to keep unprefixed `search()` routing stable when more API keys are added. Use a registered provider name, not an alias. A recognized `provider/query` prefix or alias overrides this default. An empty, unavailable, or type-incompatible default rejects with code 400 without a provider request. When unset, legacy routing uses the first registered provider supporting the requested type. This option does not reorder fallback or parallel searches.

## Provider failure diagnostics

`searchWithFallbackDetailed(request, providers?)` returns `{ response, failures }`, including failures before the first success. When every attempted provider fails, both fallback methods throw `AnySerpAggregateError` (also an `AnySerpError`) with ordered `.failures`. Its code comes from the final attempted error if that error is an `AnySerpError`, otherwise 502. No eligible fallback provider gives code 400. Unconfigured and unsupported entries are skipped.

`searchAllDetailed(request)` returns `{ responses, failures }` in registration order within each list, including synchronous adapter errors. `searchAll()` retains its successful-response array and returns `[]` when all providers fail or none qualify. Each failure is `{ provider, error }`; diagnostics belong to the individual request. Raw error objects may contain sensitive upstream details: inspect and redact before persisting them. The library does not log them automatically.

```typescript
const { responses, failures } = await client.searchAllDetailed({ query: 'typescript' });
// Inspect provider identities without persisting raw upstream errors.
console.log(responses.length, failures.map(failure => failure.provider));
```

Fallback and parallel methods retain their existing request semantics: they do not apply `config.defaults` or parse query prefixes. Fallback provider lists use registered names.

## Places search

Serper, SerpAPI, and SearchAPI support `type: 'places'`; other adapters do not. SearchAPI uses `google_maps`, SerpAPI uses `google_local`, and Serper uses `/places` internally.

```typescript
const places = await client.search({ query: 'serper/coffee in Austin', type: 'places' });
console.log(places.results.map(place => ({ name: place.title, kgmid: place.kgmid })));
```

Place results may include address, phone, rating, reviewCount, placeType, hours, coordinates, and `kgmid` (Google Knowledge Graph identifier). Fields are optional and depend on upstream data; `kgmid` is not guaranteed.

## Runtime and ports

The JavaScript package targets ES2022 and uses global `fetch` and `process.env`; existing checks cover Node 18, 20, and 22. Cloudflare Workers need Node.js compatibility (`nodejs_compat`) because provider registration reads `process.env`, even when a provider key is supplied explicitly. Supply Worker secrets through explicit configuration; do not assume bindings are automatically environment variables.

The Python and Go ports are independently versioned. Their existence does not imply JavaScript feature or release parity. Consumer upgrades and publication remain separate from this source cleanup.
