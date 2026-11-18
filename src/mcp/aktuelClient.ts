import { searchAkakce } from './akakceClient.ts';
import {
  classifyAktuelCategory,
  expandSearchVariants,
  normalizeTr,
  scoreProductMatch,
} from '../utils/aktuelSearch.ts';
import type {
  AktuelBasketMatch,
  AktuelBrochure,
  AktuelCampaign,
  AktuelCategory,
  AktuelMarketCheckResult,
  AktuelProduct,
  AktuelSearchResponse,
  AktuelSortBy,
  AktuelTimingStatus,
  AktuelWeeklySummaryResponse,
  MarketCatalogSnapshot,
  MarketFilter,
  MarketId,
} from './types.ts';

export { classifyAktuelCategory, normalizeTr };

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes for weekly catalogs
const MARKET_CACHE = new Map<MarketId, { expiresAt: number; data: MarketCatalogSnapshot }>();
const IN_FLIGHT_MARKET = new Map<MarketId, Promise<MarketCatalogSnapshot>>();

const TR_MONTHS: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

const TR_DAYS = [
  { key: 'pazartesi', label: 'Pazartesi' },
  { key: 'sali', label: 'Salı' },
  { key: 'carsamba', label: 'Çarşamba' },
  { key: 'persembe', label: 'Perşembe' },
  { key: 'cuma', label: 'Cuma' },
  { key: 'cumartesi', label: 'Cumartesi' },
  { key: 'pazar', label: 'Pazar' },
];

// Turkish normalization & category classification imported from ../utils/aktuelSearch.ts

function decodeHtml(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTurkishPrice(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);
    return Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
  }
  if (/\d\.\d{3}$/.test(cleaned)) {
    const val = parseFloat(cleaned.replace(/\./g, ''));
    return Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
  }
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
}

function formatTry(val: number): string {
  return `${val.toLocaleString('tr-TR', {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function getIstanbulTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseTurkishDateInfo(label: string): {
  validFrom: string;
  validEnd: string;
  dayLabel: string;
  timingStatus: AktuelTimingStatus;
} {
  const todayIso = getIstanbulTodayIso();
  const currentYear = Number(todayIso.slice(0, 4));
  const norm = normalizeTr(label);

  // Match patterns like "14-20 kasim", "03-30 kasim", "19 kasim 2026", "20 kasim cuma"
  const rangeMatch = norm.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?/);
  const singleMatch = norm.match(/(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?/);

  let validFrom = todayIso;
  let validEnd = addDaysIso(todayIso, 6);

  if (rangeMatch) {
    const d1 = Math.min(31, Math.max(1, parseInt(rangeMatch[1], 10)));
    const d2 = Math.min(31, Math.max(1, parseInt(rangeMatch[2], 10)));
    const monthNum = TR_MONTHS[rangeMatch[3]];
    const yearNum = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : currentYear;
    if (monthNum) {
      validFrom = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
      validEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
    }
  } else if (singleMatch && TR_MONTHS[singleMatch[2]]) {
    const d = Math.min(31, Math.max(1, parseInt(singleMatch[1], 10)));
    const monthNum = TR_MONTHS[singleMatch[2]];
    const yearNum = singleMatch[3] ? parseInt(singleMatch[3], 10) : currentYear;
    validFrom = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    validEnd = addDaysIso(validFrom, 6);
  }

  let dayLabel = 'Haftalık';
  for (const d of TR_DAYS) {
    if (norm.includes(d.key)) {
      dayLabel = d.label;
      break;
    }
  }
  if (dayLabel === 'Haftalık' && /^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    const dt = new Date(`${validFrom}T12:00:00Z`);
    const weekday = dt.getUTCDay(); // 0=Sun..6=Sat
    const map = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    dayLabel = map[weekday] ?? 'Haftalık';
  }

  let timingStatus: AktuelTimingStatus = 'aktif';
  if (validFrom > todayIso) {
    timingStatus = 'yaklasan';
  } else if (validEnd < todayIso) {
    timingStatus = 'gecmis';
  } else {
    timingStatus = 'aktif';
  }

  return { validFrom, validEnd, dayLabel, timingStatus };
}

// classifyAktuelCategory is imported & re-exported from ../utils/aktuelSearch.ts

function inferBrandFromTitle(title: string): string {
  const cleaned = title.trim();
  if (!cleaned) return '';
  const first = cleaned.split(/\s+/)[0] ?? '';
  if (first.length >= 2 && !/^\d/.test(first)) {
    return first;
  }
  return '';
}

function makeProductId(market: MarketId, campaignKey: string, title: string, price: number): string {
  const base = normalizeTr(`${market}-${campaignKey}-${title}`).replace(/\s+/g, '-').slice(0, 64);
  return `${base}-${Math.round(price * 100)}`;
}

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${url})`);
  }
  return res.text();
}

// ============================================================================
// 1. BİM LIVE PARSER (https://www.bim.com.tr)
// ============================================================================

async function fetchBimCatalog(): Promise<MarketCatalogSnapshot> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];
  const baseUrl = 'https://www.bim.com.tr';
  const mainPageUrl = `${baseUrl}/Categories/100/aktuel-urunler.aspx`;

  const mainHtml = await fetchHtml(mainPageUrl);

  // Extract date tabs: href="/Categories/100/aktuel-urunler.aspx?top=1&Bim_AktuelTarihKey=1712"
  const tabMap = new Map<string, { key: string; title: string; url: string }>();
  for (const m of mainHtml.matchAll(
    /<a[^>]*href=["']([^"']*Bim_AktuelTarihKey=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const key = m[2];
    const title = decodeHtml(m[3]);
    if (!title || title.length < 3 || tabMap.has(key)) continue;
    const rawHref = m[1].replace(/&amp;/g, '&');
    const url = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref.startsWith('/') ? '' : '/'}${rawHref}`;
    tabMap.set(key, { key, title, url });
  }

  const allTabs = [...tabMap.values()].map((tab) => {
    const dInfo = parseTurkishDateInfo(tab.title);
    return { ...tab, ...dInfo };
  });

  // Prioritize active & upcoming tabs first, then most recent key
  const selectedTabs = allTabs
    .sort((a, b) => {
      const rank = (s: AktuelTimingStatus) => (s === 'aktif' ? 0 : s === 'yaklasan' ? 1 : 2);
      const rDiff = rank(a.timingStatus) - rank(b.timingStatus);
      if (rDiff !== 0) return rDiff;
      return b.validFrom.localeCompare(a.validFrom);
    })
    .slice(0, 6);

  if (selectedTabs.length === 0) {
    selectedTabs.push({
      key: 'current',
      title: 'BİM Güncel Aktüel',
      url: mainPageUrl,
      ...parseTurkishDateInfo(''),
    });
  }

  const pageResults = await Promise.allSettled(
    selectedTabs.map(async (tab) => {
      const html = tab.url === mainPageUrl ? mainHtml : await fetchHtml(tab.url);
      return { tab, html };
    }),
  );

  const products: AktuelProduct[] = [];
  const campaigns: AktuelCampaign[] = [];
  const seenProdIds = new Set<string>();

  for (const res of pageResults) {
    if (res.status !== 'fulfilled') {
      warnings.push(`BİM sekme hatası: ${res.reason instanceof Error ? res.reason.message : 'Bilinmeyen hata'}`);
      continue;
    }

    const { tab, html } = res.value;
    const blocks = html.split(/<div[^>]*class=["'][^"']*\bproduct\s+col-/i).slice(1);
    let countForTab = 0;

    for (const block of blocks) {
      const hrefMatch = block.match(/<a[^>]*href=["']([^"']*aktuel\.aspx[^"']*)["']/i);
      const imgMatch = block.match(/<img[^>]*src=["']([^"']*uploads\/aktuel-urunler[^"']+)["']/i);
      const subTitleMatch = block.match(/<h2[^>]*class=["'][^"']*\bsubTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
      const titleMatch = block.match(/<h2[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
      const wholeMatch = block.match(/<div[^>]*class=["'][^"']*text\s+quantify[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const fracMatch = block.match(/<span[^>]*class=["'][^"']*number[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const taksitMatch = block.match(/taksit(\d+)\.jpg/i);

      const brand = decodeHtml(subTitleMatch?.[1] ?? '');
      const title = decodeHtml(titleMatch?.[1] ?? '');
      if (!title) continue;

      const wholeRaw = decodeHtml(wholeMatch?.[1] ?? '');
      const fracRaw = decodeHtml(fracMatch?.[1] ?? '00');
      const combinedPriceStr = `${wholeRaw}${fracRaw}`.replace(/,,+/g, ',');
      const priceTry = parseTurkishPrice(combinedPriceStr);
      if (priceTry <= 0) continue;

      const fullTitle = brand && !normalizeTr(title).startsWith(normalizeTr(brand)) ? `${brand} ${title}` : title;
      const id = makeProductId('bim', tab.key, fullTitle, priceTry);
      if (seenProdIds.has(id)) continue;
      seenProdIds.add(id);

      const relHref = hrefMatch?.[1] ?? '';
      const sourceUrl = relHref
        ? relHref.startsWith('http')
          ? relHref
          : `${baseUrl}${relHref.startsWith('/') ? '' : '/'}${relHref}`
        : tab.url;

      const imageUrl = imgMatch?.[1]
        ? imgMatch[1].startsWith('http')
          ? imgMatch[1]
          : `${baseUrl}${imgMatch[1]}`
        : '';

      products.push({
        id,
        market: 'bim',
        marketLabel: 'BİM',
        brand: brand || inferBrandFromTitle(title),
        title: fullTitle,
        priceTry,
        oldPriceTry: null,
        discountPct: null,
        priceFormatted: formatTry(priceTry),
        category: classifyAktuelCategory(fullTitle, brand),
        campaignTitle: `BİM ${tab.title}`,
        validFrom: tab.validFrom,
        dayLabel: tab.dayLabel,
        timingStatus: tab.timingStatus,
        salesChannel: 'magaza',
        installmentInfo: taksitMatch?.[1] ? `${taksitMatch[1]} Taksit` : null,
        imageUrl,
        sourceUrl,
      });
      countForTab += 1;
    }

    campaigns.push({
      key: `bim-${tab.key}`,
      market: 'bim',
      marketLabel: 'BİM',
      title: `BİM ${tab.title}`,
      validFrom: tab.validFrom,
      dayLabel: tab.dayLabel,
      timingStatus: tab.timingStatus,
      productCount: countForTab,
      brochureCount: 0,
      sourceUrl: tab.url,
    });
  }

  // Fetch BİM official brochure posters from afisler.aspx
  const brochures: AktuelBrochure[] = [];
  try {
    const afisMainUrl = `${baseUrl}/Categories/680/afisler.aspx`;
    const afisHtml = await fetchHtml(afisMainUrl);
    const afisTabUrls = new Map<string, { key: string; title: string; url: string }>();

    for (const m of afisHtml.matchAll(
      /<a[^>]*href=["']([^"']*Bim_AfisKey=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const key = m[2];
      const label = decodeHtml(m[3]) || `BİM Afiş #${key}`;
      if (!afisTabUrls.has(key)) {
        const rawHref = m[1].replace(/&amp;/g, '&');
        afisTabUrls.set(key, {
          key,
          title: label,
          url: rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref.startsWith('/') ? '' : '/'}${rawHref}`,
        });
      }
    }

    const extractAfisImgs = (html: string): string[] => {
      const imgs = [...html.matchAll(/https?:\/\/[^"'\s>]*bim\.com\.tr\/uploads\/afisler\/[^"'\s>]+\.(?:jpg|jpeg|png|webp)/gi)].map(
        (m) => m[0],
      );
      const unique = [...new Set(imgs)];
      // Prefer full-res over k_ thumbnail if full-res exists
      const fullSet = new Set(unique.filter((u) => !/\/k_[^/]+$/i.test(u)));
      return [...fullSet].length > 0 ? [...fullSet] : unique;
    };

    const mainImgs = extractAfisImgs(afisHtml);
    if (mainImgs.length > 0) {
      const dInfo = parseTurkishDateInfo('');
      brochures.push({
        id: 'bim-afis-guncel',
        market: 'bim',
        marketLabel: 'BİM',
        title: 'BİM Güncel Aktüel Afişleri',
        validFrom: dInfo.validFrom,
        dayLabel: dInfo.dayLabel,
        timingStatus: 'aktif',
        pageImages: mainImgs.slice(0, 12),
        sourceUrl: afisMainUrl,
        productCount: products.length,
      });
    }

    const extraAfisTabs = [...afisTabUrls.values()].slice(0, 4);
    const extraAfisRes = await Promise.allSettled(
      extraAfisTabs.map(async (t) => ({ tab: t, html: await fetchHtml(t.url) })),
    );
    for (const r of extraAfisRes) {
      if (r.status !== 'fulfilled') continue;
      const imgs = extractAfisImgs(r.value.html);
      if (imgs.length === 0) continue;
      const dInfo = parseTurkishDateInfo(r.value.tab.title);
      brochures.push({
        id: `bim-afis-${r.value.tab.key}`,
        market: 'bim',
        marketLabel: 'BİM',
        title: `BİM ${r.value.tab.title}`,
        validFrom: dInfo.validFrom,
        dayLabel: dInfo.dayLabel,
        timingStatus: dInfo.timingStatus,
        pageImages: imgs.slice(0, 12),
        sourceUrl: r.value.tab.url,
        productCount: 0,
      });
    }
  } catch (err) {
    warnings.push(`BİM afiş görselleri alınamadı: ${err instanceof Error ? err.message : 'Hata'}`);
  }

  return {
    market: 'bim',
    marketLabel: 'BİM',
    fetchedAt,
    fromCache: false,
    sourceUsed: 'bim.com.tr (Resmi Site)',
    campaigns,
    brochures,
    products,
    warnings,
  };
}

// ============================================================================
// 2. A101 & ŞOK BROCHURE/TABLE PARSER HELPERS
// ============================================================================

function parseCatalogPostHtml(
  html: string,
  postUrl: string,
  fallbackTitle: string,
  market: MarketId,
): {
  title: string;
  validFrom: string;
  dayLabel: string;
  timingStatus: AktuelTimingStatus;
  pageImages: string[];
  products: AktuelProduct[];
} {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = decodeHtml(h1Match?.[1] ?? '') || fallbackTitle;
  const dInfo = parseTurkishDateInfo(title);
  const marketLabel: 'BİM' | 'A101' | 'ŞOK' = market === 'bim' ? 'BİM' : market === 'a101' ? 'A101' : 'ŞOK';

  // Extract high-resolution brochure page images (#sayfa-1, #sayfa-2, ...)
  const pageImagesSet = new Set<string>();
  for (const m of html.matchAll(/<img[^>]*id=["']sayfa-\d+["'][^>]*>/gi)) {
    const tag = m[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      pageImagesSet.add(srcMatch[1]);
    }
  }
  if (pageImagesSet.size === 0) {
    for (const m of html.matchAll(
      /(?:src|data-src)=["'](https?:\/\/aktuel-urunler\.com\/wp-(?:content|diger)\/uploads\/[^"']+\.(?:webp|jpg|jpeg|png))["']/gi,
    )) {
      if (!/-(?:150x150|400x225|680x383)\./i.test(m[1])) {
        pageImagesSet.add(m[1]);
      }
    }
  }

  const products: AktuelProduct[] = [];
  const seenKeys = new Set<string>();

  for (const tblMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const tbl = tblMatch[0];
    for (const rowMatch of tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => decodeHtml(c[1]));
      if (cells.length < 2) continue;
      const prodTitle = cells[0];
      const priceStr = cells[cells.length - 1];
      if (!prodTitle || prodTitle.length < 2) continue;
      const priceTry = parseTurkishPrice(priceStr);
      if (priceTry <= 0) continue;

      const key = `${normalizeTr(prodTitle)}-${priceTry}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const brand = inferBrandFromTitle(prodTitle);
      products.push({
        id: makeProductId(market, dInfo.validFrom, prodTitle, priceTry),
        market,
        marketLabel,
        brand,
        title: prodTitle,
        priceTry,
        oldPriceTry: null,
        discountPct: null,
        priceFormatted: formatTry(priceTry),
        category: classifyAktuelCategory(prodTitle, brand),
        campaignTitle: title.replace(/\s*Aktüel Ürünler Kataloğu$/i, '').trim(),
        validFrom: dInfo.validFrom,
        dayLabel: dInfo.dayLabel,
        timingStatus: dInfo.timingStatus,
        salesChannel: 'magaza',
        installmentInfo: null,
        imageUrl: [...pageImagesSet][0] ?? '',
        sourceUrl: postUrl,
      });
    }
  }

  return {
    title,
    validFrom: dInfo.validFrom,
    dayLabel: dInfo.dayLabel,
    timingStatus: dInfo.timingStatus,
    pageImages: [...pageImagesSet],
    products,
  };
}

// ============================================================================
// 3. A101 LIVE PARSER
// ============================================================================

async function fetchA101Catalog(): Promise<MarketCatalogSnapshot> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];
  const indexUrl = 'https://aktuel-urunler.com/a101-aktuel-urunler/';

  const indexHtml = await fetchHtml(indexUrl);
  const postMap = new Map<string, string>();

  for (const m of indexHtml.matchAll(
    /<a[^>]*href=["'](https:\/\/aktuel-urunler\.com\/a101-[^"']+katalogu\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const href = m[1];
    const text = decodeHtml(m[2]);
    if (!postMap.has(href) && text && !/devam/i.test(text)) {
      postMap.set(href, text);
    } else if (!postMap.has(href)) {
      postMap.set(href, 'A101 Aktüel Kataloğu');
    }
  }

  const targetPosts = [...postMap.entries()].slice(0, 4);
  const postResults = await Promise.allSettled(
    targetPosts.map(async ([url, fallbackTitle]) => {
      const html = await fetchHtml(url);
      return parseCatalogPostHtml(html, url, fallbackTitle, 'a101');
    }),
  );

  const products: AktuelProduct[] = [];
  const brochures: AktuelBrochure[] = [];
  const campaigns: AktuelCampaign[] = [];
  const seenProdIds = new Set<string>();

  for (const res of postResults) {
    if (res.status !== 'fulfilled') {
      warnings.push(`A101 katalog hatası: ${res.reason instanceof Error ? res.reason.message : 'Hata'}`);
      continue;
    }
    const parsed = res.value;
    for (const p of parsed.products) {
      if (!seenProdIds.has(p.id)) {
        seenProdIds.add(p.id);
        products.push(p);
      }
    }

    const campKey = `a101-${parsed.validFrom}-${parsed.title.slice(0, 20)}`;
    brochures.push({
      id: campKey,
      market: 'a101',
      marketLabel: 'A101',
      title: parsed.title,
      validFrom: parsed.validFrom,
      dayLabel: parsed.dayLabel,
      timingStatus: parsed.timingStatus,
      pageImages: parsed.pageImages,
      sourceUrl: parsed.products[0]?.sourceUrl ?? indexUrl,
      productCount: parsed.products.length,
    });

    campaigns.push({
      key: campKey,
      market: 'a101',
      marketLabel: 'A101',
      title: parsed.title.replace(/\s*Aktüel Ürünler Kataloğu$/i, '').trim(),
      validFrom: parsed.validFrom,
      dayLabel: parsed.dayLabel,
      timingStatus: parsed.timingStatus,
      productCount: parsed.products.length,
      brochureCount: parsed.pageImages.length,
      sourceUrl: parsed.products[0]?.sourceUrl ?? indexUrl,
    });
  }

  return {
    market: 'a101',
    marketLabel: 'A101',
    fetchedAt,
    fromCache: false,
    sourceUsed: 'aktuel-urunler.com (A101 Katalog & Broşür Arşivi)',
    campaigns,
    brochures,
    products,
    warnings,
  };
}

// ============================================================================
// 4. ŞOK LIVE PARSER (sokmarket.com.tr + aktuel-urunler.com/sok/)
// ============================================================================

function parseSokOfficialPageCards(
  html: string,
  campaignTitle: string,
  salesChannel: 'haftanin_firsati' | 'online_ekstra',
  sourceBaseUrl: string,
): AktuelProduct[] {
  const todayIso = getIstanbulTodayIso();
  const dInfo = parseTurkishDateInfo('');
  const results: AktuelProduct[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(/<a[^>]*href=["'](\/[^"']+-p-\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const relUrl = m[1];
    const cardHtml = m[2];
    const titleMatch = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = decodeHtml(titleMatch?.[1] ?? '');
    if (!title || title.length < 2) continue;

    const discountedMatch = cardHtml.match(/data-testid=["']discountedPrice["'][^>]*>([\s\S]*?)<\/span>/i);
    const regularMatch = cardHtml.match(/data-testid=["']price["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i);
    const imgMatch = cardHtml.match(/<img[^>]*src=["']([^"']*images\.ceptesok\.com[^"']+)["']/i);

    const regularPrice = regularMatch ? parseTurkishPrice(decodeHtml(regularMatch[1])) : 0;
    const discountedPrice = discountedMatch ? parseTurkishPrice(decodeHtml(discountedMatch[1])) : 0;

    const priceTry = discountedPrice > 0 ? discountedPrice : regularPrice;
    const oldPriceTry = discountedPrice > 0 && regularPrice > discountedPrice ? regularPrice : null;
    if (priceTry <= 0) continue;

    const discountPct =
      oldPriceTry && oldPriceTry > priceTry
        ? Math.round(((oldPriceTry - priceTry) / oldPriceTry) * 100)
        : null;

    const id = makeProductId('sok', salesChannel, title, priceTry);
    if (seen.has(id)) continue;
    seen.add(id);

    const brand = inferBrandFromTitle(title);
    results.push({
      id,
      market: 'sok',
      marketLabel: 'ŞOK',
      brand,
      title,
      priceTry,
      oldPriceTry,
      discountPct,
      priceFormatted: formatTry(priceTry),
      category: classifyAktuelCategory(title, brand),
      campaignTitle,
      validFrom: todayIso,
      dayLabel: dInfo.dayLabel,
      timingStatus: 'aktif',
      salesChannel,
      installmentInfo: null,
      imageUrl: imgMatch?.[1] ?? '',
      sourceUrl: `https://www.sokmarket.com.tr${relUrl}`,
    });
  }

  return results.length > 0 ? results : [];
}

async function fetchSokCatalog(): Promise<MarketCatalogSnapshot> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];

  const sokIndexUrl = 'https://aktuel-urunler.com/sok/';
  const sokHfUrl = 'https://www.sokmarket.com.tr/haftanin-firsatlari-market-sgrp-146401';
  const sokEkstraUrl = 'https://www.sokmarket.com.tr/ekstra';

  const [idxRes, hfRes, ekstraRes] = await Promise.allSettled([
    fetchHtml(sokIndexUrl),
    fetchHtml(sokHfUrl),
    fetchHtml(sokEkstraUrl),
  ]);

  const products: AktuelProduct[] = [];
  const brochures: AktuelBrochure[] = [];
  const campaigns: AktuelCampaign[] = [];
  const seenProdIds = new Set<string>();

  // 1) Parse weekly ŞOK brochure posts & tables from aktuel-urunler.com/sok/
  if (idxRes.status === 'fulfilled') {
    const postMap = new Map<string, string>();
    for (const m of idxRes.value.matchAll(
      /<a[^>]*href=["'](https:\/\/aktuel-urunler\.com\/sok-[^"']+katalogu\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const href = m[1];
      const text = decodeHtml(m[2]);
      if (!postMap.has(href) && text && !/devam/i.test(text)) {
        postMap.set(href, text);
      } else if (!postMap.has(href)) {
        postMap.set(href, 'ŞOK Aktüel Kataloğu');
      }
    }

    const postResults = await Promise.allSettled(
      [...postMap.entries()].slice(0, 3).map(async ([url, title]) => {
        const html = await fetchHtml(url);
        return parseCatalogPostHtml(html, url, title, 'sok');
      }),
    );

    for (const pr of postResults) {
      if (pr.status !== 'fulfilled') continue;
      const parsed = pr.value;
      for (const p of parsed.products) {
        if (!seenProdIds.has(p.id)) {
          seenProdIds.add(p.id);
          products.push(p);
        }
      }
      const campKey = `sok-${parsed.validFrom}-${parsed.title.slice(0, 20)}`;
      brochures.push({
        id: campKey,
        market: 'sok',
        marketLabel: 'ŞOK',
        title: parsed.title,
        validFrom: parsed.validFrom,
        dayLabel: parsed.dayLabel,
        timingStatus: parsed.timingStatus,
        pageImages: parsed.pageImages,
        sourceUrl: parsed.products[0]?.sourceUrl ?? sokIndexUrl,
        productCount: parsed.products.length,
      });
      campaigns.push({
        key: campKey,
        market: 'sok',
        marketLabel: 'ŞOK',
        title: parsed.title.replace(/\s*Aktüel Ürünler Kataloğu$/i, '').trim(),
        validFrom: parsed.validFrom,
        dayLabel: parsed.dayLabel,
        timingStatus: parsed.timingStatus,
        productCount: parsed.products.length,
        brochureCount: parsed.pageImages.length,
        sourceUrl: parsed.products[0]?.sourceUrl ?? sokIndexUrl,
      });
    }
  } else {
    warnings.push(`ŞOK broşür arşivi alınamadı: ${idxRes.reason instanceof Error ? idxRes.reason.message : 'Hata'}`);
  }

  // 2) Parse official sokmarket.com.tr Haftanın Fırsatları
  if (hfRes.status === 'fulfilled') {
    const hfItems = parseSokOfficialPageCards(
      hfRes.value,
      'ŞOK Haftanın Fırsatları (Canlı)',
      'haftanin_firsati',
      sokHfUrl,
    );
    for (const p of hfItems) {
      if (!seenProdIds.has(p.id)) {
        seenProdIds.add(p.id);
        products.push(p);
      }
    }
    if (hfItems.length > 0) {
      campaigns.push({
        key: 'sok-haftanin-firsatlari',
        market: 'sok',
        marketLabel: 'ŞOK',
        title: 'ŞOK Haftanın Fırsatları (Canlı)',
        validFrom: getIstanbulTodayIso(),
        dayLabel: 'Haftalık',
        timingStatus: 'aktif',
        productCount: hfItems.length,
        brochureCount: 0,
        sourceUrl: sokHfUrl,
      });
    }
  } else {
    warnings.push(`ŞOK Haftanın Fırsatları alınamadı: ${hfRes.reason instanceof Error ? hfRes.reason.message : 'Hata'}`);
  }

  // 3) Parse official sokmarket.com.tr/ekstra (top 30)
  if (ekstraRes.status === 'fulfilled') {
    const ekstraItems = parseSokOfficialPageCards(
      ekstraRes.value,
      'ŞOK Ekstra Online Fırsatlar',
      'online_ekstra',
      sokEkstraUrl,
    ).slice(0, 30);
    for (const p of ekstraItems) {
      if (!seenProdIds.has(p.id)) {
        seenProdIds.add(p.id);
        products.push(p);
      }
    }
    if (ekstraItems.length > 0) {
      campaigns.push({
        key: 'sok-ekstra',
        market: 'sok',
        marketLabel: 'ŞOK',
        title: 'ŞOK Ekstra Online Fırsatlar',
        validFrom: getIstanbulTodayIso(),
        dayLabel: 'Online',
        timingStatus: 'aktif',
        productCount: ekstraItems.length,
        brochureCount: 0,
        sourceUrl: sokEkstraUrl,
      });
    }
  } else {
    warnings.push(`ŞOK Ekstra alınamadı: ${ekstraRes.reason instanceof Error ? ekstraRes.reason.message : 'Hata'}`);
  }

  return {
    market: 'sok',
    marketLabel: 'ŞOK',
    fetchedAt,
    fromCache: false,
    sourceUsed: 'sokmarket.com.tr + aktuel-urunler.com',
    campaigns,
    brochures,
    products,
    warnings,
  };
}

// ============================================================================
// PUBLIC ORCHESTRATOR & MCP CLIENT METHODS
// ============================================================================

export async function getMarketCatalog(
  market: MarketId,
  forceRefresh = false,
): Promise<MarketCatalogSnapshot> {
  const cached = MARKET_CACHE.get(market);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  const pending = IN_FLIGHT_MARKET.get(market);
  if (pending && !forceRefresh) {
    return pending;
  }

  const job = (async () => {
    try {
      const snapshot =
        market === 'bim'
          ? await fetchBimCatalog()
          : market === 'a101'
            ? await fetchA101Catalog()
            : await fetchSokCatalog();

      MARKET_CACHE.set(market, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data: snapshot,
      });
      return snapshot;
    } finally {
      IN_FLIGHT_MARKET.delete(market);
    }
  })();

  IN_FLIGHT_MARKET.set(market, job);
  return job;
}

function resolveMarkets(market: MarketFilter = 'hepsi'): MarketId[] {
  if (market === 'bim' || market === 'a101' || market === 'sok') {
    return [market];
  }
  return ['bim', 'a101', 'sok'];
}

export async function getWeeklyCatalogSummary(params: {
  market?: MarketFilter;
  onlyActiveOrUpcoming?: boolean;
  limitPerMarket?: number;
  forceRefresh?: boolean;
}): Promise<AktuelWeeklySummaryResponse> {
  const market = params.market ?? 'hepsi';
  const onlyActive = params.onlyActiveOrUpcoming ?? true;
  const forceRefresh = Boolean(params.forceRefresh);
  const limitPerMarket = params.limitPerMarket ?? 80;

  const targetMarkets = resolveMarkets(market);
  const snapshots = await Promise.all(targetMarkets.map((m) => getMarketCatalog(m, forceRefresh)));

  const allProducts: AktuelProduct[] = [];
  const allBrochures: AktuelBrochure[] = [];

  const marketSummaries = snapshots.map((snap) => {
    const filteredProducts = onlyActive
      ? snap.products.filter((p) => p.timingStatus !== 'gecmis')
      : snap.products;
    const productsSlice = filteredProducts.length > 0 ? filteredProducts : snap.products;

    allProducts.push(...productsSlice.slice(0, limitPerMarket));
    allBrochures.push(...snap.brochures);

    return {
      market: snap.market,
      marketLabel: snap.marketLabel,
      sourceUsed: snap.sourceUsed,
      fromCache: snap.fromCache,
      productCount: productsSlice.length,
      brochureCount: snap.brochures.length,
      campaigns: snap.campaigns,
      warnings: snap.warnings,
    };
  });

  return {
    market,
    fetchedAt: new Date().toISOString(),
    fromCache: snapshots.every((s) => s.fromCache),
    totalProducts: allProducts.length,
    totalBrochures: allBrochures.length,
    marketSummaries,
    products: allProducts,
    brochures: allBrochures,
  };
}

export async function searchAktuelProducts(params: {
  query?: string;
  market?: MarketFilter;
  category?: AktuelCategory | 'hepsi';
  timing?: AktuelTimingStatus | 'hepsi';
  sortBy?: AktuelSortBy;
  limit?: number;
  forceRefresh?: boolean;
}): Promise<AktuelSearchResponse> {
  const query = (params.query ?? '').trim();
  const market = params.market ?? 'hepsi';
  const category = params.category ?? 'hepsi';
  const timing = params.timing ?? 'hepsi';
  const sortBy = params.sortBy ?? (query ? 'relevance' : 'lowest_price');
  const limit = Math.min(250, Math.max(1, params.limit ?? 80));
  const forceRefresh = Boolean(params.forceRefresh);

  const snapshots = await Promise.all(resolveMarkets(market).map((m) => getMarketCatalog(m, forceRefresh)));
  let pool = snapshots.flatMap((s) => s.products);

  if (category !== 'hepsi') {
    pool = pool.filter((p) => p.category === category);
  }
  if (timing !== 'hepsi') {
    pool = pool.filter((p) => p.timingStatus === timing);
  }

  let ranked: Array<{ product: AktuelProduct; score: number }>;
  let appliedSynonyms: string[] = [];

  if (query) {
    const { primaryQuery, synonymQueries, displaySynonyms } = expandSearchVariants(query);
    appliedSynonyms = displaySynonyms.length > 0 ? displaySynonyms : synonymQueries;

    ranked = pool
      .map((product) => {
        let bestScore = scoreProductMatch(product, primaryQuery, false);
        for (const syn of synonymQueries) {
          const synScore = scoreProductMatch(product, syn, true);
          if (synScore > bestScore) {
            bestScore = synScore;
          }
        }
        return { product, score: bestScore };
      })
      .filter((item) => item.score > 0);
  } else {
    ranked = pool.map((product) => ({ product, score: product.timingStatus === 'aktif' ? 10 : 5 }));
  }

  ranked.sort((a, b) => {
    if (sortBy === 'lowest_price') return a.product.priceTry - b.product.priceTry;
    if (sortBy === 'highest_price') return b.product.priceTry - a.product.priceTry;
    if (b.score !== a.score) return b.score - a.score;
    return a.product.priceTry - b.product.priceTry;
  });

  const sliced = ranked.slice(0, limit).map((r) => r.product);

  return {
    query,
    ...(appliedSynonyms.length > 0 ? { appliedSynonyms } : {}),
    market,
    category,
    timing,
    sortBy,
    totalMatched: ranked.length,
    fetchedAt: new Date().toISOString(),
    fromCache: snapshots.every((s) => s.fromCache),
    products: sliced,
  };
}

export async function getAktuelCalendar(params: {
  market?: MarketFilter;
  day?: string;
  timing?: AktuelTimingStatus | 'hepsi';
  forceRefresh?: boolean;
}) {
  const market = params.market ?? 'hepsi';
  const dayFilter = normalizeTr(params.day ?? 'hepsi');
  const timing = params.timing ?? 'hepsi';
  const snapshots = await Promise.all(
    resolveMarkets(market).map((m) => getMarketCatalog(m, Boolean(params.forceRefresh))),
  );

  let campaigns = snapshots.flatMap((s) => s.campaigns);
  if (timing !== 'hepsi') {
    campaigns = campaigns.filter((c) => c.timingStatus === timing);
  }
  if (dayFilter && dayFilter !== 'hepsi') {
    campaigns = campaigns.filter((c) => normalizeTr(c.dayLabel).includes(dayFilter));
  }

  campaigns.sort((a, b) => b.validFrom.localeCompare(a.validFrom));

  return {
    todayIstanbul: getIstanbulTodayIso(),
    market,
    dayFilter: params.day ?? 'hepsi',
    timing,
    campaignCount: campaigns.length,
    campaigns,
  };
}

export async function scanAktuelShoppingList(params: {
  items: string[];
  market?: MarketFilter;
  forceRefresh?: boolean;
}): Promise<{
  market: MarketFilter;
  requestedCount: number;
  foundCount: number;
  estimatedMinBasketTry: number;
  estimatedMinBasketFormatted: string;
  matches: AktuelBasketMatch[];
}> {
  const market = params.market ?? 'hepsi';
  const cleanItems = params.items.map((x) => x.trim()).filter(Boolean).slice(0, 20);

  const matches: AktuelBasketMatch[] = await Promise.all(
    cleanItems.map(async (item) => {
      const search = await searchAktuelProducts({
        query: item,
        market,
        sortBy: 'lowest_price',
        limit: 5,
        forceRefresh: params.forceRefresh,
      });
      const activeFirst = [
        ...search.products.filter((p) => p.timingStatus !== 'gecmis'),
        ...search.products.filter((p) => p.timingStatus === 'gecmis'),
      ];
      return {
        requestedItem: item,
        found: activeFirst.length > 0,
        matchCount: search.totalMatched,
        cheapestMatch: activeFirst[0] ?? null,
        alternatives: activeFirst.slice(1, 4),
      };
    }),
  );

  const foundItems = matches.filter((m) => m.cheapestMatch);
  const totalTry = Number(
    foundItems.reduce((acc, m) => acc + (m.cheapestMatch?.priceTry ?? 0), 0).toFixed(2),
  );

  return {
    market,
    requestedCount: cleanItems.length,
    foundCount: foundItems.length,
    estimatedMinBasketTry: totalTry,
    estimatedMinBasketFormatted: formatTry(totalTry),
    matches,
  };
}

export async function getAktuelBrochures(params: {
  market?: MarketFilter;
  forceRefresh?: boolean;
}) {
  const market = params.market ?? 'hepsi';
  const snapshots = await Promise.all(
    resolveMarkets(market).map((m) => getMarketCatalog(m, Boolean(params.forceRefresh))),
  );
  const brochures = snapshots
    .flatMap((s) => s.brochures)
    .filter((b) => b.pageImages.length > 0);

  return {
    market,
    fetchedAt: new Date().toISOString(),
    brochureCount: brochures.length,
    brochures,
  };
}

export async function compareAktuelWithMarket(params: {
  query: string;
  market?: MarketFilter;
}): Promise<AktuelMarketCheckResult> {
  const query = params.query.trim();
  const market = params.market ?? 'hepsi';

  const aktuelRes = await searchAktuelProducts({
    query,
    market,
    sortBy: 'relevance',
    limit: 6,
  });

  const bestAktuel = aktuelRes.products[0] ?? null;
  // Build clean search query (brand + model code or first 4 meaningful words without quotes)
  const cleanWords = (bestAktuel?.title ?? query)
    .replace(/["'()]/g, ' ')
    .replace(/\b(frameless|smart|hd|fhd|uhd|4k|led|qled|uydu alicili|android|google|webos|whale os \d+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const onlineQuery = cleanWords.slice(0, 4).join(' ') || query;

  let akakceProducts: AktuelMarketCheckResult['akakceReference']['topOnlineMatches'] = [];
  let searchUrl = `https://www.akakce.com/arama/?q=${encodeURIComponent(onlineQuery)}`;

  const filterComparableOnline = (items: AktuelMarketCheckResult['akakceReference']['topOnlineMatches']) => {
    if (!bestAktuel || bestAktuel.priceTry <= 0) return items;
    // Exclude accessories (remotes, cables, cases) priced below 35% of the main item
    const filtered = items.filter((p) => p.lowestPriceTry >= bestAktuel.priceTry * 0.35);
    return filtered.length > 0 ? filtered : items;
  };

  try {
    const akakceRes = await searchAkakce({
      query: onlineQuery,
      sortBy: 'popularity',
      limit: 12,
    });
    akakceProducts = filterComparableOnline(akakceRes.products).slice(0, 5);
    searchUrl = akakceRes.searchUrl;
  } catch {
    akakceProducts = [];
  }

  if (akakceProducts.length === 0 && onlineQuery !== query) {
    try {
      const akakceFallback = await searchAkakce({
        query,
        sortBy: 'popularity',
        limit: 12,
      });
      akakceProducts = filterComparableOnline(akakceFallback.products).slice(0, 5);
      searchUrl = akakceFallback.searchUrl;
    } catch {
      akakceProducts = [];
    }
  }

  const validOnlinePrices = akakceProducts.map((p) => p.lowestPriceTry).filter((n) => n > 0);
  const lowestOnline = validOnlinePrices.length > 0 ? Math.min(...validOnlinePrices) : null;

  let verdict: AktuelMarketCheckResult['dealAssessment']['verdict'] = 'karsilastirilamadi';
  let priceDiffTry: number | null = null;
  let savingsPct: number | null = null;
  let summary = 'Aktüel veya çevrimiçi piyasa referans fiyatı eşleştirilemedi.';

  if (bestAktuel && lowestOnline && lowestOnline > 0) {
    priceDiffTry = Number((lowestOnline - bestAktuel.priceTry).toFixed(2));
    savingsPct = Number(((priceDiffTry / lowestOnline) * 100).toFixed(1));

    if (savingsPct >= 5) {
      verdict = 'piyasadan_ucuz';
      summary = `${bestAktuel.marketLabel} aktüel fiyatı (${bestAktuel.priceFormatted}), Akakçe'deki en düşük online fiyattan (${formatTry(lowestOnline)}) %${savingsPct} (${formatTry(priceDiffTry)}) daha uygun.`;
    } else if (savingsPct <= -5) {
      verdict = 'piyasadan_pahali';
      summary = `Online piyasa (${formatTry(lowestOnline)}), ${bestAktuel.marketLabel} aktüel fiyatından (${bestAktuel.priceFormatted}) daha avantajlı görünüyor.`;
    } else {
      verdict = 'piyasayla_benzer';
      summary = `${bestAktuel.marketLabel} aktüel fiyatı (${bestAktuel.priceFormatted}) ile Akakçe online en düşük fiyatı (${formatTry(lowestOnline)}) benzer seviyede.`;
    }
  }

  return {
    query,
    market,
    aktuelMatches: aktuelRes.products,
    akakceReference: {
      searchQuery: onlineQuery,
      searchUrl,
      lowestOnlinePriceTry: lowestOnline,
      lowestOnlineFormatted: lowestOnline ? formatTry(lowestOnline) : null,
      topOnlineMatches: akakceProducts,
    },
    dealAssessment: {
      cheapestAktuelProduct: bestAktuel,
      priceDiffTry,
      savingsPct,
      verdict,
      summary,
    },
  };
}

export function getAktuelCacheSummary() {
  const markets: Record<string, { cached: boolean; productCount: number; brochureCount: number; fetchedAt: string | null }> = {};
  for (const m of ['bim', 'a101', 'sok'] as MarketId[]) {
    const entry = MARKET_CACHE.get(m);
    if (entry && entry.expiresAt > Date.now()) {
      markets[m] = {
        cached: true,
        productCount: entry.data.products.length,
        brochureCount: entry.data.brochures.length,
        fetchedAt: entry.data.fetchedAt,
      };
    } else {
      markets[m] = {
        cached: false,
        productCount: 0,
        brochureCount: 0,
        fetchedAt: null,
      };
    }
  }
  return {
    todayIstanbul: getIstanbulTodayIso(),
    cacheTtlMinutes: CACHE_TTL_MS / 60000,
    markets,
  };
}
