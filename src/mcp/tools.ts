import {
  compareAktuelWithMarket,
  getAktuelBrochures,
  getAktuelCacheSummary,
  getAktuelCalendar,
  getWeeklyCatalogSummary,
  scanAktuelShoppingList,
  searchAktuelProducts,
} from './aktuelClient.ts';
import { AKTUEL_MCP_RESOURCES, AKTUEL_MCP_TOOLS } from './definitions.ts';
import type {
  AktuelCategory,
  AktuelSortBy,
  AktuelTimingStatus,
  MarketFilter,
  McpResourceDefinition,
  McpToolDefinition,
} from './types.ts';

export { AKTUEL_MCP_RESOURCES, AKTUEL_MCP_TOOLS };

export function listMcpTools(): McpToolDefinition[] {
  return AKTUEL_MCP_TOOLS;
}

export function listMcpResources(): McpResourceDefinition[] {
  return AKTUEL_MCP_RESOURCES;
}

export async function readMcpResource(uri: string) {
  if (uri === 'mcp://aktuel/server/info') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              service: 'Aktuel-MCP',
              markets: ['bim', 'a101', 'sok'],
              sources: {
                bim: 'https://www.bim.com.tr/Categories/100/aktuel-urunler.aspx',
                a101: 'https://aktuel-urunler.com/a101-aktuel-urunler/',
                sok: 'https://www.sokmarket.com.tr + https://aktuel-urunler.com/sok/',
              },
              cacheTtlMinutes: 30,
              tools: AKTUEL_MCP_TOOLS.map((t) => t.name),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === 'mcp://aktuel/takvim/bu-hafta') {
    const calendar = await getAktuelCalendar({});
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(calendar, null, 2),
        },
      ],
    };
  }

  if (uri === 'mcp://aktuel/marketler/durum') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(getAktuelCacheSummary(), null, 2),
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
    if (toolName === 'aktuel_bu_hafta') {
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const onlyActiveOrUpcoming =
        args.onlyActiveOrUpcoming === undefined ? true : Boolean(args.onlyActiveOrUpcoming);
      const limitPerMarket =
        typeof args.limitPerMarket === 'number' ? Math.min(250, Math.max(5, args.limitPerMarket)) : 60;
      const forceRefresh = Boolean(args.forceRefresh);

      const data = await getWeeklyCatalogSummary({
        market,
        onlyActiveOrUpcoming,
        limitPerMarket,
        forceRefresh,
      });

      const payload = { tool: 'aktuel_bu_hafta', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_urun_ara') {
      const query = typeof args.query === 'string' ? args.query : '';
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const rawCat = typeof args.category === 'string' ? args.category : typeof args.kategori === 'string' ? args.kategori : 'hepsi';
      const category = rawCat as AktuelCategory | 'hepsi';
      const sortBy = (typeof args.sortBy === 'string' ? args.sortBy : 'relevance') as AktuelSortBy;
      const timing = (typeof args.timing === 'string' ? args.timing : 'hepsi') as
        | AktuelTimingStatus
        | 'hepsi';
      const limit = typeof args.limit === 'number' ? args.limit : 50;

      const data = await searchAktuelProducts({
        query,
        market,
        category,
        sortBy,
        timing,
        limit,
      });

      const payload = { tool: 'aktuel_urun_ara', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_kategori') {
      const kategori = (typeof args.kategori === 'string' ? args.kategori : 'elektronik') as
        | AktuelCategory
        | 'hepsi';
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const sortBy = (typeof args.sortBy === 'string' ? args.sortBy : 'lowest_price') as AktuelSortBy;
      const limit = typeof args.limit === 'number' ? args.limit : 60;

      const data = await searchAktuelProducts({
        category: kategori,
        market,
        sortBy,
        limit,
      });

      const payload = { tool: 'aktuel_kategori', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_takvim') {
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const gun = typeof args.gun === 'string' ? args.gun : 'hepsi';
      const durum = (typeof args.durum === 'string' ? args.durum : 'hepsi') as
        | AktuelTimingStatus
        | 'hepsi';

      const data = await getAktuelCalendar({ market, day: gun, timing: durum });
      const payload = { tool: 'aktuel_takvim', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_liste_tara') {
      const rawItems = Array.isArray(args.items)
        ? args.items.map((x) => String(x))
        : typeof args.items === 'string'
          ? args.items.split(',').map((s) => s.trim())
          : [];
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;

      const data = await scanAktuelShoppingList({ items: rawItems, market });
      const payload = { tool: 'aktuel_liste_tara', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_brosurler') {
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const forceRefresh = Boolean(args.forceRefresh);
      const data = await getAktuelBrochures({ market, forceRefresh });
      const payload = { tool: 'aktuel_brosurler', ...data };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    if (toolName === 'aktuel_piyasa_karsilastir') {
      const query = typeof args.query === 'string' ? args.query : '';
      const market = (typeof args.market === 'string' ? args.market : 'hepsi') as MarketFilter;
      const data = await compareAktuelWithMarket({ query, market });
      const payload = { tool: 'aktuel_piyasa_karsilastir', ...data };
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
      error: err instanceof Error ? err.message : 'Aktüel MCP araç hatası',
    };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
      structuredContent: errorPayload,
    };
  }
}
