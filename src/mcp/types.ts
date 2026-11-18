export type AkakceSortBy = 'popularity' | 'lowest_price' | 'highest_price';

export interface AkakceSearchProduct {
  productId: string;
  title: string;
  brand: string;
  lowestPriceTry: number;
  priceFormatted: string;
  offerCount: number;
  followersCount: number;
  discountPct: number | null;
  colors: string[];
  hasDetailPage: boolean;
  akakceUrl: string;
  imageUrl: string;
}

export interface AkakceSearchResponse {
  query: string;
  normalizedQuery?: string;
  appliedSynonyms?: string[];
  sortBy: AkakceSortBy;
  page: number;
  limit: number;
  totalPages: number;
  akakceTotalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  nextPageUrl: string | null;
  pagesFetched: number;
  fetchedAll: boolean;
  nextAkakcePage: number | null;
  rateLimited?: boolean;
  searchUrl: string;
  redirectedToCategory: boolean;
  totalParsed: number;
  fromCache: boolean;
  fetchedAt: string;
  products: AkakceSearchProduct[];
}

export interface AkakceSellerOffer {
  rank: number;
  isCheapest: boolean;
  marketplace: string;
  sellerName: string;
  sellerTitle: string;
  priceTry: number;
  priceFormatted: string;
  shippingInfo: string;
  isFreeShipping: boolean;
  campaignNote: string;
  stockText: string;
  shippingEta: string;
  updatedAgo: string;
  directUrl?: string;
}

export interface AkakcePriceHistoryRow {
  date: string;
  lowestPriceTry: number;
  changeTry: number;
  changePct: number;
  direction: 'down' | 'up' | 'flat';
}

export interface AkakceProductVariant {
  name: string;
  sku: string;
  color: string;
  akakceUrl: string;
  priceTry: number | null;
  inStock: boolean;
}

export interface AkakceProductSpec {
  name: string;
  value: string;
}

export interface AkakceProductDetails {
  productId: string;
  title: string;
  category: string;
  description: string;
  akakceUrl: string;
  imageUrl: string;
  lowestPriceTry: number;
  highestListedPriceTry: number;
  offerCount: number;
  ratingValue: number | null;
  ratingCount: number | null;
  fromCache: boolean;
  fetchedAt: string;
  offers: AkakceSellerOffer[];
  priceHistory: AkakcePriceHistoryRow[];
  specs: AkakceProductSpec[];
  variants: AkakceProductVariant[];
  similarProducts: Array<{ name: string; akakceUrl: string }>;
}

export interface AkakceAutocompleteItem {
  text: string;
  type: string;
  code: string;
  akakceUrl: string;
}

export interface AkakceAutocompleteGroup {
  title: string;
  items: AkakceAutocompleteItem[];
}

export interface McpToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  enum?: string[];
  default?: string | number | boolean | string[];
  items?: {
    type: 'string';
  };
}

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, McpToolPropertySchema>;
    required?: string[];
  };
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type MarketId = 'bim' | 'a101' | 'sok';
export type MarketFilter = MarketId | 'hepsi';

export type AktuelCategory =
  | 'elektronik'
  | 'mutfak'
  | 'kamp'
  | 'ev_yasam'
  | 'yapi_oto'
  | 'oyuncak'
  | 'giyim'
  | 'gida'
  | 'diger';

export type AktuelTimingStatus = 'aktif' | 'yaklasan' | 'gecmis';
export type AktuelSortBy = 'relevance' | 'lowest_price' | 'highest_price';

export interface AktuelProduct {
  id: string;
  market: MarketId;
  marketLabel: 'BİM' | 'A101' | 'ŞOK';
  brand: string;
  title: string;
  priceTry: number;
  oldPriceTry: number | null;
  discountPct: number | null;
  priceFormatted: string;
  category: AktuelCategory;
  campaignTitle: string;
  validFrom: string;
  dayLabel: string;
  timingStatus: AktuelTimingStatus;
  salesChannel: 'magaza' | 'haftanin_firsati' | 'online_ekstra';
  installmentInfo: string | null;
  imageUrl: string;
  sourceUrl: string;
}

export interface AktuelCampaign {
  key: string;
  market: MarketId;
  marketLabel: 'BİM' | 'A101' | 'ŞOK';
  title: string;
  validFrom: string;
  dayLabel: string;
  timingStatus: AktuelTimingStatus;
  productCount: number;
  brochureCount: number;
  sourceUrl: string;
}

export interface AktuelBrochure {
  id: string;
  market: MarketId;
  marketLabel: 'BİM' | 'A101' | 'ŞOK';
  title: string;
  validFrom: string;
  dayLabel: string;
  timingStatus: AktuelTimingStatus;
  pageImages: string[];
  sourceUrl: string;
  productCount: number;
}

export interface MarketCatalogSnapshot {
  market: MarketId;
  marketLabel: 'BİM' | 'A101' | 'ŞOK';
  fetchedAt: string;
  fromCache: boolean;
  sourceUsed: string;
  campaigns: AktuelCampaign[];
  brochures: AktuelBrochure[];
  products: AktuelProduct[];
  warnings: string[];
}

export interface AktuelWeeklySummaryResponse {
  market: MarketFilter;
  fetchedAt: string;
  fromCache: boolean;
  totalProducts: number;
  totalBrochures: number;
  marketSummaries: Array<{
    market: MarketId;
    marketLabel: 'BİM' | 'A101' | 'ŞOK';
    sourceUsed: string;
    fromCache: boolean;
    productCount: number;
    brochureCount: number;
    campaigns: AktuelCampaign[];
    warnings: string[];
  }>;
  products: AktuelProduct[];
  brochures: AktuelBrochure[];
}

export interface AktuelSearchResponse {
  query: string;
  appliedSynonyms?: string[];
  market: MarketFilter;
  category: AktuelCategory | 'hepsi';
  timing: AktuelTimingStatus | 'hepsi';
  sortBy: AktuelSortBy;
  totalMatched: number;
  fetchedAt: string;
  fromCache: boolean;
  products: AktuelProduct[];
}

export interface AktuelBasketMatch {
  requestedItem: string;
  found: boolean;
  matchCount: number;
  cheapestMatch: AktuelProduct | null;
  alternatives: AktuelProduct[];
}

export interface AktuelMarketCheckResult {
  query: string;
  market: MarketFilter;
  aktuelMatches: AktuelProduct[];
  akakceReference: {
    searchQuery: string;
    searchUrl: string;
    lowestOnlinePriceTry: number | null;
    lowestOnlineFormatted: string | null;
    topOnlineMatches: AkakceSearchProduct[];
  };
  dealAssessment: {
    cheapestAktuelProduct: AktuelProduct | null;
    priceDiffTry: number | null;
    savingsPct: number | null;
    verdict: 'piyasadan_ucuz' | 'piyasayla_benzer' | 'piyasadan_pahali' | 'karsilastirilamadi';
    summary: string;
  };
}

export interface BrochureDetectedItem {
  id: string;
  matchedProductId: string | null;
  label: string;
  priceText: string | null;
  /** Normalized [ymin, xmin, ymax, xmax] in 0..1000 image coordinate space */
  box2d: [number, number, number, number];
  confidence: number;
}

export interface BrochureLocateResponse {
  pageImageUrl: string;
  matchedPageIndex: number;
  matchedItemId: string | null;
  items: BrochureDetectedItem[];
  fromCache: boolean;
  latencyMs: number;
}
