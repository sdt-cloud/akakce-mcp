import type { McpResourceDefinition, McpToolDefinition } from './types.ts';

export const AKTUEL_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'aktuel_bu_hafta',
    title: 'Bu Haftanın Aktüel Katalogları',
    description:
      'BİM, A101 ve ŞOK marketlerinden seçilenin (veya hepsinin) bu haftaki güncel aktüel indirim kataloğunu, ürün fiyatlarını, geçerlilik tarihlerini ve broşür bilgilerini canlı getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        market: {
          type: 'string',
          description: 'Kataloğu çekilecek market: bim, a101, sok veya hepsi (varsayılan: hepsi).',
          enum: ['bim', 'a101', 'sok', 'hepsi'],
          default: 'hepsi',
        },
        onlyActiveOrUpcoming: {
          type: 'boolean',
          description: 'true olduğunda yalnızca şu an aktif veya yaklaşan kampanyaları döndürür (varsayılan: true).',
          default: true,
        },
        limitPerMarket: {
          type: 'number',
          description: 'Her market için döndürülecek maksimum ürün sayısı (varsayılan: 60).',
          default: 60,
        },
        forceRefresh: {
          type: 'boolean',
          description: '30 dakikalık önbelleği atlayıp market kataloglarını canlı yeniler.',
          default: false,
        },
      },
      required: ['market'],
    },
  },
  {
    name: 'aktuel_urun_ara',
    title: 'Aktüel Ürün Arama',
    description:
      'Aranan ürünün (ör. "termos", "kettle", "televizyon", "matkap") bu hafta BİM, A101 veya ŞOK aktüel kataloglarına gelip gelmediğini bulanık (yazım hatası toleranslı) ve eş anlamlı (ör. kettle → su ısıtıcı, airfryer → yağsız fritöz) eşleştirme ile arar.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Aranacak ürün adı, marka veya anahtar kelime (ör. "termos", "QLED TV", "Piranha").',
        },
        market: {
          type: 'string',
          description: 'Aranacak market kapsamı: hepsi (varsayılan), bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
        category: {
          type: 'string',
          description: 'İsteğe bağlı kategori filtresi: hepsi (varsayılan), elektronik, mutfak, kamp, ev_yasam, yapi_oto, oyuncak, giyim, gida.',
          enum: [
            'hepsi',
            'elektronik',
            'mutfak',
            'kamp',
            'ev_yasam',
            'yapi_oto',
            'oyuncak',
            'giyim',
            'gida',
            'diger',
          ],
          default: 'hepsi',
        },
        sortBy: {
          type: 'string',
          description: 'Sıralama ölçütü: relevance (ilgi), lowest_price (en ucuz), highest_price (en pahalı).',
          enum: ['relevance', 'lowest_price', 'highest_price'],
          default: 'relevance',
        },
        timing: {
          type: 'string',
          description: 'Zaman filtresi: hepsi (varsayılan), aktif (satışta) veya yaklasan (gelecek kataloglar).',
          enum: ['hepsi', 'aktif', 'yaklasan'],
          default: 'hepsi',
        },
        limit: {
          type: 'number',
          description: 'Döndürülecek maksimum sonuç sayısı (varsayılan: 50).',
          default: 50,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'aktuel_kategori',
    title: 'Kategori Bazlı Aktüel Karşılaştırma',
    description:
      'Belirli bir kategorideki (elektronik, mutfak, kamp, ev_yasam, yapi_oto, oyuncak, giyim, gida) haftalık aktüel fırsatlarını BİM, A101 ve ŞOK arasında fiyat sırasıyla karşılaştırır.',
    inputSchema: {
      type: 'object',
      properties: {
        kategori: {
          type: 'string',
          description: 'Filtrelenecek ürün kategorisi.',
          enum: [
            'elektronik',
            'mutfak',
            'kamp',
            'ev_yasam',
            'yapi_oto',
            'oyuncak',
            'giyim',
            'gida',
            'hepsi',
          ],
          default: 'elektronik',
        },
        market: {
          type: 'string',
          description: 'Karşılaştırılacak market: hepsi (varsayılan), bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
        sortBy: {
          type: 'string',
          description: 'Fiyat sıralaması: lowest_price veya highest_price.',
          enum: ['lowest_price', 'highest_price'],
          default: 'lowest_price',
        },
        limit: {
          type: 'number',
          description: 'Döndürülecek maksimum ürün sayısı (varsayılan: 60).',
          default: 60,
        },
      },
      required: ['kategori'],
    },
  },
  {
    name: 'aktuel_takvim',
    title: 'Haftalık Aktüel Kampanya Takvimi',
    description:
      'BİM (Salı/Cuma), A101 (Perşembe/Hafta Sonu) ve ŞOK (Çarşamba/Cumartesi) aktüel tarihlerini listeler; "yarın hangi markete ne geliyor?" sorularını yanıtlar.',
    inputSchema: {
      type: 'object',
      properties: {
        market: {
          type: 'string',
          description: 'Market filtresi: hepsi, bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
        gun: {
          type: 'string',
          description: 'Gün filtresi (ör. hepsi, sali, carsamba, persembe, cuma, cumartesi).',
          enum: ['hepsi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'],
          default: 'hepsi',
        },
        durum: {
          type: 'string',
          description: 'Kampanya zaman durumu: hepsi, aktif veya yaklasan.',
          enum: ['hepsi', 'aktif', 'yaklasan'],
          default: 'hepsi',
        },
      },
    },
  },
  {
    name: 'aktuel_liste_tara',
    title: 'Toplu İhtiyaç Listesi Tarayıcı',
    description:
      'Birden fazla ürün ihtiyacını (ör. ["termos", "matkap", "televizyon"]) tek istekte 3 marketin aktüellerinde tarar; her kalem için en ucuz eşleşmeyi ve tahmini sepet toplamını döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Aranacak ürün listesi (ör. ["televizyon", "tava", "matkap"]).',
          default: ['televizyon', 'matkap', 'tava'],
        },
        market: {
          type: 'string',
          description: 'Taranacak market: hepsi, bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'aktuel_brosurler',
    title: 'Broşür ve Afiş Görselleri',
    description:
      'BİM, A101 ve ŞOK marketlerinin güncel aktüel broşür sayfalarının yüksek çözünürlüklü görsel URL adreslerini ve geçerlilik tarihlerini döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        market: {
          type: 'string',
          description: 'Market seçimi: hepsi, bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Önbelleği atlayıp güncel afiş bağlantılarını yeniler.',
          default: false,
        },
      },
    },
  },
  {
    name: 'aktuel_piyasa_karsilastir',
    title: 'Aktüel vs. Piyasa (Akakçe) Kontrolü',
    description:
      'Bir aktüel ürünün BİM/A101/ŞOK fiyatını canlı Akakçe çevrimiçi piyasa fiyatıyla karşılaştırarak gerçek bir indirim olup olmadığını analiz eder.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Karşılaştırılacak aktüel ürün adı veya modeli (ör. "Onvo QLED TV", "Keysmart Buzdolabı").',
        },
        market: {
          type: 'string',
          description: 'Aktüel ürünün aranacağı market: hepsi, bim, a101 veya sok.',
          enum: ['hepsi', 'bim', 'a101', 'sok'],
          default: 'hepsi',
        },
      },
      required: ['query'],
    },
  },
];

export const AKTUEL_MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'mcp://aktuel/server/info',
    name: 'Aktüel MCP Sunucu Bilgisi',
    description: 'Bağlı market kaynakları (BİM, A101, ŞOK), önbellek süresi ve desteklenen MCP araç sözleşmesi.',
    mimeType: 'application/json',
  },
  {
    uri: 'mcp://aktuel/takvim/bu-hafta',
    name: 'Bu Haftanın Aktüel Takvimi',
    description: 'BİM, A101 ve ŞOK için aktif ve yaklaşan aktüel kampanya tarihlerinin canlı özeti.',
    mimeType: 'application/json',
  },
  {
    uri: 'mcp://aktuel/marketler/durum',
    name: 'Market Önbellek ve Kaynak Durumu',
    description: 'BİM, A101 ve ŞOK kataloglarının son çekilme zamanları ve önbellekteki ürün sayıları.',
    mimeType: 'application/json',
  },
];
