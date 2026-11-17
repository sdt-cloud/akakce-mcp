import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Package, Search, X } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type {
  AkakceAutocompleteGroup,
  AkakceProductDetails,
  AkakceSearchProduct,
  AkakceSearchResponse,
  AkakceSortBy,
  JsonRpcResponse,
} from '../mcp/types';

interface LiveSearchViewProps {
  language: Language;
}

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

export function LiveSearchView({ language }: LiveSearchViewProps) {
  const t = TRANSLATIONS[language].searchView;

  const [query, setQuery] = useState('Samsung A35');
  const [sortBy, setSortBy] = useState<AkakceSortBy>('popularity');
  const [page, setPage] = useState(1);
  const [resultMode, setResultMode] = useState<25 | 50 | 100 | 'all'>(50);
  const [forceRefresh, setForceRefresh] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<AkakceSearchResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [listFilter, setListFilter] = useState('');
  const crawlRunIdRef = useRef(0);

  const [acGroups, setAcGroups] = useState<AkakceAutocompleteGroup[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<AkakceSearchProduct | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<AkakceProductDetails | null>(null);
  const [detailTab, setDetailTab] = useState<'sellers' | 'history' | 'specs'>('sellers');

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
      throw new Error(String(result.structuredContent?.error ?? 'Akakçe MCP hatası'));
    }
    return result?.structuredContent ?? {};
  }, []);

  const executeSearch = useCallback(
    async (
      targetQuery: string,
      targetSort: AkakceSortBy,
      targetPage: number,
      targetMode: 25 | 50 | 100 | 'all',
      bypassCache: boolean,
    ) => {
      const trimmed = targetQuery.trim();
      if (!trimmed) return;

      const runId = ++crawlRunIdRef.current;
      const isAll = targetMode === 'all';
      setIsSearching(true);
      setIsLoadingMore(false);
      setSearchError(null);
      setListFilter('');
      setAcOpen(false);
      setPage(isAll ? 1 : targetPage);
      const t0 = performance.now();

      try {
        const firstChunk = (await callMcpTool('akakce_search', {
          query: trimmed,
          sortBy: targetSort,
          page: isAll ? 1 : targetPage,
          limit: isAll ? 2500 : targetMode,
          fetchAll: isAll,
          startAkakcePage: 1,
          forceRefresh: bypassCache,
        })) as unknown as AkakceSearchResponse;

        if (crawlRunIdRef.current !== runId) return;
        setLatencyMs(Math.round(performance.now() - t0));
        setSearchResult(firstChunk);
        setIsSearching(false);

        if (isAll && firstChunk.nextAkakcePage) {
          setIsLoadingMore(true);
          let nextAkPage: number | null = firstChunk.nextAkakcePage;
          let wasRateLimited = Boolean(firstChunk.rateLimited);
          const mergedProducts = [...firstChunk.products];
          const seenIds = new Set(mergedProducts.map((p) => p.productId));
          let totalPagesFetched = firstChunk.pagesFetched;

          while (nextAkPage && crawlRunIdRef.current === runId) {
            await new Promise((resolve) =>
              setTimeout(resolve, wasRateLimited ? 4000 : 1200),
            );
            if (crawlRunIdRef.current !== runId) return;

            try {
              const chunk = (await callMcpTool('akakce_search', {
                query: trimmed,
                sortBy: targetSort,
                limit: 2500,
                fetchAll: true,
                startAkakcePage: nextAkPage,
                forceRefresh: bypassCache,
              })) as unknown as AkakceSearchResponse;

              if (crawlRunIdRef.current !== runId) return;
              for (const item of chunk.products) {
                if (!seenIds.has(item.productId)) {
                  seenIds.add(item.productId);
                  mergedProducts.push(item);
                }
              }
              totalPagesFetched += chunk.pagesFetched;
              nextAkPage = chunk.nextAkakcePage;
              wasRateLimited = Boolean(chunk.rateLimited);

              setLatencyMs(Math.round(performance.now() - t0));
              setSearchResult({
                ...chunk,
                pagesFetched: totalPagesFetched,
                totalParsed: mergedProducts.length,
                products: [...mergedProducts],
              });

              if (chunk.products.length === 0 && !chunk.rateLimited) break;
            } catch {
              break;
            }
          }
          if (crawlRunIdRef.current === runId) {
            setIsLoadingMore(false);
          }
        }
      } catch (err) {
        if (crawlRunIdRef.current !== runId) return;
        setLatencyMs(Math.round(performance.now() - t0));
        setSearchError(err instanceof Error ? err.message : 'Akakçe araması başarısız.');
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    },
    [callMcpTool],
  );

  const inspectProduct = useCallback(
    async (productUrlOrId: string, preview?: AkakceSearchProduct) => {
      if (preview) setSelectedProduct(preview);
      setDetailsLoading(true);
      setDetailsError(null);
      setDetailTab('sellers');

      try {
        const details = (await callMcpTool('akakce_get_product_offers', {
          productUrlOrId,
          forceRefresh: false,
        })) as unknown as AkakceProductDetails & { priceHistory?: AkakceProductDetails['priceHistory'] };

        // Fetch price history in parallel / fallback if missing from offers call
        const historyData = (await callMcpTool('akakce_get_price_history', {
          productUrlOrId: details.akakceUrl || productUrlOrId,
          forceRefresh: false,
        })) as { priceHistory?: AkakceProductDetails['priceHistory'] };

        setProductDetails({
          ...details,
          priceHistory: historyData.priceHistory ?? details.priceHistory ?? [],
        });
      } catch (err) {
        setDetailsError(err instanceof Error ? err.message : 'Ürün detayı alınamadı.');
      } finally {
        setDetailsLoading(false);
      }
    },
    [callMcpTool],
  );

  useEffect(() => {
    void executeSearch('Samsung A35', 'popularity', 1, 50, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setAcGroups([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/akakce/autocomplete?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { groups?: AkakceAutocompleteGroup[] };
        setAcGroups(json.groups ?? []);
      } catch {
        // Ignore transient autocomplete cancel
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setAcOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeSearch(query, sortBy, 1, resultMode, forceRefresh);
  };

  const productSuggestions =
    acGroups.find((g) => g.items.some((it) => it.type === 'p'))?.items.slice(0, 6) ?? [];

  const normalizedFilter = listFilter.trim().toLocaleLowerCase('tr-TR');
  const visibleProducts = !searchResult
    ? []
    : !normalizedFilter
      ? searchResult.products
      : searchResult.products.filter(
          (p) =>
            p.title.toLocaleLowerCase('tr-TR').includes(normalizedFilter) ||
            p.brand.toLocaleLowerCase('tr-TR').includes(normalizedFilter),
        );

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

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div ref={searchBoxRef} className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onFocus={() => {
                  if (productSuggestions.length > 0) setAcOpen(true);
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAcOpen(true);
                }}
                placeholder={t.placeholder}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />

              {acOpen && productSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-500">
                    {t.autocompleteProducts}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {productSuggestions.map((item) => (
                      <button
                        key={`${item.code}-${item.akakceUrl}`}
                        type="button"
                        onClick={() => {
                          setQuery(item.text);
                          setAcOpen(false);
                          void executeSearch(item.text, sortBy, 1, resultMode, false);
                          if (item.type === 'p' && item.akakceUrl) {
                            void inspectProduct(item.akakceUrl, {
                              productId: item.code,
                              title: item.text,
                              brand: item.text.split(/\s+/)[0] || '',
                              lowestPriceTry: 0,
                              priceFormatted: '',
                              offerCount: 0,
                              followersCount: 0,
                              discountPct: null,
                              colors: [],
                              hasDetailPage: true,
                              akakceUrl: item.akakceUrl,
                              imageUrl: '',
                            });
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <span className="truncate">{item.text}</span>
                        <span className="font-mono text-xs text-slate-400 shrink-0">
                          #{item.code}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>{isSearching ? t.searchingButton : t.searchButton}</span>
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
                    void executeSearch(sample, sortBy, 1, resultMode, forceRefresh);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {([25, 50, 100, 'all'] as const).map((modeOpt) => (
                  <button
                    key={String(modeOpt)}
                    type="button"
                    onClick={() => {
                      setResultMode(modeOpt);
                      if (query.trim()) {
                        void executeSearch(query, sortBy, 1, modeOpt, forceRefresh);
                      }
                    }}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                      resultMode === modeOpt
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {modeOpt === 'all' ? t.allResultsOption : `${modeOpt} ${t.perPageLabel}`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(['popularity', 'lowest_price', 'highest_price'] as AkakceSortBy[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSortBy(mode);
                      if (query.trim()) {
                        void executeSearch(query, mode, 1, resultMode, forceRefresh);
                      }
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      sortBy === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.sorts[mode]}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>{t.forceRefreshLabel}</span>
              </label>
            </div>
          </div>
        </form>
      </div>

      {searchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchError}
        </div>
      )}

      {(selectedProduct || detailsLoading || productDetails || detailsError) && (
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {productDetails?.title ?? selectedProduct?.title ?? ''}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                <span>ID #{productDetails?.productId ?? selectedProduct?.productId}</span>
                {productDetails?.category && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{productDetails.category}</span>
                  </>
                )}
                {productDetails?.ratingValue !== null && productDetails?.ratingValue !== undefined && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t.ratingLabel} {productDetails.ratingValue}/5 ({productDetails.ratingCount ?? 0}{' '}
                      {t.reviewsSuffix})
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {(productDetails?.akakceUrl || selectedProduct?.akakceUrl) && (
                <a
                  href={productDetails?.akakceUrl || selectedProduct?.akakceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                >
                  <span>{t.openOnAkakce}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetails(null);
                  setDetailsError(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.closeDetails}</span>
              </button>
            </div>
          </div>

          {detailsLoading ? (
            <div className="p-6 text-sm text-slate-600">{t.detailsLoading}</div>
          ) : detailsError ? (
            <div className="p-5 text-sm text-red-700">{detailsError}</div>
          ) : productDetails ? (
            <div className="space-y-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('sellers')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      detailTab === 'sellers'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.sellersTab} ({productDetails.offers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('history')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      detailTab === 'history'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.historyTab} ({productDetails.priceHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('specs')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      detailTab === 'specs'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.specsTab} ({productDetails.specs.length})
                  </button>
                </div>

                {productDetails.lowestPriceTry > 0 && (
                  <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {t.currentPriceLabel}: {formatTry(productDetails.lowestPriceTry)}
                  </div>
                )}
              </div>

              {detailTab === 'sellers' && (
                <>
                  {productDetails.offers.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">{t.noOffersParsed}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="px-4 py-2.5">{t.rankCol}</th>
                            <th className="px-4 py-2.5">{t.marketplaceSellerCol}</th>
                            <th className="px-4 py-2.5">{t.listingTitleCol}</th>
                            <th className="px-4 py-2.5">{t.shippingStockCol}</th>
                            <th className="px-4 py-2.5 text-right">{t.priceCol}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {productDetails.offers.map((offer) => (
                            <tr
                              key={`${offer.rank}-${offer.sellerName}-${offer.priceTry}`}
                              className={offer.isCheapest ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'}
                            >
                              <td className="px-4 py-3 font-mono text-xs tabular-nums whitespace-nowrap">
                                {offer.isCheapest ? (
                                  <span className="font-semibold text-emerald-700">
                                    #1 {t.cheapestBadge}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">#{offer.rank}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{offer.marketplace}</div>
                                <div className="text-xs text-slate-500">{offer.sellerName}</div>
                              </td>
                              <td className="px-4 py-3 max-w-md">
                                <div className="text-xs font-medium text-slate-800 line-clamp-2">
                                  {offer.sellerTitle}
                                </div>
                                {offer.campaignNote && (
                                  <div className="text-xs text-slate-500 truncate">
                                    {offer.campaignNote}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                <div>{offer.shippingInfo}</div>
                                <div className="text-slate-400">
                                  {[offer.shippingEta, offer.stockText, offer.updatedAgo]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                {offer.directUrl ? (
                                  <a
                                    href={offer.directUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                                  >
                                    <span>{offer.priceFormatted}</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                  </a>
                                ) : (
                                  offer.priceFormatted
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {productDetails.variants.length > 0 && (
                    <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 space-y-2">
                      <div className="text-xs font-semibold text-slate-600">{t.variantsTitle}</div>
                      <div className="flex flex-wrap gap-2">
                        {productDetails.variants.map((v) => (
                          <button
                            key={v.sku || v.name}
                            type="button"
                            disabled={!v.akakceUrl}
                            onClick={() => {
                              if (v.akakceUrl) void inspectProduct(v.akakceUrl);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
                          >
                            <span className="font-medium">{v.color || v.name}</span>
                            {v.priceTry ? (
                              <span className="ml-2 font-mono text-slate-900 tabular-nums">
                                {formatTry(v.priceTry)}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'history' && (
                <div className="p-4 space-y-4">
                  {productDetails.priceHistory.length === 0 ? (
                    <div className="py-4 text-sm text-slate-500">{t.noHistoryParsed}</div>
                  ) : (
                    <>
                      <PriceHistoryChart
                        language={language}
                        rows={productDetails.priceHistory}
                        currentPriceTry={productDetails.lowestPriceTry}
                      />
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                              <th className="px-4 py-2">{t.dateCol}</th>
                              <th className="px-4 py-2 text-right">{t.lowestHistoryCol}</th>
                              <th className="px-4 py-2 text-right">{t.changeCol}</th>
                              <th className="px-4 py-2 text-right">{t.percentCol}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                            {productDetails.priceHistory.map((row, idx) => (
                              <tr key={`${row.date}-${idx}`} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-700">{row.date}</td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                  {formatTry(row.lowestPriceTry)}
                                </td>
                                <td
                                  className={`px-4 py-2 text-right ${
                                    row.direction === 'down'
                                      ? 'text-emerald-700'
                                      : row.direction === 'up'
                                        ? 'text-red-700'
                                        : 'text-slate-500'
                                  }`}
                                >
                                  {row.changeTry > 0
                                    ? `${row.direction === 'down' ? '-' : '+'}${formatTry(row.changeTry)}`
                                    : '—'}
                                </td>
                                <td
                                  className={`px-4 py-2 text-right ${
                                    row.direction === 'down'
                                      ? 'text-emerald-700'
                                      : row.direction === 'up'
                                        ? 'text-red-700'
                                        : 'text-slate-500'
                                  }`}
                                >
                                  {row.changePct > 0 ? `%${row.changePct.toFixed(2)}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detailTab === 'specs' && (
                <div className="p-4">
                  {productDetails.specs.length === 0 ? (
                    <div className="text-sm text-slate-500">Bu ürün için teknik tablo bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                      {productDetails.specs.map((sp) => (
                        <div
                          key={sp.name}
                          className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
                        >
                          <span className="text-slate-500">{sp.name}</span>
                          <span className="font-medium text-slate-900 text-right">{sp.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{t.resultsTitle}</span>
            {searchResult?.redirectedToCategory && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">{t.categoryRedirectNote}</span>
              </>
            )}
          </div>

          {searchResult && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
              <span>{searchResult.fromCache ? t.cacheHitLabel : t.liveFetchLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {searchResult.products.length} {t.resultsCountSuffix}
              </span>
              {searchResult.pagesFetched > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {searchResult.pagesFetched} {t.akakcePagesSuffix}
                  </span>
                </>
              )}
              {latencyMs !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{latencyMs} ms</span>
                </>
              )}
              <a
                href={searchResult.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-sans font-medium text-blue-700 hover:underline"
              >
                <span>akakce.com</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        {isLoadingMore && searchResult && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-900">
            <span className="font-mono tabular-nums">
              {t.loadingMoreLabel}: {searchResult.products.length} {t.resultsCountSuffix} (
              {searchResult.pagesFetched} / {searchResult.akakceTotalPages} {t.akakcePagesSuffix})
            </span>
            <button
              type="button"
              onClick={() => {
                crawlRunIdRef.current += 1;
                setIsLoadingMore(false);
              }}
              className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
            >
              {t.stopCrawlingLabel}
            </button>
          </div>
        )}

        {searchResult && searchResult.products.length > 50 && !isSearching && (
          <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
            <input
              type="text"
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder={t.filterResultsPlaceholder}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        )}

        {isSearching ? (
          <div className="divide-y divide-slate-200">
            {resultMode === 'all' && (
              <div className="bg-blue-50/70 px-4 py-2.5 text-xs font-medium text-blue-800">
                {t.crawlingAllNote}
              </div>
            )}
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 rounded-lg bg-slate-100" />
                  <div className="space-y-2">
                    <div className="h-4 w-64 rounded bg-slate-200" />
                    <div className="h-3 w-40 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-5 w-24 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : !searchResult ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.initialPrompt}</div>
        ) : visibleProducts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.noResults}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleProducts.map((product) => {
              const isSelected = selectedProduct?.productId === product.productId;
              return (
                <div
                  key={product.productId}
                  className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ProductThumb src={product.imageUrl} alt={product.title} />
                    <div className="min-w-0 space-y-1">
                      {product.hasDetailPage ? (
                        <button
                          type="button"
                          onClick={() => void inspectProduct(product.akakceUrl, product)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 line-clamp-2"
                        >
                          {product.title}
                        </button>
                      ) : (
                        <a
                          href={product.akakceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-left text-sm font-semibold text-slate-900 hover:text-blue-700 line-clamp-2"
                        >
                          {product.title}
                        </a>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono">
                        <span>{product.brand}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {product.offerCount} {t.offerCountSuffix}
                        </span>
                        {!product.hasDetailPage && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{t.singleSellerNote}</span>
                          </>
                        )}
                        {product.followersCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {product.followersCount} {t.followersSuffix}
                            </span>
                          </>
                        )}
                        {product.discountPct !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-emerald-700">
                              {t.discountPrefix} %{product.discountPct}
                            </span>
                          </>
                        )}
                        {product.colors.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">{product.colors.join(', ')}</span>
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
                      <div className="font-mono text-xs text-slate-400">#{product.productId}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {product.hasDetailPage ? (
                        <button
                          type="button"
                          onClick={() => void inspectProduct(product.akakceUrl, product)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
                        >
                          {t.inspectOffersBtn}
                        </button>
                      ) : (
                        <a
                          href={product.akakceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 whitespace-nowrap"
                        >
                          {t.searchOnAkakce}
                        </a>
                      )}
                      <a
                        href={product.akakceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                        title={t.openOnAkakce}
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

        {searchResult && !searchResult.fetchedAll && (searchResult.hasPrevPage || searchResult.hasNextPage) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="font-mono text-xs text-slate-600 tabular-nums">
              {t.pageLabel} {page} / {searchResult.totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSearching || !searchResult.hasPrevPage}
                onClick={() => {
                  const prevPageNum = Math.max(1, page - 1);
                  void executeSearch(query, sortBy, prevPageNum, resultMode, forceRefresh);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.prevPage}</span>
              </button>

              <button
                type="button"
                disabled={isSearching || !searchResult.hasNextPage}
                onClick={() => {
                  void executeSearch(query, sortBy, page + 1, resultMode, forceRefresh);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <span>{t.nextPage}</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PriceHistoryChart({
  language,
  rows,
  currentPriceTry,
}: {
  language: Language;
  rows: AkakceProductDetails['priceHistory'];
  currentPriceTry: number;
}) {
  const t = TRANSLATIONS[language].searchView;
  const chronological = [...rows].reverse();
  const values = chronological.map((r) => r.lowestPriceTry);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = Math.max(1, maxVal - minVal);

  const width = 680;
  const height = 160;
  const padX = 16;
  const padY = 16;

  const points = chronological
    .map((pt, i) => {
      const x = padX + (i / Math.max(1, chronological.length - 1)) * (width - padX * 2);
      const y = height - padY - ((pt.lowestPriceTry - minVal) / span) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-3">
        <div>
          <div className="text-xs text-slate-500">{t.currentPriceLabel}</div>
          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
            {formatTry(currentPriceTry || values[values.length - 1] || 0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t.minRecordedLabel}</div>
          <div className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
            {formatTry(minVal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t.maxRecordedLabel}</div>
          <div className="font-mono text-sm font-bold text-slate-700 tabular-nums">
            {formatTry(maxVal)}
          </div>
        </div>
      </div>

      {chronological.length >= 2 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-40 w-full rounded-lg border border-slate-200 bg-slate-50"
          role="img"
          aria-label={t.historyTab}
        >
          <polyline fill="none" stroke="#1d4ed8" strokeWidth="2.5" points={points} />
        </svg>
      )}
    </div>
  );
}
