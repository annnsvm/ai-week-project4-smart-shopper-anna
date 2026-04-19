// Smart Shopper — background service worker
// Handles Claude API calls away from the content script context

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PRODUCT') {
    analyzeProduct(message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.sync.get('apiKey').then(({ apiKey }) => sendResponse({ apiKey }));
    return true;
  }
});

async function analyzeProduct(product) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) throw new Error('NO_API_KEY');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'chrome-extension://smart-shopper',
      'X-Title': 'Smart Shopper',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: 'You are a sharp, honest shopping advisor. You help people decide whether a product is worth buying based on available page data. Be direct and specific — not generic. Identify real tradeoffs.',
        },
        { role: 'user', content: buildPrompt(product) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message || `API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse AI response');

  return JSON.parse(match[0]);
}

function buildPrompt(p) {
  const lines = [
    `Product: ${p.name ?? 'Unknown'}`,
    `Price: ${p.price ?? 'Unknown'}`,
    `Site: ${p.site ?? 'Unknown'}`,
    `Rating: ${p.rating ?? 'N/A'} (${p.reviewCount ?? '?'} reviews)`,
  ];
  if (p.category) lines.push(`Category: ${p.category}`);
  if (p.features?.length) lines.push(`Features:\n${p.features.slice(0, 6).map(f => `  • ${f}`).join('\n')}`);
  if (p.description) lines.push(`Description: ${p.description.slice(0, 400)}`);
  if (p.reviews?.length) lines.push(`Sample reviews:\n${p.reviews.slice(0, 4).map(r => `  "${r.slice(0, 200)}"`).join('\n')}`);

  return `${lines.join('\n')}

Analyze this product and respond with ONLY valid JSON in this exact shape:

{
  "verdict": "buy" | "consider" | "skip",
  "confidence": <1-10>,
  "summary": "<2-3 sentence honest overall assessment>",
  "dealScore": <1-10>,
  "dealExplanation": "<one sentence: is this price competitive / fair / overpriced?>",
  "pros": ["<pro1>", "<pro2>", "<pro3>"],
  "cons": ["<con1>", "<con2>", "<con3>"],
  "reviewQuality": "high" | "medium" | "low" | "insufficient",
  "reviewNote": "<one sentence about review trustworthiness or patterns>",
  "bestFor": "<who this is genuinely ideal for>",
  "notFor": "<who should look elsewhere and why>",
  "alternatives": ["<alternative 1 with brief why>", "<alternative 2 with brief why>"],
  "quickTip": "<one actionable thing to do before buying>"
}`;
}
