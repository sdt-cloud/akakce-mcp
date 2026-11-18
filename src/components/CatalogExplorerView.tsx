import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Focus, Package, RefreshCw, Scale, Search, X } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type {
  AktuelBrochure,
  AktuelCampaign,
  AktuelCategory,
  AktuelMarketCheckResult,
  AktuelProduct,
  AktuelSearchResponse,
  AktuelSortBy,
  AktuelTimingStatus,
  AktuelWeeklySummaryResponse,
  JsonRpcResponse,
  MarketFilter,
} from '../mcp/types';
import { findBrochureForProduct, getProductsForBrochure } from '../utils/brochureLinks';
import { BrochureZoomModal } from './BrochureZoomModal';

interface CatalogExplorerViewProps {
  language: Language;
}

const CATEGORIES: Array<AktuelCategory | 'hepsi'> = [
  'hepsi',
  'elektronik',
  'mutfak',
  'kamp',
  'ev_yasam',
  'yapi_oto',
  'oyuncak',
  'giyim',
  'gida',
];

function formatTry(val: number): string {
  return `${val.toLocaleString('tr-TR', {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
        <Package className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
    />
  );
}

export function CatalogExplorerView({ language }: CatalogExplorerViewProps) {
  const t = TRANSLATIONS[language].catalogView;
  const catLabels = TRANSLATIONS[language].categories;
  const timingLabels = TRANSLATIONS[language].timings;

  const [query, setQuery] = useState('');
  const [market, setMarket] = useState<MarketFilter>('hepsi');
  const [category, setCategory] = useState<AktuelCategory | 'hepsi'>('hepsi');
  const [timing, setTiming] = useState<AktuelTimingStatus | 'hepsi'>('hepsi');
  const [sortBy, setSortBy] = useState<AktuelSortBy>('lowest_price');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<AktuelProduct[]>([]);
  const [brochures, setBrochures] = useState<AktuelBrochure[]>([]);
  const [campaigns, setCampaigns] = useState<AktuelCampaign[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [totalMatched, setTotalMatched] = useState(0);
  const [appliedSynonyms, setAppliedSynonyms] = useState<string[]>([]);

  const [comparingId, setComparingId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<AktuelMarketCheckResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [brochureModal, setBrochureModal] = useState<{
    brochure: AktuelBrochure;
    brochureProducts: AktuelProduct[];
    product: AktuelProduct;
  } | null>(null);

  const callMcpTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    const res = await fetch('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    const json = (await res.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(json.error.message);
    }
    const result = json.result as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
    };
    if (result?.isError) {
      throw new Error(String(result.structuredContent?.error ?? 'Aktüel MCP hatası'));
    }
    return result?.structuredContent ?? {};
  }, []);

  const loadCatalog = useCallback(
    async (
      targetQuery: string,
      targetMarket: MarketFilter,
      targetCategory: AktuelCategory | 'hepsi',
      targetTiming: AktuelTimingStatus | 'hepsi',
      targetSort: AktuelSortBy,
      forceRefresh = false,
    ) => {
      setIsLoading(true);
      setErrorMsg(null);
      const t0 = performance.now();

      try {
        if (forceRefresh) {
          const weekly = (await callMcpTool('aktuel_bu_hafta', {
            market: targetMarket,
            onlyActiveOrUpcoming: false,
            limitPerMarket: 100,
            forceRefresh: true,
          })) as unknown as AktuelWeeklySummaryResponse;

          setCampaigns(weekly.marketSummaries.flatMap((m) => m.campaigns));
          setBrochures(weekly.brochures ?? []);
        }

        const trimmed = targetQuery.trim();
        let searchPayload: AktuelSearchResponse;

        if (!trimmed && targetCategory !== 'hepsi' && targetTiming === 'hepsi') {
          searchPayload = (await callMcpTool('aktuel_kategori', {
            kategori: targetCategory,
            market: targetMarket,
            sortBy: targetSort === 'highest_price' ? 'highest_price' : 'lowest_price',
            limit: 120,
          })) as unknown as AktuelSearchResponse;
        } else {
          searchPayload = (await callMcpTool('aktuel_urun_ara', {
            query: trimmed,
            market: targetMarket,
            category: targetCategory,
            sortBy: trimmed ? targetSort : targetSort === 'relevance' ? 'lowest_price' : targetSort,
            timing: targetTiming,
            limit: 120,
          })) as unknown as AktuelSearchResponse;
        }

        setProducts(searchPayload.products);
        setTotalMatched(searchPayload.totalMatched);
        setAppliedSynonyms(searchPayload.appliedSynonyms ?? []);
        setFromCache(searchPayload.fromCache);
        setLatencyMs(Math.round(performance.now() - t0));

        if (campaigns.length === 0 && !forceRefresh) {
          const cal = (await callMcpTool('aktuel_takvim', {
            market: 'hepsi',
            durum: 'hepsi',
          })) as { campaigns?: AktuelCampaign[] };
          if (cal.campaigns) {
            setCampaigns(cal.campaigns);
          }
        }
        if (brochures.length === 0 && !forceRefresh) {
          const broRes = (await callMcpTool('aktuel_brosurler', {
            market: 'hepsi',
            forceRefresh: false,
          })) as { brochures?: AktuelBrochure[] };
          if (broRes.brochures) {
            setBrochures(broRes.brochures);
          }
        }
      } catch (err) {
        setLatencyMs(Math.round(performance.now() - t0));
        setErrorMsg(err instanceof Error ? err.message : 'Aktüel katalog yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    },
    [brochures.length, callMcpTool, campaigns.length],
  );

  useEffect(() => {
    void loadCatalog('', 'hepsi', 'hepsi', 'hepsi', 'lowest_price', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadCatalog(query, market, category, timing, sortBy, false);
  };

  const handleCompareOnline = async (item: AktuelProduct) => {
    setComparingId(item.id);
    setCompareError(null);
    try {
      const res = (await callMcpTool('aktuel_piyasa_karsilastir', {
        query: item.title,
        market: item.market,
      })) as unknown as AktuelMarketCheckResult;
      setCompareResult({
        ...res,
        dealAssessment: {
          ...res.dealAssessment,
          cheapestAktuelProduct: item,
        },
      });
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Piyasa kıyaslaması yapılamadı.');
    } finally {
      setComparingId(null);
    }
  };

  const marketOptions: Array<{ id: MarketFilter; label: string }> = [
    { id: 'hepsi', label: t.marketAll },
    { id: 'bim', label: 'BİM' },
    { id: 'a101', label: 'A101' },
    { id: 'sok', label: 'ŞOK' },
  ];

  const timingOptions: Array<AktuelTimingStatus | 'hepsi'> = ['hepsi', 'aktif', 'yaklasan'];

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-medium text-blue-700">{t.kicker}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {t.title}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.placeholder}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>{isLoading ? t.loadingButton : t.searchButton}</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void loadCatalog(query, market, category, timing, sortBy, true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{t.forceRefreshLabel}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {t.quickQueries.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuery(sample);
                    void loadCatalog(sample, market, category, timing, 'relevance', false);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {marketOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMarket(m.id);
                      void loadCatalog(query, m.id, category, timing, sortBy, false);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      market === m.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {timingOptions.map((tm) => (
                  <button
                    key={tm}
                    type="button"
                    onClick={() => {
                      setTiming(tm);
                      void loadCatalog(query, market, category, tm, sortBy, false);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      timing === tm
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {timingLabels[tm]}
                  </button>
                ))}
              </div>

              <select
                value={category}
                onChange={(e) => {
                  const nextCat = e.target.value as AktuelCategory | 'hepsi';
                  setCategory(nextCat);
                  void loadCatalog(query, market, nextCat, timing, sortBy, false);
                }}
                aria-label="Category filter"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {catLabels[cat]}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => {
                  const nextSort = e.target.value as AktuelSortBy;
                  setSortBy(nextSort);
                  void loadCatalog(query, market, category, timing, nextSort, false);
                }}
                aria-label="Sort filter"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="lowest_price">{t.sortLowest}</option>
                <option value="highest_price">{t.sortHighest}</option>
                <option value="relevance">{t.sortRelevance}</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {campaigns.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">{t.campaignsStripTitle}</div>
          <div className="flex flex-wrap gap-2">
            {campaigns.slice(0, 9).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setMarket(c.market);
                  void loadCatalog(query, c.market, category, c.timingStatus, sortBy, false);
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
              >
                <span className="font-semibold text-slate-900">{c.marketLabel}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-700">{c.title.replace(/^(BİM|A101|ŞOK)\s+/i, '')}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono text-slate-500 tabular-nums">{c.productCount}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {compareError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {compareError}
        </div>
      )}

      {compareResult && (
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-mono font-semibold text-blue-700">
                {t.comparePanelTitle}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {compareResult.dealAssessment.cheapestAktuelProduct?.title ?? compareResult.query}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompareResult(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.closePanel}</span>
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-3 sm:pb-0 sm:pr-4">
                <div className="text-xs text-slate-500">{t.aktuelPriceLabel}</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {compareResult.dealAssessment.cheapestAktuelProduct?.priceFormatted ?? '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {compareResult.dealAssessment.cheapestAktuelProduct?.marketLabel} ·{' '}
                  {compareResult.dealAssessment.cheapestAktuelProduct?.dayLabel}
                </div>
              </div>

              <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-3 sm:pb-0 sm:pr-4">
                <div className="text-xs text-slate-500">{t.akakceLowestLabel}</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {compareResult.akakceReference.lowestOnlineFormatted ?? '—'}
                </div>
                <a
                  href={compareResult.akakceReference.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  <span>akakce.com</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  {t.verdictLabels[compareResult.dealAssessment.verdict]}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {compareResult.dealAssessment.summary}
                </p>
              </div>
            </div>

            {compareResult.akakceReference.topOnlineMatches.length > 0 ? (
              <div className="border-t border-slate-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">
                  {t.onlineMatchesTitle}
                </div>
                <div className="divide-y divide-slate-100">
                  {compareResult.akakceReference.topOnlineMatches.map((m) => (
                    <div
                      key={m.productId}
                      className="flex items-center justify-between gap-4 py-2 text-xs"
                    >
                      <a
                        href={m.akakceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-800 hover:text-blue-700 truncate"
                      >
                        {m.title}
                      </a>
                      <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                        {m.priceFormatted}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                {t.noOnlineMatches}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-900">{t.resultsTitle}</span>
            {appliedSynonyms.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 truncate">
                  {appliedSynonyms.slice(0, 4).join(' · ')}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
            <span>{fromCache ? t.cacheHitLabel : t.liveFetchLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              {products.length} / {totalMatched} {t.resultsCountSuffix}
            </span>
            {latencyMs !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>{latencyMs} ms</span>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">{t.loadingNote}</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.noResults}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {products.map((product) => {
              const isComparing = comparingId === product.id;
              return (
                <div
                  key={product.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ProductThumb src={product.imageUrl} alt={product.title} />
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {product.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{product.marketLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.campaignTitle.replace(/^(BİM|A101|ŞOK)\s+/i, '')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{catLabels[product.category] ?? product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            product.timingStatus === 'aktif'
                              ? 'font-medium text-emerald-700'
                              : product.timingStatus === 'yaklasan'
                                ? 'font-medium text-blue-700'
                                : 'text-slate-400'
                          }
                        >
                          {timingLabels[product.timingStatus]}
                        </span>
                        {product.installmentInfo && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{product.installmentInfo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-base font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {product.priceFormatted}
                      </div>
                      {product.oldPriceTry && (
                        <div className="font-mono text-xs text-slate-400 line-through tabular-nums">
                          {formatTry(product.oldPriceTry)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const matchedBrochure = findBrochureForProduct(product, brochures);
                        if (!matchedBrochure) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setBrochureModal({
                                brochure: matchedBrochure,
                                brochureProducts: getProductsForBrochure(matchedBrochure, products),
                                product,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
                          >
                            <Focus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.viewInBrochureBtn}</span>
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        disabled={isComparing}
                        onClick={() => void handleCompareOnline(product)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isComparing ? t.comparingBtn : t.compareBtn}</span>
                      </button>

                      <a
                        href={product.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                        title={t.openSourceBtn}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {brochureModal && (
        <BrochureZoomModal
          language={language}
          brochure={brochureModal.brochure}
          brochureProducts={brochureModal.brochureProducts}
          initialPageIndex={0}
          initialProduct={brochureModal.product}
          onClose={() => setBrochureModal(null)}
        />
      )}
    </div>
  );
}
