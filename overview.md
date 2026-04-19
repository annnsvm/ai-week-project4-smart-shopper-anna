# Smart Shopper — Project Overview

## What it is

Smart Shopper is a Chrome extension that acts as an AI shopping advisor while you browse. When you land on a supported product page, a floating button appears in the bottom-right corner. Click it and a side panel slides in with a structured analysis of the product — generated in real time by Claude via the OpenRouter API.

The goal was to reduce the friction of making a confident purchase decision without opening a dozen tabs, cross-referencing Reddit threads, or second-guessing a review rating.

---

## What it does

**Product detection and extraction**
The content script detects whether the current page is a product page (by URL pattern and DOM signals) and runs a site-specific extractor to pull structured data: product name, price, rating, review count, feature bullets, description, and sample review text. Supported sites: Amazon, Best Buy, Walmart, Target, eBay, and Newegg.

**AI analysis panel**
Extracted data is sent to the background service worker, which calls the Claude API (via OpenRouter) and returns a structured JSON analysis. The panel renders:

- **Verdict** — Buy / Consider / Skip with a confidence score
- **Deal Score** — 1–10 rating with a plain-English explanation of whether the price is fair
- **Pros & Cons** — specific to the product, not generic
- **Review Intelligence** — quality badge (Trustworthy / Mixed signals / Suspicious) and a note on patterns
- **Who It's For** — a clear description of the ideal buyer and who should look elsewhere
- **Alternatives** — 2 smarter options to consider before committing
- **Quick Tip** — one actionable thing to do before buying

**Settings popup**
A popup lets users enter and save their OpenRouter API key (stored in `chrome.storage.sync`). The key status is shown inline so it's always clear whether the extension is ready to use.

**Landing page**
A standalone static page (`landing/index.html`) introduces the extension with a live panel mockup, feature cards, a three-step how-it-works section, and a download CTA.

---

## Tools and stack

| Layer | Choice |
|---|---|
| Extension platform | Chrome Manifest V3 |
| AI model | Claude 3 Haiku via OpenRouter |
| API format | OpenAI-compatible (`/v1/chat/completions`) |
| Key storage | `chrome.storage.sync` |
| Styling | Vanilla CSS with scoped class prefix (`ss-`) |
| Icons | Generated with a Node.js script using only built-in `zlib` |
| Landing page | Single-file HTML + embedded CSS, no framework |

No build step, no bundler, no npm dependencies. The extension loads directly from source.

---

## Key decisions

**OpenRouter instead of direct Anthropic API**
OpenRouter provides a single key that routes to any model, which is simpler for users to set up (one place to manage access and billing) and lets the model be swapped without code changes.

**Claude 3 Haiku as the default model**
Haiku is fast, cheap, and more than capable for structured product analysis. The latency feels acceptable inline on a product page. A more capable model can be swapped in by changing one line in `background.js`.

**Scoped CSS instead of Shadow DOM or iframe**
Injecting a full panel into arbitrary shopping site pages risks style conflicts. I used a strict `ss-` class prefix and `#ss-host` container as the scope boundary. It's simpler than Shadow DOM and good enough for this use case since the panel is visually isolated at the bottom-right.

**Structured JSON prompt**
The prompt specifies the exact JSON shape Claude should return. The background script then extracts the first JSON object from the response text rather than relying on strict formatting. This makes the parsing resilient to Claude occasionally adding a sentence before or after the JSON block.

**Floating trigger vs. auto-open**
The panel doesn't auto-open on page load — it waits for user intent. Shopping sites are already busy; injecting a panel automatically would feel intrusive. The trigger button is noticeable but unobtrusive.

---

## What I learned

**DOM extraction is fragile by nature.** Shopping sites update their markup constantly, and each site has meaningful structural differences. Writing site-specific extractors (rather than a generic scraper) produces much better data quality, but it also means maintenance overhead as sites change. A more robust long-term approach would be to parse structured data from `<script type="application/ld+json">` blocks, which are more stable.

**Prompt structure matters more than model size.** Early versions returned verbose prose that was hard to parse and display. Switching to a strict JSON contract in the prompt — with field names, types, and value constraints spelled out — made the output consistent and removed the need for complex post-processing.

**MV3 service workers have no DOM access.** API calls have to happen in the background service worker (not the content script) to avoid CORS issues with the host page's CSP. This is a common MV3 gotcha that forces a clean separation between data extraction (content script) and network calls (service worker).

**OpenRouter model slugs are not always intuitive.** The obvious `anthropic/claude-3.5-sonnet` slug failed with "no endpoints found" — the correct available slug turned out to be `anthropic/claude-3-haiku`. A more robust production implementation would call OpenRouter's `/models` endpoint at startup to validate the model is available before the first analysis request.
