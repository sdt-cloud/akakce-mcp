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
  type: 'string' | 'number' | 'boolean';
  description: string;
  enum?: string[];
  default?: string | number | boolean;
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
