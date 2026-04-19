// Smart Shopper — content script
// Detects product pages, extracts data, injects and manages the shopping panel

(() => {
  'use strict';

  if (document.getElementById('ss-host')) return; // prevent double-injection on SPA nav

  // ─── Site detection ────────────────────────────────────────────────────────

  function detectSite() {
    const h = location.hostname;
    if (h.includes('amazon.')) return 'amazon';
    if (h.includes('bestbuy.')) return 'bestbuy';
    if (h.includes('walmart.')) return 'walmart';
    if (h.includes('target.')) return 'target';
    if (h.includes('ebay.')) return 'ebay';
    if (h.includes('newegg.')) return 'newegg';
    return null;
  }

  function isProductPage(site) {
    const url = location.href;
    const checks = {
      amazon:  () => /\/dp\/|\/gp\/product\//.test(url),
      bestbuy: () => /\/site\/.+\/\d+\.p/.test(url),
      walmart: () => /\/ip\//.test(url),
      target:  () => /\/p\/[A-Za-z0-9-]+-\/-\/A-/.test(url),
      ebay:    () => /\/itm\//.test(url),
      newegg:  () => /\/p\//.test(url),
    };
    return checks[site]?.() ?? false;
  }

  // ─── Site-specific extractors ──────────────────────────────────────────────

  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function text(el) { return el?.textContent?.trim() || null; }

  function extractAmazon() {
    const name = text(qs('#productTitle'));

    const priceEl = qs('.a-price .a-offscreen')
      || qs('#priceblock_ourprice')
      || qs('#priceblock_dealprice')
      || qs('.apexPriceToPay .a-offscreen')
      || qs('[data-a-color="price"] .a-offscreen');
    const price = text(priceEl);

    const ratingTitle = qs('#acrPopover')?.getAttribute('title') || text(qs('.a-icon-star span'));
    const rating = ratingTitle?.match(/[\d.]+/)?.[0] ?? null;
    const reviewCount = text(qs('#acrCustomerReviewText'))?.replace(/[^\d,]/g, '') ?? null;

    const features = qsa('#feature-bullets li:not(.aok-hidden) span.a-list-item')
      .map(el => text(el)).filter(Boolean).slice(0, 7);

    const description = text(qs('#productDescription p'))
      || text(qs('#bookDescription_feature_div'))
      || null;

    const category = qsa('#wayfinding-breadcrumbs_feature_div a')
      .map(a => text(a)).filter(Boolean).pop() ?? null;

    const reviews = qsa('[data-hook="review-body"] span')
      .map(el => text(el)).filter(s => s && s.length > 20).slice(0, 4);

    const imageUrl = qs('#landingImage')?.src || qs('#imgBlkFront')?.src || null;

    const originalPrice = text(qs('.a-text-price .a-offscreen'));

    return { name, price, originalPrice, rating, reviewCount, features, description, category, reviews, imageUrl };
  }

  function extractBestBuy() {
    const name = text(qs('.sku-title h1')) || text(qs('h1.heading-5'));

    const priceWrap = qs('.priceView-hero-price');
    const price = priceWrap
      ? priceWrap.textContent.replace(/\s+/g, ' ').trim().match(/\$[\d,]+(\.\d+)?/)?.[0]
      : null;

    const rating = text(qs('.c-review-average'));
    const reviewCount = qs('.c-reviews')?.textContent?.match(/[\d,]+/)?.[0] ?? null;

    const features = qsa('.feature-list li').map(el => text(el)).filter(Boolean).slice(0, 7);
    const description = text(qs('.product-description'))?.slice(0, 400) ?? null;
    const category = text(qs('.breadcrumb-list a:last-child'));
    const imageUrl = qs('.primary-image img')?.src ?? null;

    return { name, price, rating, reviewCount, features, description, category, imageUrl };
  }

  function extractWalmart() {
    const name = text(qs('[itemprop="name"] h1'))
      || text(qs('h1[itemprop="name"]'))
      || text(qs('h1'));

    const priceAttr = qs('[itemprop="price"]')?.getAttribute('content');
    const price = priceAttr ? `$${priceAttr}` : text(qs('.price-characteristic'));

    const rating = qs('[itemprop="ratingValue"]')?.getAttribute('content')
      || text(qs('[data-testid="stars-container"]'))?.match(/[\d.]+/)?.[0]
      || null;
    const reviewCount = qs('[itemprop="reviewCount"]')?.getAttribute('content') ?? null;

    const features = qsa('.product-description-highlights li')
      .map(el => text(el)).filter(Boolean).slice(0, 7);
    const description = text(qs('[itemprop="description"]'))?.slice(0, 400) ?? null;
    const imageUrl = qs('[data-testid="hero-image-container"] img')?.src ?? null;

    return { name, price, rating, reviewCount, features, description, imageUrl };
  }

  function extractTarget() {
    const name = text(qs('[data-test="product-title"]')) || text(qs('h1'));
    const price = text(qs('[data-test="product-price"]'));
    const ratingText = text(qs('[data-test="ratings"]'));
    const rating = ratingText?.match(/[\d.]+/)?.[0] ?? null;
    const reviewCount = text(qs('[data-test="ratingsCount"]'))?.replace(/[^\d]/g, '') ?? null;
    const description = text(qs('[data-test="item-details-description"]'))?.slice(0, 400) ?? null;
    const imageUrl = qs('[data-test="product-image"] img')?.src ?? null;

    return { name, price, rating, reviewCount, description, imageUrl };
  }

  function extractEbay() {
    const name = text(qs('.x-item-title .ux-textspans--BOLD'))
      || text(qs('h1.x-item-title__mainTitle'));
    const price = text(qs('.x-price-primary .ux-textspans'));
    const rating = text(qs('.reviews-summary'))?.match(/[\d.]+/)?.[0] ?? null;

    const features = qsa('.ux-labels-values__values-content')
      .slice(0, 6).map(el => text(el)).filter(Boolean);
    const description = text(qs('.ux-layout-section--features'))?.slice(0, 400) ?? null;
    const imageUrl = qs('.ux-image-carousel-item.active img')?.src ?? null;

    return { name, price, rating, features, description, imageUrl };
  }

  function extractNewegg() {
    const name = text(qs('.product-title'));
    const price = text(qs('.price-current'));
    const rating = text(qs('.product-rating .rating'))?.match(/[\d.]+/)?.[0] ?? null;
    const reviewCount = text(qs('.product-rating a'))?.replace(/[^\d]/g, '') ?? null;

    const features = qsa('.product-bullets li')
      .map(el => text(el)).filter(Boolean).slice(0, 7);
    const description = text(qs('.product-details-content'))?.slice(0, 400) ?? null;
    const imageUrl = qs('.product-view-img-original')?.src ?? null;

    return { name, price, rating, reviewCount, features, description, imageUrl };
  }

  const extractors = { amazon: extractAmazon, bestbuy: extractBestBuy, walmart: extractWalmart, target: extractTarget, ebay: extractEbay, newegg: extractNewegg };

  // ─── Panel rendering ───────────────────────────────────────────────────────

  function renderStars(rating) {
    if (!rating) return '';
    const r = parseFloat(rating);
    const full = Math.floor(r);
    const half = r % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  function verdictConfig(verdict) {
    const map = {
      buy:     { label: 'BUY IT',   cls: 'ss-verdict--buy',     icon: '✓' },
      consider:{ label: 'CONSIDER', cls: 'ss-verdict--consider', icon: '~' },
      skip:    { label: 'SKIP IT',  cls: 'ss-verdict--skip',     icon: '✕' },
    };
    return map[verdict] ?? map.consider;
  }

  function dealScoreBar(score) {
    const pct = Math.round((score / 10) * 100);
    const cls = score >= 7 ? 'ss-bar--good' : score >= 4 ? 'ss-bar--ok' : 'ss-bar--poor';
    return `
      <div class="ss-bar-wrap">
        <div class="ss-bar ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="ss-score-label">${score}/10</span>`;
  }

  function reviewQualityBadge(q) {
    const map = {
      high:        { cls: 'ss-badge--green',  label: 'Trustworthy' },
      medium:      { cls: 'ss-badge--yellow', label: 'Mixed signals' },
      low:         { cls: 'ss-badge--red',    label: 'Suspicious' },
      insufficient:{ cls: 'ss-badge--gray',   label: 'Too few reviews' },
    };
    const cfg = map[q] ?? map.medium;
    return `<span class="ss-badge ${cfg.cls}">${cfg.label}</span>`;
  }

  function renderLoading() {
    return `
      <div class="ss-loading">
        <div class="ss-spinner"></div>
        <p>Analyzing this product…</p>
      </div>`;
  }

  function renderError(msg) {
    if (msg === 'NO_API_KEY') {
      return `
        <div class="ss-error">
          <div class="ss-error-icon">🔑</div>
          <p><strong>API key required</strong></p>
          <p>Add your Anthropic API key in the extension settings to get AI-powered shopping analysis.</p>
          <button class="ss-btn ss-btn--primary" id="ss-open-settings">Open Settings</button>
        </div>`;
    }
    return `
      <div class="ss-error">
        <div class="ss-error-icon">⚠️</div>
        <p><strong>Analysis failed</strong></p>
        <p class="ss-muted">${msg}</p>
        <button class="ss-btn ss-btn--secondary" id="ss-retry">Try Again</button>
      </div>`;
  }

  function renderProduct(product) {
    const stars = renderStars(product.rating);
    const reviewText = product.reviewCount ? `${Number(product.reviewCount.replace(/,/g, '')).toLocaleString()} reviews` : '';
    const imageHtml = product.imageUrl
      ? `<img class="ss-product-img" src="${product.imageUrl}" alt="" />`
      : `<div class="ss-product-img ss-product-img--placeholder">🛍</div>`;

    return `
      <div class="ss-product-card">
        ${imageHtml}
        <div class="ss-product-info">
          <p class="ss-product-name">${product.name ?? 'Product'}</p>
          ${product.price ? `<p class="ss-product-price">${product.price}</p>` : ''}
          ${stars ? `<p class="ss-product-rating"><span class="ss-stars">${stars}</span><span class="ss-muted">${reviewText}</span></p>` : ''}
        </div>
      </div>`;
  }

  function renderAnalysis(analysis) {
    const vc = verdictConfig(analysis.verdict);

    const prosHtml = analysis.pros?.map(p => `<li class="ss-pro"><span class="ss-check">✓</span>${p}</li>`).join('') ?? '';
    const consHtml = analysis.cons?.map(c => `<li class="ss-con"><span class="ss-x">✕</span>${c}</li>`).join('') ?? '';
    const altHtml  = analysis.alternatives?.map(a => `<li>${a}</li>`).join('') ?? '';

    return `
      <div class="ss-section ss-verdict-section">
        <div class="ss-verdict ${vc.cls}">
          <span class="ss-verdict-icon">${vc.icon}</span>
          <span class="ss-verdict-label">${vc.label}</span>
          <span class="ss-confidence">Confidence: ${analysis.confidence}/10</span>
        </div>
        <p class="ss-summary">${analysis.summary}</p>
      </div>

      <div class="ss-section">
        <div class="ss-section-title">
          <span>Deal Score</span>
          ${dealScoreBar(analysis.dealScore)}
        </div>
        <p class="ss-muted ss-deal-note">${analysis.dealExplanation}</p>
      </div>

      <div class="ss-section">
        <div class="ss-section-title">Pros & Cons</div>
        <div class="ss-pros-cons">
          <ul class="ss-list">${prosHtml}</ul>
          <ul class="ss-list">${consHtml}</ul>
        </div>
      </div>

      <div class="ss-section">
        <div class="ss-section-title">Review Intelligence</div>
        <div class="ss-review-row">${reviewQualityBadge(analysis.reviewQuality)}<span class="ss-muted">${analysis.reviewNote}</span></div>
      </div>

      <div class="ss-section">
        <div class="ss-section-title">Who It's For</div>
        <div class="ss-for-row">
          <div class="ss-for-card ss-for-card--yes">
            <span class="ss-for-icon">👍</span>
            <p>${analysis.bestFor}</p>
          </div>
          <div class="ss-for-card ss-for-card--no">
            <span class="ss-for-icon">👎</span>
            <p>${analysis.notFor}</p>
          </div>
        </div>
      </div>

      ${altHtml ? `
      <div class="ss-section">
        <div class="ss-section-title">Consider Instead</div>
        <ul class="ss-alternatives">${altHtml}</ul>
      </div>` : ''}

      ${analysis.quickTip ? `
      <div class="ss-tip">
        <span class="ss-tip-icon">💡</span>
        <p>${analysis.quickTip}</p>
      </div>` : ''}`;
  }

  // ─── Panel lifecycle ───────────────────────────────────────────────────────

  function buildPanel(product) {
    const host = document.createElement('div');
    host.id = 'ss-host';
    document.body.appendChild(host);

    host.innerHTML = `
      <button id="ss-trigger" aria-label="Open Smart Shopper">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <span>Smart Shopper</span>
      </button>

      <div id="ss-panel" role="dialog" aria-label="Smart Shopper panel">
        <div id="ss-panel-header">
          <div class="ss-header-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            Smart Shopper
          </div>
          <div class="ss-header-actions">
            <button class="ss-icon-btn" id="ss-settings-btn" title="Settings">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
            <button class="ss-icon-btn" id="ss-close-btn" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div id="ss-panel-body">
          ${renderProduct(product)}
          <div id="ss-analysis">${renderLoading()}</div>
        </div>
      </div>
    `;

    // Wire up toggle
    const trigger = host.querySelector('#ss-trigger');
    const panel   = host.querySelector('#ss-panel');
    const closeBtn = host.querySelector('#ss-close-btn');
    const settingsBtn = host.querySelector('#ss-settings-btn');

    trigger.addEventListener('click', () => {
      const isOpen = panel.classList.contains('ss-panel--open');
      panel.classList.toggle('ss-panel--open', !isOpen);
      trigger.classList.toggle('ss-trigger--open', !isOpen);
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('ss-panel--open');
      trigger.classList.remove('ss-trigger--open');
    });

    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    // Delegate retry / settings buttons that appear inside analysis
    host.querySelector('#ss-panel-body').addEventListener('click', e => {
      if (e.target.id === 'ss-retry') requestAnalysis(product, host);
      if (e.target.id === 'ss-open-settings') chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    return host;
  }

  function requestAnalysis(product, host) {
    const analysisEl = host.querySelector('#ss-analysis');
    analysisEl.innerHTML = renderLoading();

    chrome.runtime.sendMessage({ type: 'ANALYZE_PRODUCT', data: product }, response => {
      if (chrome.runtime.lastError || !response) {
        analysisEl.innerHTML = renderError('Connection lost. Please retry.');
        return;
      }
      if (response.error) {
        analysisEl.innerHTML = renderError(response.error);
        return;
      }
      analysisEl.innerHTML = renderAnalysis(response);
    });
  }

  // ─── Entry point ───────────────────────────────────────────────────────────

  function init() {
    const site = detectSite();
    if (!site || !isProductPage(site)) return;

    const extractor = extractors[site];
    if (!extractor) return;

    const product = extractor();
    product.site = site;

    if (!product.name) return; // not enough data to be useful

    const host = buildPanel(product);
    requestAnalysis(product, host);
  }

  // Small delay to let SPAs finish rendering key elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
  } else {
    setTimeout(init, 800);
  }
})();
