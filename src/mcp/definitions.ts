import type { McpResourceDefinition, McpToolDefinition } from './types.ts';

export const AKAKCE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'akakce_search',
    title: 'Akakçe Canlı Ürün Arama',
    description:
      'Akakçe.com arama sayfasını (/arama/?q=...) canlı olarak sorgular; eşleşen ürünleri, en düşük TL fiyatlarını, satıcı sayılarını ve Akakçe ürün linklerini döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Akakçe.com üzerinde aranacak ürün adı, model veya kategori (ör. "Samsung A35", "iPhone 16", "Dyson V15").',
        },
        sortBy: {
          type: 'string',
          description:
            'Akakçe sıralama ölçütü: popularity (varsayılan), lowest_price (en düşük fiyat), highest_price (en yüksek fiyat).',
          enum: ['popularity', 'lowest_price', 'highest_price'],
          default: 'popularity',
        },
        page: {
          type: 'number',
          description: 'Sayfa numarası (limit boyutuna göre sayfalanır, varsayılan: 1).',
          default: 1,
        },
        limit: {
          type: 'number',
          description: 'Sayfa başına döndürülecek ürün sayısı (ör. 25, 50, 100 veya 2000; varsayılan: 50).',
          default: 50,
        },
        fetchAll: {
          type: 'boolean',
          description: 'true olduğunda Akakçe üzerindeki arama sayfalarını (16 sayfalık bloklar halinde) tarayıp tüm ürünleri döndürür; devamı varsa nextAkakcePage ile devam edilir.',
          default: false,
        },
        startAkakcePage: {
          type: 'number',
          description: 'fetchAll=true iken sonraki bloktan devam etmek için başlangıç Akakçe sayfa numarası (varsayılan: 1).',
          default: 1,
        },
        forceRefresh: {
          type: 'boolean',
          description: '3 dakikalık önbelleği atlayıp Akakçe.com üzerinden taze veri çeker.',
          default: false,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'akakce_get_product_offers',
    title: 'Akakçe Canlı Satıcı Fiyatları',
    description:
      'Belirli bir Akakçe ürün sayfasına girerek tüm mağaza tekliflerini (n11, Hepsiburada, Trendyol, Amazon, İdefix, PttAVM), kargo bilgisini, stok durumunu ve teknik özellikleri getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        productUrlOrId: {
          type: 'string',
          description:
            'Tercihen akakce_search çıktısından gelen tam Akakçe ürün URL adresi (ör. "https://www.akakce.com/...html"); alternatif olarak sayısal Akakçe ürün ID (ör. "614642333") verilebilir.',
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Önbelleği atlayıp satıcı listesini Akakçe’den yeniden çeker.',
          default: false,
        },
      },
      required: ['productUrlOrId'],
    },
  },
  {
    name: 'akakce_get_price_history',
    title: 'Akakçe Fiyat Geçmişi Tablosu',
    description:
      'Bir Akakçe ürün sayfasındaki resmi Fiyat Değişimi tablosunu (tarih, en ucuz fiyat, artış/düşüş miktarı ve % değişim) canlı olarak çıkarır.',
    inputSchema: {
      type: 'object',
      properties: {
        productUrlOrId: {
          type: 'string',
          description:
            'Tercihen akakce_search çıktısından gelen tam Akakçe ürün URL adresi (ör. "https://www.akakce.com/...html"); alternatif olarak sayısal ürün ID verilebilir.',
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Önbelleği atlayıp fiyat geçmişini yeniden çeker.',
          default: false,
        },
      },
      required: ['productUrlOrId'],
    },
  },
  {
    name: 'akakce_autocomplete',
    title: 'Akakçe Hızlı Öneri (Autocomplete)',
    description:
      'Akakçe resmi otomatik tamamlama API ucunu (api6.akakce.com/autocomplete) sorgulayarak eşleşen ürün, kategori ve marka önerilerini döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tamamlanacak ürün veya marka metni (ör. "samsung a3", "airpods").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'akakce_compare_product_prices',
    title: 'Akakçe Arama + Satıcı Karşılaştırma',
    description:
      'Önce Akakçe’de ürün araması yapar, ardından ilk N eşleşen ürünün satıcı sayfalarına paralel girerek en ucuz mağaza ve satıcı listesini tek yanıtta özetler.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Aranacak ürün adı veya modeli (ör. "Samsung A35 256 GB", "PlayStation 5 Slim").',
        },
        topProducts: {
          type: 'number',
          description: 'Satıcı listesi incelenecek ilk ürün sayısı (1–5 arası, varsayılan: 3).',
          default: 3,
        },
        sortBy: {
          type: 'string',
          description: 'Arama sıralaması.',
          enum: ['popularity', 'lowest_price', 'highest_price'],
          default: 'popularity',
        },
      },
      required: ['query'],
    },
  },
];

export const AKAKCE_MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'mcp://akakce/server/info',
    name: 'Akakçe MCP Sunucu Bilgisi',
    description: 'Bağlı canlı Akakçe uç noktaları ve desteklenen MCP araç sözleşmesi.',
    mimeType: 'application/json',
  },
  {
    uri: 'mcp://akakce/cache/recent',
    name: 'Son Sorgulanan Akakçe Ürünleri',
    description: 'Bu oturumda Akakçe.com üzerinden canlı çekilen son ürün kimlikleri ve URL önbelleği.',
    mimeType: 'application/json',
  },
];
