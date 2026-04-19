# Smart Shopper

**Project brief:** Smart Shopper — AI-powered shopping companion browser extension.

Smart Shopper is a Chrome extension that detects when you're viewing a product page and surfaces an AI-generated analysis panel — verdict, deal score, pros & cons, review quality signals, and alternative recommendations — without ever leaving the page.

→ [Read the full overview](overview.md)

---

## Quick start

1. Clone this repo
2. Run `node create_icons.js` to generate extension icons
3. Go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder
4. Click the extension icon → enter your [OpenRouter API key](https://openrouter.ai/keys) → Save
5. Open any product page on Amazon, Best Buy, Walmart, Target, eBay, or Newegg and click the **Smart Shopper** button

## Structure

```
extension/   Chrome extension (Manifest V3)
landing/     Static landing page
```
