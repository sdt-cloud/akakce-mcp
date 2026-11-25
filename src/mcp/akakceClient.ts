import type {
  AkakceAutocompleteGroup,
  AkakcePriceHistoryRow,
  AkakceProductDetails,
  AkakceProductSpec,
  AkakceProductVariant,
  AkakceSearchProduct,
  AkakceSearchResponse,
  AkakceSellerOffer,
  AkakceSortBy,
} from './types.ts';

const AKAKCE_BASE = 'https://www.akakce.com';
const AKAKCE_AC_URL = 'https://api6.akakce.com/autocomplete';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

const AKAKCE_HOSTS = new Set(['akakce.com', 'www.akakce.com', 'api6.akakce.com']);

async function fetchAkakce(target: string, options: RequestInit): Promise<Response> {
  let url = new URL(target);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !AKAKCE_HOSTS.has(url.hostname)) {
      throw new Error('Yalnızca HTTPS Akakçe adresleri destekleniyor.');
    }
    const response = await fetch(url, { ...options, redirect: 'manual' });
    const location = response.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      return response;
    }
    await response.body?.cancel();
    url = new URL(location, url);
  }
  throw new Error('Akakçe yönlendirme sınırına ulaşıldı.');
}

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SEARCH_CACHE = new Map<string, { expiresAt: number; data: AkakceSearchResponse }>();
const DETAIL_CACHE = new Map<string, { expiresAt: number; data: AkakceProductDetails }>();
const PRODUCT_URL_BY_ID = new Map<string, { title: string; akakceUrl: string; updatedAt: string }>();

function decodeHtml(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTurkishTry(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;
  // Format like 28.899,00 or 28.899
  if (/\d\.\d{3}/.test(cleaned) || cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);
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

function resolveAkakceUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return AKAKCE_BASE;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('//')) {
    return `https:${pathOrUrl}`;
  }
  return `${AKAKCE_BASE}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function extractProductIdFromUrl(url: string): string {
  const match = url.match(/,(\d+)\.html/i);
  return match?.[1] ?? '';
}

function decodeUrlAttr(raw: string): string {
  return raw.replace(/&amp;/g, '&').trim();
}

interface ParsedPagerInfo {
  currentPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPageUrl: string | null;
  nextPageUrl: string | null;
}

function parsePagerHtml(html: string, requestedPage: number): ParsedPagerInfo {
  const pagerMatch = html.match(/<p[^>]*class=["'][^"']*pager_v9[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const pagerHtml = pagerMatch?.[1] ?? '';
  if (!pagerHtml) {
    return {
      currentPage: requestedPage,
      totalPages: requestedPage,
      hasPrevPage: requestedPage > 1,
      hasNextPage: false,
      prevPageUrl: null,
      nextPageUrl: null,
    };
  }

  const activeMatch = pagerHtml.match(/<span[^>]*class=["'][^"']*\ba\b[^"']*["'][^>]*>(\d+)<\/span>/i);
  const currentPage = activeMatch?.[1] ? parseInt(activeMatch[1], 10) : requestedPage;

  let maxPage = currentPage;
  for (const m of pagerHtml.matchAll(/title=["']Sayfa\s+(\d+)["']/gi)) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  }

  const nextHref =
    pagerHtml.match(/<a[^>]*title=["']Sonraki["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    pagerHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*title=["']Sonraki["']/i)?.[1] ??
    null;

  const prevHref =
    pagerHtml.match(/<a[^>]*title=["']Önceki["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    pagerHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*title=["']Önceki["']/i)?.[1] ??
    null;

  const nextPageUrl = nextHref ? resolveAkakceUrl(decodeUrlAttr(nextHref)) : null;
  const prevPageUrl = prevHref ? resolveAkakceUrl(decodeUrlAttr(prevHref)) : null;

  return {
    currentPage,
    totalPages: Math.max(maxPage, nextPageUrl ? currentPage + 1 : currentPage),
    hasPrevPage: Boolean(prevPageUrl) || currentPage > 1,
    hasNextPage: Boolean(nextPageUrl) || currentPage < maxPage,
    prevPageUrl,
    nextPageUrl,
  };
}

function getAkakceSortCode(sortBy: AkakceSortBy): number {
  if (sortBy === 'lowest_price') return 2;
  if (sortBy === 'highest_price') return 4;
  return 1;
}

function buildCategoryPageUrl(baseUrl: string, targetPage: number, sortBy: AkakceSortBy): string {
  const url = new URL(baseUrl);
  const sortCode = getAkakceSortCode(sortBy);
  url.searchParams.delete('s');
  const cleanPath = url.pathname.replace(/(?:,\d+(?:,\d+)?)?\.html$/i, '');
  if (sortCode !== 1) {
    url.pathname = `${cleanPath},${targetPage},${sortCode}.html`;
  } else if (targetPage > 1) {
    url.pathname = `${cleanPath},${targetPage}.html`;
  } else {
    url.pathname = `${cleanPath}.html`;
  }
  return url.toString();
}

function parseSearchListHtml(html: string, queryForFallbackUrl: string): AkakceSearchProduct[] {
  const listMatch =
    html.match(/<ul[^>]*id=["']APL["'][^>]*>([\s\S]*?)<\/ul>/i) ??
    html.match(/<ul[^>]*id=["']CPL["'][^>]*>([\s\S]*?)<\/ul>/i);

  const listHtml = listMatch?.[1] ?? html;
  const items = listHtml.split(/<li\b/i).slice(1);
  const products: AkakceSearchProduct[] = [];
  const seenIds = new Set<string>();

  for (const rawItem of items) {
    const liChunk = rawItem.split('</li>')[0] ?? rawItem;
    const prMatch = liChunk.match(/data-pr=["'](\d+)["']/i);
    if (!prMatch?.[1]) continue;
    const productId = prMatch[1];
    if (seenIds.has(productId)) continue;

    const hrefMatch = liChunk.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
    const titleMatch =
      liChunk.match(/<h3[^>]*class=["'][^"']*pn_v8[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i) ??
      liChunk.match(/<a[^>]+title=["']([^"']+)["']/i);

    const href = hrefMatch?.[1] ?? '';
    const title = decodeHtml(titleMatch?.[1] ?? '');
    if (!title) continue;

    // Parse price span strictly before any nested trailing <span> (e.g. "+14 FİYAT" / "TEK FİYAT")
    const ptMatch =
      liChunk.match(/<span[^>]*class=["'][^"']*pt_v[89][^"']*["'][^>]*>((?:(?!<span\b)[\s\S])*)/i) ??
      liChunk.match(/<span[^>]*class=["'][^"']*pt_v[89][^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

    const rawPriceText = decodeHtml(ptMatch?.[1] ?? '');
    const lowestPriceTry = parseTurkishTry(rawPriceText);
    if (lowestPriceTry <= 0) continue;

    const mkMatch = liChunk.match(/data-mk=["']([^"']*)["']/i);
    const cpMatch = liChunk.match(/data-cp=["'](\d+)["']/i);
    const fcMatch = liChunk.match(/data-fc=["'](\d+)["']/i);
    const imgMatch = liChunk.match(/<img[^>]+src=["']([^"']+)["']/i);
    const discMatch = liChunk.match(/<span[^>]*class=["'][^"']*db_v9[^"']*["'][^>]*>[\s\S]*?%(\d+)/i);

    const colors: string[] = [];
    for (const cm of liChunk.matchAll(/class=["'][^"']*c_bx_v8[^"']*["'][^>]*title=["']([^"']+)["']/gi)) {
      const c = decodeHtml(cm[1]);
      if (c && !colors.includes(c)) colors.push(c);
    }

    const brandRaw = decodeHtml(mkMatch?.[1] ?? '');
    const brand = brandRaw && brandRaw !== '-' ? brandRaw : title.split(/\s+/)[0] || '';
    const offerCount = cpMatch?.[1] ? parseInt(cpMatch[1], 10) : 1;
    const followersCount = fcMatch?.[1] ? parseInt(fcMatch[1], 10) : 0;
    const discountPct = discMatch?.[1] ? parseInt(discMatch[1], 10) : null;
    const hasDetailPage = Boolean(href);
    const akakceUrl = href
      ? resolveAkakceUrl(href)
      : `${AKAKCE_BASE}/arama/?q=${encodeURIComponent(title || queryForFallbackUrl)}`;
    const imageUrl = imgMatch?.[1] ? resolveAkakceUrl(imgMatch[1]) : '';

    seenIds.add(productId);
    if (hasDetailPage) {
      PRODUCT_URL_BY_ID.set(productId, {
        title,
        akakceUrl,
        updatedAt: new Date().toISOString(),
      });
    }

    products.push({
      productId,
      title,
      brand,
      lowestPriceTry,
      priceFormatted: formatTry(lowestPriceTry),
      offerCount,
      followersCount,
      discountPct,
      colors,
      hasDetailPage,
      akakceUrl,
      imageUrl,
    });
  }

  return products;
}

interface SinglePageResult {
  searchUrl: string;
  redirectedToCategory: boolean;
  products: AkakceSearchProduct[];
  pager: ParsedPagerInfo;
  fromCache: boolean;
  fetchedAt: string;
}

const PAGE_CACHE = new Map<string, { expiresAt: number; data: SinglePageResult }>();

function buildSearchPageUrl(options: {
  query: string;
  sortBy: AkakceSortBy;
  akakcePage: number;
  page1Meta?: SinglePageResult;
}): string {
  const { query, sortBy, akakcePage, page1Meta } = options;
  if (page1Meta?.redirectedToCategory) {
    const templateBase = page1Meta.pager.nextPageUrl || page1Meta.searchUrl;
    return buildCategoryPageUrl(templateBase, akakcePage, sortBy);
  }
  const sortCode = getAkakceSortCode(sortBy);
  const params = new URLSearchParams({ q: query });
  if (sortCode !== 1) params.set('s', String(sortCode));
  if (akakcePage > 1) params.set('p', String(akakcePage));
  return `${AKAKCE_BASE}/arama/?${params.toString()}`;
}

async function fetchHtmlWithRetry(targetUrl: string): Promise<{ finalUrl: string; html: string }> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    res = await fetchAkakce(targetUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 429 || res.status === 503) {
      const retryAfterSec = Number(res.headers.get('retry-after') ?? '');
      const waitMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(4000, retryAfterSec * 1000)
          : 1200 * (attempt + 1);
      await sleep(waitMs);
      continue;
    }
    break;
  }

  if (!res || !res.ok) {
    throw new Error(`Akakçe.com HTTP ${res?.status ?? 0} (${res?.statusText ?? 'Hata'}) döndürdü.`);
  }

  const html = await res.text();
  if (
    /Attention Required!|Cloudflare|cf-browser-verification/i.test(html) &&
    !html.includes('id="APL"') &&
    !html.includes('id="CPL"')
  ) {
    throw new Error('Akakçe güvenlik doğrulaması tetiklendi.');
  }

  return { finalUrl: res.url || targetUrl, html };
}

async function fetchSingleSearchPage(options: {
  query: string;
  sortBy: AkakceSortBy;
  page: number;
  forceRefresh?: boolean;
  explicitUrl?: string;
  page1Meta?: SinglePageResult;
}): Promise<SinglePageResult> {
  const { query, sortBy, page, forceRefresh, explicitUrl, page1Meta } = options;
  const pageCacheKey = `${query.toLocaleLowerCase('tr-TR')}|${sortBy}|p${page}`;

  const cached = PAGE_CACHE.get(pageCacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  let targetUrl = explicitUrl ?? '';
  if (!targetUrl) {
    if (page === 1) {
      targetUrl = buildSearchPageUrl({ query, sortBy, akakcePage: 1 });
    } else {
      const p1 =
        page1Meta ??
        (await fetchSingleSearchPage({ query, sortBy, page: 1, forceRefresh: false }));
      targetUrl = buildSearchPageUrl({ query, sortBy, akakcePage: page, page1Meta: p1 });
    }
  }

  let { finalUrl, html } = await fetchHtmlWithRetry(targetUrl);
  const sortCode = getAkakceSortCode(sortBy);

  // When /arama/?q=...&s=4 redirects to /category.html, Akakçe strips ?s=; re-fetch with ,1,4.html
  if (
    page === 1 &&
    sortCode !== 1 &&
    finalUrl &&
    !finalUrl.includes('/arama/') &&
    !new RegExp(`,${page},${sortCode}\\.html$`, 'i').test(new URL(finalUrl).pathname)
  ) {
    const sortedCategoryUrl = buildCategoryPageUrl(finalUrl, 1, sortBy);
    const sortedRes = await fetchHtmlWithRetry(sortedCategoryUrl);
    finalUrl = sortedRes.finalUrl;
    html = sortedRes.html;
  }

  const products = parseSearchListHtml(html, query);
  const pager = parsePagerHtml(html, page);
  const data: SinglePageResult = {
    searchUrl: finalUrl,
    redirectedToCategory: Boolean(finalUrl && !finalUrl.includes('/arama/')),
    products,
    pager,
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };

  PAGE_CACHE.set(pageCacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });

  return data;
}

const MAX_AKAKCE_CRAWL_PAGES = 60;
const CHUNK_PAGES_LIMIT = 16;
const PARALLEL_BATCH_SIZE = 3;

export async function searchAkakce(options: {
  query: string;
  sortBy?: AkakceSortBy;
  page?: number;
  limit?: number;
  fetchAll?: boolean;
  startAkakcePage?: number;
  forceRefresh?: boolean;
}): Promise<AkakceSearchResponse> {
  const query = options.query.trim();
  if (!query) {
    throw new Error('Arama sorgusu (query) boş olamaz.');
  }

  const sortBy: AkakceSortBy = options.sortBy ?? 'popularity';
  const fetchAll = Boolean(options.fetchAll);
  const startAkPage = fetchAll ? Math.max(1, Math.floor(options.startAkakcePage ?? 1)) : 1;
  const uiPage = fetchAll ? 1 : Math.max(1, Math.floor(options.page ?? 1));
  const limit = fetchAll ? 2500 : Math.min(2500, Math.max(1, Math.floor(options.limit ?? 50)));
  const cacheKey = `${query.toLocaleLowerCase('tr-TR')}|${sortBy}|all:${fetchAll ? startAkPage : 0}|p${uiPage}|l${limit}`;

  const cached = SEARCH_CACHE.get(cacheKey);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.data,
      fromCache: true,
    };
  }

  const page1Meta = await fetchSingleSearchPage({
    query,
    sortBy,
    page: 1,
    forceRefresh: options.forceRefresh && startAkPage === 1,
  });

  const entryPage =
    startAkPage === 1
      ? page1Meta
      : await fetchSingleSearchPage({
          query,
          sortBy,
          page: startAkPage,
          forceRefresh: options.forceRefresh,
          page1Meta,
        });

  const startOffset = fetchAll ? 0 : (uiPage - 1) * limit;
  const endOffset = fetchAll ? 2500 : startOffset + limit;

  const combined: AkakceSearchProduct[] =
    entryPage.pager.currentPage === startAkPage ? [...entryPage.products] : [];
  const seenIds = new Set(combined.map((p) => p.productId));
  let knownTotalAkPages = Math.max(page1Meta.pager.totalPages, entryPage.pager.totalPages);
  let lastValidAkPage = combined.length > 0 ? startAkPage : startAkPage - 1;
  let lastValidHasNext = combined.length > 0 && entryPage.pager.hasNextPage;
  let lastNextUrl = entryPage.pager.nextPageUrl;
  let pagesFetched = combined.length > 0 ? 1 : 0;
  let allFromCache = entryPage.fromCache;
  let rateLimited = false;

  const maxPageForThisRun = fetchAll
    ? Math.min(MAX_AKAKCE_CRAWL_PAGES, knownTotalAkPages, startAkPage + CHUNK_PAGES_LIMIT - 1)
    : Math.min(
        MAX_AKAKCE_CRAWL_PAGES,
        knownTotalAkPages,
        Math.max(1, Math.ceil((endOffset + 1) / 32)),
      );

  let nextBatchStart = startAkPage + 1;
  while (
    lastValidHasNext &&
    nextBatchStart <= Math.min(MAX_AKAKCE_CRAWL_PAGES, knownTotalAkPages) &&
    (fetchAll ? nextBatchStart <= maxPageForThisRun : combined.length <= endOffset)
  ) {
    const dynamicLimit = fetchAll
      ? Math.min(MAX_AKAKCE_CRAWL_PAGES, knownTotalAkPages, startAkPage + CHUNK_PAGES_LIMIT - 1)
      : Math.min(MAX_AKAKCE_CRAWL_PAGES, knownTotalAkPages, Math.max(nextBatchStart, maxPageForThisRun));

    const batchEnd = Math.min(nextBatchStart + PARALLEL_BATCH_SIZE - 1, dynamicLimit);
    if (batchEnd < nextBatchStart) break;

    const pageNums: number[] = [];
    for (let p = nextBatchStart; p <= batchEnd; p += 1) {
      pageNums.push(p);
    }

    const batchResults = await Promise.all(
      pageNums.map(async (akPageNum) => {
        try {
          const data = await fetchSingleSearchPage({
            query,
            sortBy,
            page: akPageNum,
            forceRefresh: options.forceRefresh,
            page1Meta,
          });
          return { ok: true as const, data };
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          return { ok: false as const, is429: /429|503/.test(msg) };
        }
      }),
    );

    let reachedEnd = false;
    for (let i = 0; i < batchResults.length; i += 1) {
      const expectedNum = pageNums[i];
      const itemRes = batchResults[i];
      if (!itemRes.ok) {
        if (itemRes.is429) {
          rateLimited = true;
          lastValidHasNext = true;
        } else {
          lastValidHasNext = false;
        }
        reachedEnd = true;
        break;
      }

      const pageRes = itemRes.data;
      if (pageRes.products.length === 0 || pageRes.pager.currentPage !== expectedNum) {
        reachedEnd = true;
        lastValidHasNext = false;
        break;
      }

      pagesFetched += 1;
      lastValidAkPage = expectedNum;
      allFromCache = allFromCache && pageRes.fromCache;
      if (pageRes.pager.totalPages > knownTotalAkPages) {
        knownTotalAkPages = Math.min(MAX_AKAKCE_CRAWL_PAGES, pageRes.pager.totalPages);
      }
      lastValidHasNext = pageRes.pager.hasNextPage;
      lastNextUrl = pageRes.pager.nextPageUrl;

      let addedOnPage = 0;
      for (const item of pageRes.products) {
        if (!seenIds.has(item.productId)) {
          seenIds.add(item.productId);
          combined.push(item);
          addedOnPage += 1;
        }
      }
      if (addedOnPage === 0 || !pageRes.pager.hasNextPage) {
        reachedEnd = true;
        lastValidHasNext = false;
        break;
      }
    }

    if (reachedEnd) break;
    nextBatchStart = batchEnd + 1;
    if (!allFromCache && nextBatchStart <= dynamicLimit) {
      await sleep(140);
    }
  }

  const sliced = fetchAll ? combined : combined.slice(startOffset, endOffset);
  const hasMoreAfterChunk =
    fetchAll && lastValidHasNext && lastValidAkPage < Math.min(MAX_AKAKCE_CRAWL_PAGES, knownTotalAkPages);
  const nextAkakcePage = hasMoreAfterChunk ? lastValidAkPage + 1 : null;
  const hasMoreAfterSlice = combined.length > endOffset || lastValidHasNext;
  const approxTotalItems = !lastValidHasNext
    ? combined.length
    : Math.max(combined.length, knownTotalAkPages * 32);
  const totalUiPages = fetchAll ? 1 : Math.max(uiPage, Math.ceil(approxTotalItems / limit));

  const fullData: AkakceSearchResponse = {
    query,
    sortBy,
    page: uiPage,
    limit,
    totalPages: totalUiPages,
    akakceTotalPages: Math.max(lastValidAkPage, knownTotalAkPages),
    hasPrevPage: !fetchAll && uiPage > 1,
    hasNextPage: fetchAll ? Boolean(nextAkakcePage) : hasMoreAfterSlice && sliced.length > 0,
    nextPageUrl: lastNextUrl,
    pagesFetched,
    fetchedAll: fetchAll,
    nextAkakcePage,
    rateLimited: rateLimited || undefined,
    searchUrl: page1Meta.searchUrl,
    redirectedToCategory: page1Meta.redirectedToCategory,
    totalParsed: sliced.length,
    fromCache: allFromCache,
    fetchedAt: page1Meta.fetchedAt,
    products: sliced,
  };

  if (!rateLimited) {
    SEARCH_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: fullData,
    });
  }

  return fullData;
}

export async function autocompleteAkakce(query: string): Promise<{
  query: string;
  groups: AkakceAutocompleteGroup[];
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: '', groups: [] };
  }

  const url = `${AKAKCE_AC_URL}?q=${encodeURIComponent(trimmed)}`;
  const res = await fetchAkakce(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    throw new Error(`Akakçe autocomplete HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    r?: number;
    result?: {
      groups?: Array<{
        title?: string;
        items?: Array<{
          text?: string;
          action?: { url?: string; type?: string; code?: string | number };
        }>;
      }>;
    };
  };

  const groups: AkakceAutocompleteGroup[] = (json.result?.groups ?? []).map((g) => ({
    title: g.title ?? 'Sonuçlar',
    items: (g.items ?? [])
      .filter((it) => it.text && it.action?.url)
      .map((it) => {
        const akakceUrl = resolveAkakceUrl(it.action?.url ?? '');
        const code = String(it.action?.code ?? extractProductIdFromUrl(akakceUrl));
        if (it.action?.type === 'p' && code) {
          PRODUCT_URL_BY_ID.set(code, {
            title: it.text ?? '',
            akakceUrl,
            updatedAt: new Date().toISOString(),
          });
        }
        return {
          text: it.text ?? '',
          type: String(it.action?.type ?? 'p'),
          code,
          akakceUrl,
        };
      }),
  }));

  return { query: trimmed, groups };
}

async function resolveProductTargetUrl(productUrlOrId: string): Promise<string> {
  const trimmed = productUrlOrId.trim();
  if (!trimmed) {
    throw new Error('Akakçe ürün URL adresi veya ürün ID (productId) gerekli.');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return resolveAkakceUrl(trimmed);
  }
  const cached = PRODUCT_URL_BY_ID.get(trimmed);
  if (cached?.akakceUrl) {
    return cached.akakceUrl;
  }
  if (/^\d+$/.test(trimmed)) {
    return `${AKAKCE_BASE}/urun/en-ucuz-x-fiyati,${trimmed}.html`;
  }

  // Fallback: look up numeric ID or model string via Akakçe search
  const ac = await autocompleteAkakce(trimmed);
  for (const group of ac.groups) {
    for (const item of group.items) {
      if (item.code === trimmed || item.akakceUrl.includes(`,${trimmed}.html`)) {
        return item.akakceUrl;
      }
    }
  }
  if (trimmed.includes('/arama/?')) {
    throw new Error('Bu ürün Akakçe’de tek satıcılı (TEK FİYAT) ilan olarak listeleniyor; çoklu satıcı karşılaştırma sayfası bulunmuyor.');
  }
  const search = await searchAkakce({ query: trimmed, limit: 10 });
  const exact =
    search.products.find((p) => p.productId === trimmed && p.hasDetailPage) ??
    search.products.find((p) => p.hasDetailPage);
  if (exact) {
    return exact.akakceUrl;
  }
  throw new Error(`Akakçe ürün sayfası bulunamadı: "${trimmed}". Önce akakce_search ile arayıp çoklu satıcılı bir ürün URL veya productId alın.`);
}

export async function getAkakceProductDetails(
  productUrlOrId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<AkakceProductDetails> {
  const targetUrl = await resolveProductTargetUrl(productUrlOrId);
  const cached = DETAIL_CACHE.get(targetUrl);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  const res = await fetchAkakce(targetUrl, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Akakçe ürün sayfası HTTP ${res.status} döndürdü (${targetUrl}).`);
  }

  const html = await res.text();
  const finalUrl = res.url || targetUrl;
  const productId = extractProductIdFromUrl(finalUrl) || productUrlOrId;

  // 1. Parse <ul id="PL"> live seller offers
  const plMatch = html.match(/<ul[^>]*id=["']PL["'][^>]*>([\s\S]*?)<\/ul>/i);
  const offers: AkakceSellerOffer[] = [];
  if (plMatch?.[1]) {
    const liChunks = plMatch[1].split(/<li\b/i).slice(1);
    liChunks.forEach((rawLi) => {
      const li = rawLi.split('</li>')[0] ?? rawLi;
      const ptMatch = li.match(/<span[^>]*class=["'](?:[^"']*\s)?pt_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i);
      const priceTry = parseTurkishTry(decodeHtml(ptMatch?.[1] ?? ''));
      if (priceTry <= 0) return;

      const badgeText = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?bdgv_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      );
      const shippingInfo =
        decodeHtml(
          li.match(/<em[^>]*class=["'](?:[^"']*\s)?uk_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/em>/i)?.[1] ?? '',
        ) || 'Kargo bilgisi satıcıda';
      const sellerTitle = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?pn_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      );
      const campaignNote = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?vds_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      );
      const stockText = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?stock_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      );
      const shippingEta = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?sd_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      );
      const updatedAgo = decodeHtml(
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?bd_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
      ).replace(/^Son güncelleme:\s*/i, '');

      const vSpan =
        li.match(/<span[^>]*class=["'](?:[^"']*\s)?v_v8(?:\s[^"']*)?["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '';
      const imgAlt = decodeHtml(vSpan.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] ?? '');
      const vText = decodeHtml(vSpan).replace(/^\/+/, '');
      const marketplace = imgAlt || (vText.split('/')[0] ?? 'Mağaza');

      offers.push({
        rank: offers.length + 1,
        isCheapest: offers.length === 0 || /en ucuz/i.test(badgeText),
        marketplace,
        sellerName: vText || marketplace,
        sellerTitle: sellerTitle || decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''),
        priceTry,
        priceFormatted: formatTry(priceTry),
        shippingInfo,
        isFreeShipping: /ücretsiz/i.test(shippingInfo),
        campaignNote,
        stockText,
        shippingEta,
        updatedAgo,
      });
    });
  }

  // 2. Parse <table class="graph_table"> real price history
  const priceHistory: AkakcePriceHistoryRow[] = [];
  const tableMatch = html.match(/<table[^>]*class=["'][^"']*graph_table[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch?.[1]) {
    for (const trMatch of tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const tds = Array.from(trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
      if (tds.length < 4) continue;
      const date = decodeHtml(tds[0][1]);
      const lowestPriceTry = parseTurkishTry(decodeHtml(tds[1][1]));
      const changeTry = parseTurkishTry(decodeHtml(tds[2][1]));
      const pctRaw = decodeHtml(tds[3][1]).replace('%', '').replace(',', '.');
      const changePct = parseFloat(pctRaw);
      const isDown = tds[2][1].includes('green') || tds[3][1].includes('green');
      const isUp = tds[2][1].includes('red') || tds[3][1].includes('red');
      if (date && lowestPriceTry > 0) {
        priceHistory.push({
          date,
          lowestPriceTry,
          changeTry,
          changePct: Number.isFinite(changePct) ? changePct : 0,
          direction: isDown ? 'down' : isUp ? 'up' : 'flat',
        });
      }
    }
  }

  // 3. Parse JSON-LD ProductGroup metadata (specs, variants, rating, direct offer URLs)
  let title = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  let category = '';
  let description = '';
  let imageUrl = '';
  let ratingValue: number | null = null;
  let ratingCount: number | null = null;
  const specs: AkakceProductSpec[] = [];
  const variants: AkakceProductVariant[] = [];
  const similarProducts: Array<{ name: string; akakceUrl: string }> = [];

  for (const ldMatch of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const ld = JSON.parse(ldMatch[1].trim()) as Record<string, unknown>;
      if (!title && typeof ld.name === 'string') title = ld.name;
      if (typeof ld.category === 'string') category = ld.category;
      if (typeof ld.description === 'string') description = ld.description;
      if (typeof ld.image === 'string') imageUrl = ld.image;
      else if (Array.isArray(ld.image) && typeof ld.image[0] === 'string') imageUrl = ld.image[0];

      if (ld.aggregateRating && typeof ld.aggregateRating === 'object') {
        const ar = ld.aggregateRating as { ratingValue?: string | number; ratingCount?: string | number };
        const rv = Number(ar.ratingValue);
        const rc = Number(ar.ratingCount);
        if (Number.isFinite(rv)) ratingValue = rv;
        if (Number.isFinite(rc)) ratingCount = rc;
      }

      if (Array.isArray(ld.additionalProperty)) {
        for (const prop of ld.additionalProperty) {
          if (prop && typeof prop === 'object') {
            const p = prop as { name?: string; value?: string | number };
            if (p.name && p.value !== undefined) {
              specs.push({ name: String(p.name), value: String(p.value) });
            }
          }
        }
      }

      if (Array.isArray(ld.hasVariant)) {
        for (const v of ld.hasVariant) {
          if (!v || typeof v !== 'object') continue;
          const vr = v as {
            name?: string;
            sku?: string;
            color?: string;
            url?: string;
            offers?: Array<{ price?: string | number; availability?: string; url?: string; seller?: { name?: string } }>;
          };
          const vOffers = Array.isArray(vr.offers) ? vr.offers : [];
          const firstOffer = vOffers[0];
          const pVal = firstOffer?.price ? Number(firstOffer.price) : null;
          variants.push({
            name: vr.name ?? '',
            sku: vr.sku ?? '',
            color: vr.color ?? '',
            akakceUrl: vr.url ? resolveAkakceUrl(vr.url) : '',
            priceTry: pVal && pVal > 0 ? pVal : null,
            inStock: !String(firstOffer?.availability ?? '').includes('OutOfStock'),
          });

          // Match direct offer URLs from JSON-LD back into PL offers when available
          if (String(vr.sku ?? '') === productId || vr.url === finalUrl) {
            for (const jOffer of vOffers) {
              if (!jOffer.url || !jOffer.price) continue;
              const jPrice = Number(jOffer.price);
              const matched = offers.find(
                (o) => Math.abs(o.priceTry - jPrice) < 1 && !o.directUrl,
              );
              if (matched) matched.directUrl = jOffer.url;
            }
          }
        }
      }

      if (Array.isArray(ld.isSimilarTo)) {
        for (const sim of ld.isSimilarTo.slice(0, 8)) {
          if (sim && typeof sim === 'object') {
            const s = sim as { name?: string; url?: string };
            if (s.name && s.url) {
              similarProducts.push({ name: s.name, akakceUrl: resolveAkakceUrl(s.url) });
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  if (!imageUrl) {
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (ogImg) imageUrl = resolveAkakceUrl(ogImg);
  }

  const prices = offers.map((o) => o.priceTry).filter((p) => p > 0);
  const lowestPriceTry = prices.length > 0 ? Math.min(...prices) : 0;
  const highestListedPriceTry = prices.length > 0 ? Math.max(...prices) : 0;

  if (productId && title) {
    PRODUCT_URL_BY_ID.set(productId, {
      title,
      akakceUrl: finalUrl,
      updatedAt: new Date().toISOString(),
    });
  }

  const details: AkakceProductDetails = {
    productId,
    title: title || `Akakçe #${productId}`,
    category,
    description,
    akakceUrl: finalUrl,
    imageUrl,
    lowestPriceTry,
    highestListedPriceTry,
    offerCount: offers.length,
    ratingValue,
    ratingCount,
    fromCache: false,
    fetchedAt: new Date().toISOString(),
    offers,
    priceHistory,
    specs,
    variants,
    similarProducts,
  };

  DETAIL_CACHE.set(targetUrl, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: details,
  });

  return details;
}

export function getAkakceCacheSummary() {
  return {
    cachedSearches: SEARCH_CACHE.size,
    cachedProductDetails: DETAIL_CACHE.size,
    knownProductIds: Array.from(PRODUCT_URL_BY_ID.entries())
      .slice(-25)
      .reverse()
      .map(([productId, info]) => ({
        productId,
        ...info,
      })),
  };
}
