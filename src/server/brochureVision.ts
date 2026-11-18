import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { BrochureDetectedItem, BrochureLocateResponse } from '../mcp/types.ts';

export interface BrochureCandidateProduct {
  id: string;
  title: string;
  priceFormatted?: string;
}

export class BrochureVisionError extends Error {
  statusCode: number;
  code: 'MISSING_API_KEY' | 'IMAGE_FETCH_FAILED' | 'GEMINI_API_ERROR';

  constructor(
    message: string,
    statusCode: number,
    code: 'MISSING_API_KEY' | 'IMAGE_FETCH_FAILED' | 'GEMINI_API_ERROR',
  ) {
    super(message);
    this.name = 'BrochureVisionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface CachedPageVision {
  expiresAt: number;
  items: BrochureDetectedItem[];
}

const VISION_CACHE_TTL_MS = 60 * 60 * 1000;
const PAGE_VISION_CACHE = new Map<string, CachedPageVision>();
const IN_FLIGHT_VISION = new Map<string, Promise<BrochureDetectedItem[]>>();

const IMAGE_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new BrochureVisionError(
      'GEMINI_API_KEY ortam değişkeni yapılandırılmadığı için broşür görsel kutusu taraması çalıştırılamadı.',
      503,
      'MISSING_API_KEY',
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeTrSimple(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreCandidateMatch(
  candidate: BrochureCandidateProduct,
  detectedLabel: string,
  detectedPrice: string | null,
): number {
  const candNorm = normalizeTrSimple(candidate.title);
  const labelNorm = normalizeTrSimple(detectedLabel);
  if (!candNorm || !labelNorm) return 0;

  if (candNorm === labelNorm) return 100;
  if (candNorm.includes(labelNorm) || labelNorm.includes(candNorm)) return 75;

  const candTokens = candNorm.split(' ').filter((t) => t.length >= 2);
  const labelTokens = labelNorm.split(' ').filter((t) => t.length >= 2);
  if (candTokens.length === 0 || labelTokens.length === 0) return 0;

  let hits = 0;
  for (const lt of labelTokens) {
    if (candTokens.some((ct) => ct === lt || (lt.length >= 4 && (ct.startsWith(lt) || lt.startsWith(ct))))) {
      hits += 1;
    }
  }

  let score = (hits / Math.max(candTokens.length, labelTokens.length)) * 65;

  if (candidate.priceFormatted && detectedPrice) {
    const cNum = candidate.priceFormatted.replace(/[^\d]/g, '');
    const dNum = detectedPrice.replace(/[^\d]/g, '');
    if (cNum && dNum && cNum === dNum) {
      score += 20;
    }
  }

  return score;
}

function matchTargetProduct(
  items: BrochureDetectedItem[],
  targetProductId?: string,
  targetProductTitle?: string,
  candidates: BrochureCandidateProduct[] = [],
): BrochureDetectedItem | null {
  if (targetProductId) {
    const direct = items.find((item) => item.matchedProductId === targetProductId);
    if (direct) return direct;
  }

  const targetTitle =
    targetProductTitle ?? candidates.find((c) => c.id === targetProductId)?.title ?? '';
  if (!targetTitle) return null;

  const targetCand: BrochureCandidateProduct = {
    id: targetProductId ?? 'target',
    title: targetTitle,
    priceFormatted: candidates.find((c) => c.id === targetProductId)?.priceFormatted,
  };

  let bestItem: BrochureDetectedItem | null = null;
  let bestScore = 24;

  for (const item of items) {
    const s = scoreCandidateMatch(targetCand, item.label, item.priceText);
    if (s > bestScore) {
      bestScore = s;
      bestItem = item;
    }
  }

  return bestItem;
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  let res: Response;
  try {
    res = await fetch(imageUrl, {
      headers: IMAGE_FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new BrochureVisionError(
      `Broşür görseli indirilemedi: ${err instanceof Error ? err.message : 'Bağlantı hatası'}`,
      502,
      'IMAGE_FETCH_FAILED',
    );
  }

  if (!res.ok) {
    throw new BrochureVisionError(
      `Broşür görseli HTTP ${res.status} döndürdü.`,
      502,
      'IMAGE_FETCH_FAILED',
    );
  }

  const rawType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const mimeType = rawType.startsWith('image/')
    ? rawType
    : imageUrl.toLowerCase().endsWith('.png')
      ? 'image/png'
      : imageUrl.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

  const buffer = await res.arrayBuffer();
  return {
    mimeType,
    data: Buffer.from(buffer).toString('base64'),
  };
}

function clampBox(raw: number[]): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map((n) => Math.max(0, Math.min(1000, Math.round(Number(n)))));
  if (nums.some((n) => Number.isNaN(n))) return null;
  const [ymin, xmin, ymax, xmax] = nums;
  if (ymax - ymin < 12 || xmax - xmin < 12) return null;
  return [ymin, xmin, ymax, xmax];
}

async function analyzeSingleBrochurePage(
  pageImageUrl: string,
  candidates: BrochureCandidateProduct[],
): Promise<{ items: BrochureDetectedItem[]; fromCache: boolean }> {
  const cached = PAGE_VISION_CACHE.get(pageImageUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { items: cached.items, fromCache: true };
  }

  const inFlight = IN_FLIGHT_VISION.get(pageImageUrl);
  if (inFlight) {
    const items = await inFlight;
    return { items, fromCache: false };
  }

  const job = (async () => {
    const ai = getGeminiClient();
    const imgData = await fetchImageAsBase64(pageImageUrl);

    const candidateLines = candidates
      .slice(0, 80)
      .map((c) => `- id="${c.id}" | ${c.title}${c.priceFormatted ? ` (${c.priceFormatted})` : ''}`)
      .join('\n');

    const prompt = [
      'You are inspecting a Turkish supermarket weekly flyer/brochure page (BİM, A101, or ŞOK).',
      'Detect each visible product card/offer region on this page (including product image, title, and price tag together as one tight bounding box).',
      'Return normalized bounding boxes in [ymin, xmin, ymax, xmax] format on a 0..1000 integer scale.',
      candidateLines
        ? `Match each detected product to the closest candidate ID below when confident (otherwise null):\n${candidateLines}`
        : 'Set matchedProductId to null if no candidate list is provided.',
    ].join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: imgData.mimeType,
                data: imgData.data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    matchedProductId: { type: Type.STRING, nullable: true },
                    label: { type: Type.STRING },
                    priceText: { type: Type.STRING, nullable: true },
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    confidence: { type: Type.NUMBER },
                  },
                  required: ['label', 'box_2d'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"items":[]}').trim()) as {
        items?: Array<{
          matchedProductId?: string | null;
          label?: string;
          priceText?: string | null;
          box_2d?: number[];
          confidence?: number;
        }>;
      };

      const validCandidateIds = new Set(candidates.map((c) => c.id));
      const detected: BrochureDetectedItem[] = [];

      for (let i = 0; i < (parsed.items ?? []).length; i++) {
        const rawItem = parsed.items![i];
        const box2d = rawItem.box_2d ? clampBox(rawItem.box_2d) : null;
        if (!box2d || !rawItem.label?.trim()) continue;

        let matchedId =
          rawItem.matchedProductId && validCandidateIds.has(rawItem.matchedProductId)
            ? rawItem.matchedProductId
            : null;

        if (!matchedId && candidates.length > 0) {
          let bestCand: string | null = null;
          let bestScore = 34;
          for (const c of candidates) {
            const s = scoreCandidateMatch(c, rawItem.label, rawItem.priceText ?? null);
            if (s > bestScore) {
              bestScore = s;
              bestCand = c.id;
            }
          }
          matchedId = bestCand;
        }

        detected.push({
          id: `box-${i}-${box2d.join('-')}`,
          matchedProductId: matchedId,
          label: rawItem.label.trim(),
          priceText: rawItem.priceText?.trim() || null,
          box2d,
          confidence:
            typeof rawItem.confidence === 'number' && !Number.isNaN(rawItem.confidence)
              ? Math.max(0, Math.min(1, rawItem.confidence))
              : 0.85,
        });
      }

      PAGE_VISION_CACHE.set(pageImageUrl, {
        expiresAt: Date.now() + VISION_CACHE_TTL_MS,
        items: detected,
      });

      return detected;
    } catch (err) {
      if (err instanceof BrochureVisionError) throw err;
      throw new BrochureVisionError(
        err instanceof Error ? err.message : 'Gemini Vision görsel analizi başarısız oldu.',
        502,
        'GEMINI_API_ERROR',
      );
    } finally {
      IN_FLIGHT_VISION.delete(pageImageUrl);
    }
  })();

  IN_FLIGHT_VISION.set(pageImageUrl, job);
  const items = await job;
  return { items, fromCache: false };
}

export async function locateProductsInBrochure(params: {
  imageUrl: string;
  pageImages?: string[];
  targetProductId?: string;
  targetProductTitle?: string;
  candidates?: BrochureCandidateProduct[];
}): Promise<BrochureLocateResponse> {
  const started = Date.now();
  const candidates = params.candidates ?? [];
  const allPages =
    params.pageImages && params.pageImages.length > 0 ? params.pageImages : [params.imageUrl];
  const requestedIdx = Math.max(0, allPages.indexOf(params.imageUrl));

  // If no specific target product lookup is needed, analyze only the active page
  if (!params.targetProductId && !params.targetProductTitle) {
    const { items, fromCache } = await analyzeSingleBrochurePage(allPages[requestedIdx], candidates);
    return {
      pageImageUrl: allPages[requestedIdx],
      matchedPageIndex: requestedIdx,
      matchedItemId: null,
      items,
      fromCache,
      latencyMs: Date.now() - started,
    };
  }

  // 1) Check already cached pages first (0ms hit)
  for (let i = 0; i < allPages.length; i++) {
    const cached = PAGE_VISION_CACHE.get(allPages[i]);
    if (cached && cached.expiresAt > Date.now()) {
      const match = matchTargetProduct(
        cached.items,
        params.targetProductId,
        params.targetProductTitle,
        candidates,
      );
      if (match) {
        return {
          pageImageUrl: allPages[i],
          matchedPageIndex: i,
          matchedItemId: match.id,
          items: cached.items,
          fromCache: true,
          latencyMs: Date.now() - started,
        };
      }
    }
  }

  // 2) Scan uncached pages starting with requested page, then batches of 3 (capped at 6 pages per request)
  const orderedIndices = [
    requestedIdx,
    ...allPages.map((_, idx) => idx).filter((idx) => idx !== requestedIdx),
  ].slice(0, 6);

  let firstPageItems: BrochureDetectedItem[] = [];
  let firstPageCache = false;
  let lastError: unknown = null;
  let anySucceeded = false;

  for (let offset = 0; offset < orderedIndices.length; offset += 2) {
    const batchIndices = orderedIndices.slice(offset, offset + 2);
    const settled = await Promise.allSettled(
      batchIndices.map(async (pageIdx) => {
        const res = await analyzeSingleBrochurePage(allPages[pageIdx], candidates);
        return { pageIdx, ...res };
      }),
    );

    for (const entry of settled) {
      if (entry.status !== 'fulfilled') {
        lastError = entry.reason;
        continue;
      }
      anySucceeded = true;
      const pageRes = entry.value;
      if (pageRes.pageIdx === requestedIdx) {
        firstPageItems = pageRes.items;
        firstPageCache = pageRes.fromCache;
      }
      const match = matchTargetProduct(
        pageRes.items,
        params.targetProductId,
        params.targetProductTitle,
        candidates,
      );
      if (match) {
        return {
          pageImageUrl: allPages[pageRes.pageIdx],
          matchedPageIndex: pageRes.pageIdx,
          matchedItemId: match.id,
          items: pageRes.items,
          fromCache: pageRes.fromCache,
          latencyMs: Date.now() - started,
        };
      }
    }
  }

  if (!anySucceeded && lastError) {
    throw lastError;
  }

  return {
    pageImageUrl: allPages[requestedIdx],
    matchedPageIndex: requestedIdx,
    matchedItemId: null,
    items: firstPageItems,
    fromCache: firstPageCache,
    latencyMs: Date.now() - started,
  };
}
