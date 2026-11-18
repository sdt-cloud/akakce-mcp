import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Focus,
  Loader2,
  Package,
  RotateCcw,
  ScanSearch,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type {
  AktuelBrochure,
  AktuelProduct,
  BrochureDetectedItem,
  BrochureLocateResponse,
} from '../mcp/types';

interface BrochureZoomModalProps {
  language: Language;
  brochure: AktuelBrochure;
  brochureProducts: AktuelProduct[];
  initialPageIndex: number;
  initialProduct: AktuelProduct | null;
  onClose: () => void;
}

const CLIENT_PAGE_VISION_CACHE = new Map<string, BrochureDetectedItem[]>();

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findMatchingBoxForProduct(
  items: BrochureDetectedItem[],
  product: AktuelProduct | null,
): BrochureDetectedItem | null {
  if (!product || items.length === 0) return null;
  const direct = items.find((b) => b.matchedProductId === product.id);
  if (direct) return direct;

  const pNorm = normalizeMatchText(product.title);
  const pTokens = pNorm.split(' ').filter((t) => t.length >= 2);
  if (pTokens.length === 0) return null;

  let best: BrochureDetectedItem | null = null;
  let bestScore = 0;

  for (const box of items) {
    const bNorm = normalizeMatchText(box.label);
    if (bNorm === pNorm) return box;
    const bTokens = bNorm.split(' ').filter((t) => t.length >= 2);
    let hits = 0;
    for (const pt of pTokens) {
      if (bTokens.some((bt) => bt === pt || (pt.length >= 4 && bt.startsWith(pt)))) {
        hits += 1;
      }
    }
    const ratio = hits / Math.max(pTokens.length, bTokens.length, 1);
    if (ratio > bestScore && ratio >= 0.4) {
      bestScore = ratio;
      best = box;
    }
  }

  return best;
}

export function BrochureZoomModal({
  language,
  brochure,
  brochureProducts,
  initialPageIndex,
  initialProduct,
  onClose,
}: BrochureZoomModalProps) {
  const t = TRANSLATIONS[language].brochuresView;
  const pages = brochure.pageImages;

  const [activePageIndex, setActivePageIndex] = useState(() =>
    clamp(initialPageIndex, 0, Math.max(0, pages.length - 1)),
  );
  const [selectedProduct, setSelectedProduct] = useState<AktuelProduct | null>(initialProduct);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  const [detectionsByPage, setDetectionsByPage] = useState<Record<string, BrochureDetectedItem[]>>(() => {
    const init: Record<string, BrochureDetectedItem[]> = {};
    for (const url of pages) {
      const cached = CLIENT_PAGE_VISION_CACHE.get(url);
      if (cached) init[url] = cached;
    }
    return init;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [lastFromCache, setLastFromCache] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pendingFocusBoxRef = useRef<BrochureDetectedItem | null>(null);
  const requestSeqRef = useRef(0);

  const activeImageUrl = pages[activePageIndex] ?? '';
  const activePageBoxes = detectionsByPage[activeImageUrl] ?? [];

  const candidatesPayload = useMemo(
    () =>
      brochureProducts.slice(0, 80).map((p) => ({
        id: p.id,
        title: p.title,
        priceFormatted: p.priceFormatted,
      })),
    [brochureProducts],
  );

  const focusOnBox = useCallback((box: BrochureDetectedItem) => {
    setSelectedBoxId(box.id);
    setShowBoxes(true);
    pendingFocusBoxRef.current = box;

    const imgEl = imgRef.current;
    if (!imgEl || !imgEl.clientWidth || !imgEl.clientHeight) {
      return;
    }

    const [ymin, xmin, ymax, xmax] = box.box2d;
    const boxWFrac = Math.max(0.08, (xmax - xmin) / 1000);
    const boxHFrac = Math.max(0.08, (ymax - ymin) / 1000);
    const targetZoom = clamp(Math.min(0.48 / boxWFrac, 0.48 / boxHFrac), 1.65, 3.1);

    const cxOffset = ((xmin + xmax) / 2 - 500) / 1000;
    const cyOffset = ((ymin + ymax) / 2 - 500) / 1000;

    setZoom(Number(targetZoom.toFixed(2)));
    setPan({
      x: Math.round(-cxOffset * imgEl.clientWidth * targetZoom),
      y: Math.round(-cyOffset * imgEl.clientHeight * targetZoom),
    });
    pendingFocusBoxRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const runVisionLocate = useCallback(
    async (opts: {
      pageUrl: string;
      targetProduct: AktuelProduct | null;
      searchAllPages: boolean;
    }) => {
      if (!opts.pageUrl) return;
      const reqId = ++requestSeqRef.current;

      // Fast path: check client cache across pages if locating a product
      if (opts.targetProduct && opts.searchAllPages) {
        for (let i = 0; i < pages.length; i++) {
          const cached = CLIENT_PAGE_VISION_CACHE.get(pages[i]);
          if (cached) {
            const hit = findMatchingBoxForProduct(cached, opts.targetProduct);
            if (hit) {
              setActivePageIndex(i);
              setScanError(null);
              setScanNotice(null);
              setLastFromCache(true);
              setLastLatencyMs(0);
              focusOnBox(hit);
              return;
            }
          }
        }
      } else if (!opts.targetProduct) {
        const cached = CLIENT_PAGE_VISION_CACHE.get(opts.pageUrl);
        if (cached) {
          setDetectionsByPage((prev) => ({ ...prev, [opts.pageUrl]: cached }));
          setLastFromCache(true);
          setLastLatencyMs(0);
          setScanError(null);
          return;
        }
      }

      setIsScanning(true);
      setScanError(null);
      setScanNotice(null);

      try {
        const res = await fetch('/api/brochures/locate-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: opts.pageUrl,
            pageImages: opts.searchAllPages ? pages : undefined,
            targetProductId: opts.targetProduct?.id,
            targetProductTitle: opts.targetProduct?.title,
            candidates: candidatesPayload,
          }),
        });

        const payload = (await res.json()) as BrochureLocateResponse & { error?: string };
        if (reqId !== requestSeqRef.current) return;

        if (!res.ok) {
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }

        CLIENT_PAGE_VISION_CACHE.set(payload.pageImageUrl, payload.items);
        setDetectionsByPage((prev) => ({
          ...prev,
          [payload.pageImageUrl]: payload.items,
        }));
        setLastLatencyMs(payload.latencyMs);
        setLastFromCache(payload.fromCache);

        const resolvedPageIdx = pages.indexOf(payload.pageImageUrl);
        if (resolvedPageIdx >= 0 && resolvedPageIdx !== activePageIndex) {
          setImageLoaded(false);
          setActivePageIndex(resolvedPageIdx);
        }

        const matchedBox =
          (payload.matchedItemId
            ? payload.items.find((b) => b.id === payload.matchedItemId)
            : null) ?? findMatchingBoxForProduct(payload.items, opts.targetProduct);

        if (matchedBox) {
          focusOnBox(matchedBox);
        } else if (opts.targetProduct) {
          setScanNotice(t.notFoundOnScannedPages);
        }
      } catch (err) {
        if (reqId !== requestSeqRef.current) return;
        setScanError(err instanceof Error ? err.message : 'Görsel kutu taraması başarısız.');
      } finally {
        if (reqId === requestSeqRef.current) {
          setIsScanning(false);
        }
      }
    },
    [activePageIndex, candidatesPayload, focusOnBox, pages, t.notFoundOnScannedPages],
  );

  // Run initial scan on mount when modal opens
  useEffect(() => {
    void runVisionLocate({
      pageUrl: pages[clamp(initialPageIndex, 0, Math.max(0, pages.length - 1))] ?? '',
      targetProduct: initialProduct,
      searchAllPages: Boolean(initialProduct),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply pending box focus once image finishes loading/measuring
  useEffect(() => {
    if (imageLoaded && pendingFocusBoxRef.current) {
      focusOnBox(pendingFocusBoxRef.current);
    }
  }, [focusOnBox, imageLoaded]);

  // Non-passive wheel zoom on viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoom((z) => {
        const next = clamp(Number((z + delta).toFixed(2)), 1, 4.5);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard shortcuts: Esc, +/-, 0, ArrowLeft, ArrowRight
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => clamp(Number((z + 0.35).toFixed(2)), 1, 4.5));
      } else if (e.key === '-') {
        setZoom((z) => {
          const next = clamp(Number((z - 0.35).toFixed(2)), 1, 4.5);
          if (next <= 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        resetView();
      } else if (e.key === 'ArrowLeft' && activePageIndex > 0) {
        const nextIdx = activePageIndex - 1;
        setImageLoaded(false);
        setActivePageIndex(nextIdx);
        setSelectedBoxId(null);
        resetView();
        void runVisionLocate({
          pageUrl: pages[nextIdx],
          targetProduct: null,
          searchAllPages: false,
        });
      } else if (e.key === 'ArrowRight' && activePageIndex < pages.length - 1) {
        const nextIdx = activePageIndex + 1;
        setImageLoaded(false);
        setActivePageIndex(nextIdx);
        setSelectedBoxId(null);
        resetView();
        void runVisionLocate({
          pageUrl: pages[nextIdx],
          targetProduct: null,
          searchAllPages: false,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePageIndex, onClose, pages, resetView, runVisionLocate]);

  const handlePageChange = (nextIdx: number) => {
    const safeIdx = clamp(nextIdx, 0, pages.length - 1);
    if (safeIdx === activePageIndex) return;
    setImageLoaded(false);
    setActivePageIndex(safeIdx);
    setSelectedBoxId(null);
    setScanNotice(null);
    resetView();
    void runVisionLocate({
      pageUrl: pages[safeIdx],
      targetProduct: null,
      searchAllPages: false,
    });
  };

  const handleSelectBrochureProduct = (prod: AktuelProduct) => {
    setSelectedProduct(prod);
    setScanNotice(null);
    // First check if the currently open page already has a matching box
    const localHit = findMatchingBoxForProduct(activePageBoxes, prod);
    if (localHit) {
      focusOnBox(localHit);
      return;
    }
    void runVisionLocate({
      pageUrl: activeImageUrl,
      targetProduct: prod,
      searchAllPages: true,
    });
  };

  const handleSelectBoxOnPage = (box: BrochureDetectedItem) => {
    focusOnBox(box);
    if (box.matchedProductId) {
      const prod = brochureProducts.find((p) => p.id === box.matchedProductId) ?? null;
      if (prod) setSelectedProduct(prod);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={brochure.title}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{brochure.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{brochure.marketLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {t.pageLabel} {activePageIndex + 1} / {pages.length}
              </span>
              {lastLatencyMs !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {lastFromCache ? t.cachedBadge : `${lastLatencyMs} ms`}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Zoom & Navigation Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {pages.length > 1 && (
              <div className="mr-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => handlePageChange(activePageIndex - 1)}
                  title={t.prevPage}
                  className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="px-1.5 font-mono text-xs font-medium tabular-nums text-slate-700">
                  {activePageIndex + 1}/{pages.length}
                </span>
                <button
                  type="button"
                  disabled={activePageIndex >= pages.length - 1}
                  onClick={() => handlePageChange(activePageIndex + 1)}
                  title={t.nextPage}
                  className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => {
                    const next = clamp(Number((z - 0.35).toFixed(2)), 1, 4.5);
                    if (next <= 1) setPan({ x: 0, y: 0 });
                    return next;
                  })
                }
                disabled={zoom <= 1}
                title={t.zoomOut}
                className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="min-w-[46px] text-center font-mono text-xs font-semibold tabular-nums text-slate-800">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(Number((z + 0.35).toFixed(2)), 1, 4.5))}
                disabled={zoom >= 4.5}
                title={t.zoomIn}
                className="rounded-md p-1.5 text-slate-700 hover:bg-white disabled:opacity-35"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={resetView}
                title={t.resetZoom}
                className="rounded-md p-1.5 text-slate-700 hover:bg-white"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBoxes((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                showBoxes
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {showBoxes ? (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{showBoxes ? t.hideBoxes : t.showBoxes}</span>
            </button>

            <button
              type="button"
              disabled={isScanning}
              onClick={() =>
                void runVisionLocate({
                  pageUrl: activeImageUrl,
                  targetProduct: null,
                  searchAllPages: false,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              {isScanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden="true" />
              ) : (
                <ScanSearch className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              )}
              <span>{t.scanPage}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.closeModal}</span>
            </button>
          </div>
        </div>

        {/* Main 2-Pane Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Left: Interactive Zoomable & Pannable Brochure Canvas */}
          <div
            ref={viewportRef}
            onPointerDown={(e) => {
              if (zoom <= 1) return;
              if ((e.target as HTMLElement).closest('button[data-box-overlay="true"]')) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsDragging(true);
              dragStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                panX: pan.x,
                panY: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (!isDragging || !dragStartRef.current) return;
              setPan({
                x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
                y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
              });
            }}
            onPointerUp={() => {
              setIsDragging(false);
              dragStartRef.current = null;
            }}
            onPointerCancel={() => {
              setIsDragging(false);
              dragStartRef.current = null;
            }}
            className={`relative flex items-center justify-center overflow-hidden bg-slate-950 p-4 select-none ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              className={`relative inline-block ${
                isDragging ? '' : 'transition-transform duration-200 ease-out'
              }`}
            >
              <img
                ref={imgRef}
                src={activeImageUrl}
                alt={`${brochure.title} — ${activePageIndex + 1}`}
                referrerPolicy="no-referrer"
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                className="block max-h-[73vh] w-auto max-w-full rounded-sm object-contain shadow-lg"
              />

              {/* Percentage-locked bounding box overlay layer */}
              {showBoxes && activePageBoxes.length > 0 && (
                <div className="pointer-events-none absolute inset-0">
                  {activePageBoxes.map((box) => {
                    const [ymin, xmin, ymax, xmax] = box.box2d;
                    const isSelected = box.id === selectedBoxId;
                    return (
                      <button
                        key={box.id}
                        type="button"
                        data-box-overlay="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectBoxOnPage(box);
                        }}
                        style={{
                          top: `${ymin / 10}%`,
                          left: `${xmin / 10}%`,
                          width: `${(xmax - xmin) / 10}%`,
                          height: `${(ymax - ymin) / 10}%`,
                        }}
                        className={`pointer-events-auto absolute rounded transition-colors ${
                          isSelected
                            ? 'z-20 border-2 border-amber-400 bg-amber-400/15 shadow-[0_0_0_9999px_rgba(2,6,23,0.48)]'
                            : 'z-10 border border-blue-400/75 bg-blue-500/5 hover:border-amber-300 hover:bg-amber-300/10'
                        }`}
                        title={`${box.label}${box.priceText ? ` — ${box.priceText}` : ''}`}
                      >
                        {isSelected && (
                          <span className="pointer-events-none absolute -top-6 left-0 max-w-[240px] truncate rounded bg-slate-900/95 px-2 py-0.5 text-[11px] font-semibold text-amber-300 shadow">
                            {box.label}
                            {box.priceText ? ` · ${box.priceText}` : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isScanning && (
              <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-100 shadow">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden="true" />
                <span>{t.scanningPage}</span>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-2.5 left-3 rounded bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
              {t.panHint}
            </div>
          </div>

          {/* Right: Detected Items & Brochure Product Inspector */}
          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
            {selectedProduct && (
              <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-blue-700">{t.selectedProductLabel}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-900">{selectedProduct.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {selectedProduct.priceFormatted}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedProduct.marketLabel}</span>
                </div>
              </div>
            )}

            {scanError && (
              <div className="border-b border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                {scanError}
              </div>
            )}

            {scanNotice && !scanError && (
              <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                {scanNotice}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-3.5 space-y-4">
              {/* Detected Boxes on Active Page */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>{t.detectedOnPageTitle}</span>
                  <span className="font-mono tabular-nums text-slate-500">{activePageBoxes.length}</span>
                </div>

                {activePageBoxes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                    {isScanning ? t.scanningPage : t.noDetectionsYet}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {activePageBoxes.map((box) => {
                      const active = box.id === selectedBoxId;
                      return (
                        <button
                          key={box.id}
                          type="button"
                          onClick={() => handleSelectBoxOnPage(box)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'border-amber-400 bg-amber-50 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{box.label}</p>
                            {box.priceText && (
                              <p className="font-mono text-[11px] font-semibold tabular-nums text-slate-600">
                                {box.priceText}
                              </p>
                            )}
                          </div>
                          <Focus className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Parsed Brochure Products List */}
              {brochureProducts.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>{t.brochureCatalogTitle}</span>
                    <span className="font-mono tabular-nums text-slate-500">{brochureProducts.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {brochureProducts.map((prod) => {
                      const isCurr = selectedProduct?.id === prod.id;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectBrochureProduct(prod)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                            isCurr
                              ? 'border-blue-500 bg-blue-50 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                            <span className="truncate font-medium">{prod.title}</span>
                          </div>
                          <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-900">
                            {prod.priceFormatted}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
