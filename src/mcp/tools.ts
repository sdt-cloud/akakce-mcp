import {
  autocompleteAkakce,
  getAkakceCacheSummary,
  getAkakceProductDetails,
  searchAkakce,
} from './akakceClient.ts';
import { AKAKCE_MCP_RESOURCES, AKAKCE_MCP_TOOLS } from './definitions.ts';
import type { AkakceSortBy, McpResourceDefinition, McpToolDefinition } from './types.ts';

export { AKAKCE_MCP_RESOURCES, AKAKCE_MCP_TOOLS };

export function listMcpTools(): McpToolDefinition[] {
  return AKAKCE_MCP_TOOLS;
}

export function listMcpResources(): McpResourceDefinition[] {
  return AKAKCE_MCP_RESOURCES;
}

export function readMcpResource(uri: string) {
  if (uri === 'mcp://akakce/server/info') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              service: 'Akakce-MCP',
              targetDomain: 'https://www.akakce.com',
              autocompleteEndpoint: 'https://api6.akakce.com/autocomplete',
              cacheTtlSeconds: 180,
              tools: AKAKCE_MCP_TOOLS.map((t) => t.name),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === 'mcp://akakce/cache/recent') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(getAkakceCacheSummary(), null, 2),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: `Bilinmeyen MCP kaynağı: ${uri}`,
      },
    ],
  };
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}> {
  try {
    if (toolName === 'akakce_search') {
      const query = typeof args.query === 'string' ? args.query : '';
      const sortBy = (typeof args.sortBy === 'string' ? args.sortBy : 'popularity') as AkakceSortBy;
      const page = typeof args.page === 'number' ? args.page : 1;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const fetchAll = Boolean(args.fetchAll);
      const startAkakcePage = typeof args.startAkakcePage === 'number' ? args.startAkakcePage : 1;
      const forceRefresh = Boolean(args.forceRefresh);

      const searchData = await searchAkakce({
        query,
        sortBy,
        page,
        limit,
        fetchAll,
        startAkakcePage,
        forceRefresh,
      });
      const payload = {
        tool: 'akakce_search',
        ...searchData,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'akakce_get_product_offers') {
      const productUrlOrId = typeof args.productUrlOrId === 'string' ? args.productUrlOrId : '';
      const forceRefresh = Boolean(args.forceRefresh);
      const details = await getAkakceProductDetails(productUrlOrId, { forceRefresh });
      const payload = {
        tool: 'akakce_get_product_offers',
        productId: details.productId,
        title: details.title,
        category: details.category,
        akakceUrl: details.akakceUrl,
        imageUrl: details.imageUrl,
        lowestPriceTry: details.lowestPriceTry,
        highestListedPriceTry: details.highestListedPriceTry,
        offerCount: details.offerCount,
        ratingValue: details.ratingValue,
        ratingCount: details.ratingCount,
        fromCache: details.fromCache,
        fetchedAt: details.fetchedAt,
        offers: details.offers,
        specs: details.specs,
        variants: details.variants,
        similarProducts: details.similarProducts,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'akakce_get_price_history') {
      const productUrlOrId = typeof args.productUrlOrId === 'string' ? args.productUrlOrId : '';
      const forceRefresh = Boolean(args.forceRefresh);
      const details = await getAkakceProductDetails(productUrlOrId, { forceRefresh });
      const prices = details.priceHistory.map((r) => r.lowestPriceTry);
      const minRecordedTry = prices.length > 0 ? Math.min(...prices) : details.lowestPriceTry;
      const maxRecordedTry = prices.length > 0 ? Math.max(...prices) : details.lowestPriceTry;

      const payload = {
        tool: 'akakce_get_price_history',
        productId: details.productId,
        title: details.title,
        akakceUrl: details.akakceUrl,
        currentLowestTry: details.lowestPriceTry,
        minRecordedTry,
        maxRecordedTry,
        historyCount: details.priceHistory.length,
        fromCache: details.fromCache,
        fetchedAt: details.fetchedAt,
        priceHistory: details.priceHistory,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'akakce_autocomplete') {
      const query = typeof args.query === 'string' ? args.query : '';
      const ac = await autocompleteAkakce(query);
      const payload = {
        tool: 'akakce_autocomplete',
        ...ac,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'akakce_compare_product_prices') {
      const query = typeof args.query === 'string' ? args.query : '';
      const topProducts = Math.min(5, Math.max(1, typeof args.topProducts === 'number' ? Math.floor(args.topProducts) : 3));
      const sortBy = (typeof args.sortBy === 'string' ? args.sortBy : 'popularity') as AkakceSortBy;

      const search = await searchAkakce({ query, sortBy, limit: Math.max(12, topProducts * 3) });
      const comparableProducts = search.products.filter((p) => p.hasDetailPage).slice(0, topProducts);
      const detailedList = await Promise.all(
        comparableProducts.map(async (prod) => {
          try {
            const detail = await getAkakceProductDetails(prod.akakceUrl);
            return {
              productId: prod.productId,
              title: detail.title || prod.title,
              akakceUrl: prod.akakceUrl,
              imageUrl: prod.imageUrl,
              lowestPriceTry: detail.lowestPriceTry || prod.lowestPriceTry,
              offerCount: detail.offerCount || prod.offerCount,
              cheapestOffer: detail.offers[0] ?? null,
              topOffers: detail.offers.slice(0, 5),
            };
          } catch (err) {
            return {
              productId: prod.productId,
              title: prod.title,
              akakceUrl: prod.akakceUrl,
              imageUrl: prod.imageUrl,
              lowestPriceTry: prod.lowestPriceTry,
              offerCount: prod.offerCount,
              cheapestOffer: null,
              topOffers: [],
              error: err instanceof Error ? err.message : 'Detay alınamadı',
            };
          }
        }),
      );

      const payload = {
        tool: 'akakce_compare_product_prices',
        query,
        searchUrl: search.searchUrl,
        comparedCount: detailedList.length,
        items: detailedList,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    const unknownPayload = { error: `Bilinmeyen MCP aracı: ${toolName}` };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(unknownPayload, null, 2) }],
      structuredContent: unknownPayload,
    };
  } catch (err) {
    const errorPayload = {
      tool: toolName,
      error: err instanceof Error ? err.message : 'Akakçe MCP araç hatası',
    };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
      structuredContent: errorPayload,
    };
  }
}
