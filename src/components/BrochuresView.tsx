import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Focus, Image as ImageIcon, RefreshCw, Search } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type {
  AktuelBrochure,
  AktuelProduct,
  AktuelWeeklySummaryResponse,
  JsonRpcResponse,
  MarketFilter,
} from '../mcp/types';
import { BrochureZoomModal } from './BrochureZoomModal';
import { getProductsForBrochure } from '../utils/brochureLinks';
import { matchAktuelQueryScore } from '../utils/aktuelSearch';

interface BrochuresViewProps {
  language: Language;
}

interface BrochureModalState {
  brochure: AktuelBrochure;
  brochureProducts: AktuelProduct[];
  initialPageIndex: number;
  initialProduct: AktuelProduct | null;
}

export function BrochuresView({ language }: BrochuresViewProps) {
  const t = TRANSLATIONS[language].brochuresView;
  const timingLabels = TRANSLATIONS[language].timings;

  const [market, setMarket] = useState<MarketFilter>('hepsi');
  const [brochures, setBrochures] = useState<AktuelBrochure[]>([]);
  const [products, setProducts] = useState<AktuelProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [expandedBrochures, setExpandedBrochures] = useState<Record<string, boolean>>({});
  const [productFilterByBrochure, setProductFilterByBrochure] = useState<Record<string, string>>({});
  const [modalState, setModalState] = useState<BrochureModalState | null>(null);

  const loadBrochures = useCallback(async (targetMarket: MarketFilter, forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'aktuel_bu_hafta',
            arguments: {
              market: targetMarket,
              onlyActiveOrUpcoming: false,
              limitPerMarket: 250,
              forceRefresh,
            },
          },
        }),
      });
      const json = (await res.json()) as JsonRpcResponse;
      if (json.error) throw new Error(json.error.message);
      const result = json.result as {
        isError?: boolean;
        structuredContent?: AktuelWeeklySummaryResponse & { error?: string };
      };
      if (result?.isError) {
        throw new Error(result.structuredContent?.error ?? 'Broşürler yüklenemedi.');
      }
      setBrochures(result?.structuredContent?.brochures ?? []);
      setProducts(result?.structuredContent?.products ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Broşürler alınamadı.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrochures(market, false);
  }, [loadBrochures, market]);

  const productsMap = useMemo(() => {
    const map = new Map<string, AktuelProduct[]>();
    for (const b of brochures) {
      map.set(b.id, getProductsForBrochure(b, products));
    }
    return map;
  }, [brochures, products]);

  const marketTabs: Array<{ id: MarketFilter; label: string }> = [
    { id: 'hepsi', label: t.allMarkets },
    { id: 'bim', label: 'BİM' },
    { id: 'a101', label: 'A101' },
    { id: 'sok', label: 'ŞOK' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-medium text-blue-700">{t.kicker}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{t.title}</h1>
          <p className="max-w-3xl text-sm text-slate-600">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {marketTabs.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMarket(m.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  market === m.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadBrochures(market, true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{t.refreshBtn}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          {t.loadingNote}
        </div>
      ) : brochures.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t.emptyNote}
        </div>
      ) : (
        <div className="space-y-6">
          {brochures.map((brochure) => {
            const linkedProducts = productsMap.get(brochure.id) ?? [];
            const filterText = (productFilterByBrochure[brochure.id] ?? '').trim();
            const filteredProducts = filterText
              ? linkedProducts
                  .map((p) => ({ p, score: matchAktuelQueryScore(p, filterText) }))
                  .filter((entry) => entry.score > 0)
                  .sort((a, b) => b.score - a.score)
                  .map((entry) => entry.p)
              : linkedProducts;
            const isExpanded = Boolean(expandedBrochures[brochure.id]);
            const visibleProducts = isExpanded ? filteredProducts : filteredProducts.slice(0, 9);

            return (
              <section
                key={brochure.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <h2 className="truncate text-sm font-semibold text-slate-900">{brochure.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{brochure.marketLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{brochure.validFrom}</span>
                      <span aria-hidden="true">·</span>
                      <span>{timingLabels[brochure.timingStatus]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {brochure.pageImages.length} {t.pagesSuffix}
                      </span>
                      {(linkedProducts.length > 0 || brochure.productCount > 0) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {linkedProducts.length || brochure.productCount} {t.productsSuffix}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <a
                    href={brochure.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                  >
                    <span>{t.openOriginal}</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>

                {/* Clickable products linked to this brochure */}
                {linkedProducts.length > 0 && (
                  <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {t.productsInBrochure}
                      </span>

                      <div className="flex items-center gap-2">
                        {linkedProducts.length > 9 && (
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              type="text"
                              value={productFilterByBrochure[brochure.id] ?? ''}
                              onChange={(e) =>
                                setProductFilterByBrochure((prev) => ({
                                  ...prev,
                                  [brochure.id]: e.target.value,
                                }))
                              }
                              placeholder={t.filterProductsPlaceholder}
                              className="w-48 rounded-lg border border-slate-200 bg-white py-1 pr-2.5 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        )}

                        {filteredProducts.length > 9 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBrochures((prev) => ({
                                ...prev,
                                [brochure.id]: !isExpanded,
                              }))
                            }
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            {isExpanded
                              ? t.collapseProducts
                              : `${t.showAllProducts} (${filteredProducts.length})`}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() =>
                            setModalState({
                              brochure,
                              brochureProducts: linkedProducts,
                              initialPageIndex: 0,
                              initialProduct: prod,
                            })
                          }
                          title={t.locateOnPage}
                          className="group flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Focus
                              className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-blue-600"
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium text-slate-800">{prod.title}</span>
                          </div>
                          <span className="shrink-0 font-mono font-bold tabular-nums text-slate-900">
                            {prod.priceFormatted}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brochure Page Thumbnails */}
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {brochure.pageImages.map((imgUrl, idx) => (
                    <button
                      key={`${brochure.id}-p-${idx}`}
                      type="button"
                      onClick={() =>
                        setModalState({
                          brochure,
                          brochureProducts: linkedProducts,
                          initialPageIndex: idx,
                          initialProduct: null,
                        })
                      }
                      className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition-colors hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100">
                        <img
                          src={imgUrl}
                          alt={`${brochure.title} ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                        <span className="font-mono tabular-nums">
                          {t.pageLabel} {idx + 1}
                        </span>
                        <ImageIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {modalState && (
        <BrochureZoomModal
          language={language}
          brochure={modalState.brochure}
          brochureProducts={modalState.brochureProducts}
          initialPageIndex={modalState.initialPageIndex}
          initialProduct={modalState.initialProduct}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
