/**
 * Basic usage examples for @probeo/anyserp
 *
 * Set at least one provider API key before running:
 *   export SERPER_API_KEY=...
 *   export BRAVE_API_KEY=...
 *
 * Run with:
 *   npx tsx examples/basic.ts
 */

import { AnySerp } from "../src/index.js";

const client = new AnySerp();

// ── Basic search ─────────────────────────────────────────────────────────────

async function basicSearch() {
  console.log("=== Basic Search ===\n");

  const results = await client.search("best typescript frameworks 2026");

  console.log(`Provider: ${results.provider}`);
  console.log(`Results: ${results.results.length}\n`);
  for (const r of results.results.slice(0, 3)) {
    console.log(`  ${r.title}`);
    console.log(`  ${r.url}\n`);
  }
}

// ── Provider-specific search ─────────────────────────────────────────────────

async function providerSearch() {
  console.log("=== Provider-Specific Search ===\n");

  const results = await client.search("node.js performance tips", {
    provider: "serper",
  });

  console.log(`Provider: ${results.provider}`);
  for (const r of results.results.slice(0, 3)) {
    console.log(`  ${r.title}`);
  }
  console.log();
}

// ── Image search ─────────────────────────────────────────────────────────────

async function imageSearch() {
  console.log("=== Image Search ===\n");

  const results = await client.searchImages("aurora borealis");

  console.log(`Images found: ${results.results.length}`);
  for (const img of results.results.slice(0, 3)) {
    console.log(`  ${img.title} — ${img.url}`);
  }
  console.log();
}

// ── News search ──────────────────────────────────────────────────────────────

async function newsSearch() {
  console.log("=== News Search ===\n");

  const results = await client.searchNews("artificial intelligence");

  for (const article of results.results.slice(0, 3)) {
    console.log(`  ${article.title}`);
    console.log(`  ${article.url}\n`);
  }
}

// ── Run examples ─────────────────────────────────────────────────────────────

async function main() {
  const example = process.argv[2];

  const examples: Record<string, () => Promise<void>> = {
    search: basicSearch,
    provider: providerSearch,
    images: imageSearch,
    news: newsSearch,
  };

  if (example && examples[example]) {
    await examples[example]();
  } else if (!example) {
    for (const [name, fn] of Object.entries(examples)) {
      try {
        await fn();
      } catch (err: any) {
        console.log(`[${name}] Skipped: ${err.message}\n`);
      }
    }
  } else {
    console.log(`Unknown example: ${example}`);
    console.log(`Available: ${Object.keys(examples).join(", ")}`);
  }
}

main().catch(console.error);
