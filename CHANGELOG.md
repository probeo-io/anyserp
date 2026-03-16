# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-16

### Added

- SearchAPI provider adapter (searchapi.io)
- ValueSERP provider adapter
- ScrapingDog provider adapter
- Bright Data SERP API provider adapter
- SearchCans provider adapter
- 11 total providers now supported

## [0.1.0] - 2026-03-16

### Added

- AnySerp client with `search()`, `searchWithFallback()`, `searchAll()`
- Provider adapters for Serper, SerpAPI, Google CSE, Bing, Brave, and DataForSEO
- Unified `SearchResponse` format across all providers
- Web, image, news, and video search types
- Knowledge panel and answer box extraction (Serper, SerpAPI, DataForSEO)
- Provider routing via `provider/query` prefix
- Fallback routing across multiple providers
- Search all providers in parallel
- Default search options (num, country, language, safe)
- Provider aliases
