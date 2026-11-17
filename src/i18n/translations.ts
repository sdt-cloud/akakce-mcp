export type Language = 'tr' | 'en';

export interface Translations {
  topBar: {
    nav: {
      search: string;
      playground: string;
      setup: string;
    };
    copyConfig: string;
    copiedConfig: string;
  };
  apiHealth: {
    healthy: string;
    degraded: string;
    checking: string;
    healthEndpoint: string;
    mcpEndpoint: string;
    targetLabel: string;
    toolsUnit: string;
    resourcesUnit: string;
    uptimeLabel: string;
    checkedLabel: string;
    checkNow: string;
    unreachable: string;
  };
  sidebar: {
    languageLabel: string;
    sectionsLabel: string;
    sections: {
      search: string;
      playground: string;
      setup: string;
    };
    toolsLabel: string;
    endpoint: string;
    targetSite: string;
    currency: string;
    currencyValue: string;
  };
  tools: Record<
    string,
    {
      title: string;
      description: string;
    }
  >;
  searchView: {
    kicker: string;
    title: string;
    subtitle: string;
    placeholder: string;
    searchButton: string;
    searchingButton: string;
    sortLabel: string;
    sorts: {
      popularity: string;
      lowest_price: string;
      highest_price: string;
    };
    forceRefreshLabel: string;
    quickQueries: string[];
    autocompleteProducts: string;
    resultsTitle: string;
    resultsCountSuffix: string;
    cacheHitLabel: string;
    liveFetchLabel: string;
    categoryRedirectNote: string;
    openOnAkakce: string;
    inspectOffersBtn: string;
    offerCountSuffix: string;
    followersSuffix: string;
    discountPrefix: string;
    noResults: string;
    initialPrompt: string;
    detailsLoading: string;
    sellersTab: string;
    historyTab: string;
    specsTab: string;
    variantsTitle: string;
    rankCol: string;
    marketplaceSellerCol: string;
    listingTitleCol: string;
    shippingStockCol: string;
    priceCol: string;
    cheapestBadge: string;
    noOffersParsed: string;
    noHistoryParsed: string;
    dateCol: string;
    lowestHistoryCol: string;
    changeCol: string;
    percentCol: string;
    minRecordedLabel: string;
    maxRecordedLabel: string;
    currentPriceLabel: string;
    ratingLabel: string;
    reviewsSuffix: string;
    closeDetails: string;
    perPageLabel: string;
    allResultsOption: string;
    crawlingAllNote: string;
    loadingMoreLabel: string;
    stopCrawlingLabel: string;
    filterResultsPlaceholder: string;
    akakcePagesSuffix: string;
    prevPage: string;
    nextPage: string;
    pageLabel: string;
    singleSellerNote: string;
    searchOnAkakce: string;
  };
  playground: {
    kicker: string;
    title: string;
    subtitle: string;
    rpcMethodLabel: string;
    targetToolLabel: string;
    argumentsLabel: string;
    useFormInputs: string;
    editRawJson: string;
    resourceUriLabel: string;
    executeButton: string;
    executingButton: string;
    roundTrip: string;
    copyJson: string;
    copied: string;
    requestHeader: string;
    responseHeader: string;
    invalidJsonError: string;
    reachError: string;
  };
  setup: {
    kicker: string;
    title: string;
    subtitle: string;
    httpConfigTitle: string;
    httpConfigDesc: string;
    stdioTitle: string;
    stdioDesc: string;
    copy: string;
    copied: string;
    download: string;
    quickCommandsLabel: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  tr: {
    topBar: {
      nav: {
        search: 'Canlı Arama',
        playground: 'MCP Test Alanı',
        setup: 'Kurulum & Kod',
      },
      copyConfig: 'MCP Ayarını Kopyala',
      copiedConfig: 'Kopyalandı',
    },
    apiHealth: {
      healthy: 'API Sağlıklı',
      degraded: 'Bağlantı Sorunu',
      checking: 'Kontrol Ediliyor',
      healthEndpoint: 'REST Sağlık',
      mcpEndpoint: 'MCP JSON-RPC',
      targetLabel: 'Kaynak',
      toolsUnit: 'Araç',
      resourcesUnit: 'Kaynak',
      uptimeLabel: 'Çalışma',
      checkedLabel: 'Son Kontrol',
      checkNow: 'Kontrol Et',
      unreachable: 'Erişilemiyor',
    },
    sidebar: {
      languageLabel: 'Dil',
      sectionsLabel: 'Çalışma Alanı',
      sections: {
        search: '01. Akakçe Canlı Arama',
        playground: '02. MCP JSON-RPC Testi',
        setup: '03. Kurulum ve Starter Kod',
      },
      toolsLabel: 'Kayıtlı Akakçe Araçları',
      endpoint: 'MCP Ucu',
      targetSite: 'Canlı Kaynak',
      currency: 'Para Birimi',
      currencyValue: 'TRY (Akakçe Canlı)',
    },
    tools: {
      akakce_search: {
        title: 'Akakçe Canlı Ürün Arama',
        description:
          'Akakçe.com arama sayfasını canlı sorgular; ürün adlarını, en düşük TL fiyatlarını, satıcı sayısını ve Akakçe linklerini döndürür.',
      },
      akakce_get_product_offers: {
        title: 'Canlı Satıcı Fiyatları',
        description:
          'Seçilen Akakçe ürün sayfasına girerek tüm mağaza tekliflerini, kargo durumunu, stok ve teknik özellikleri getirir.',
      },
      akakce_get_price_history: {
        title: 'Akakçe Fiyat Geçmişi',
        description:
          'Akakçe ürün sayfasındaki resmi Fiyat Değişimi tablosunu (tarih, en ucuz fiyat, TL ve % değişim) canlı olarak çıkarır.',
      },
      akakce_autocomplete: {
        title: 'Akakçe Hızlı Öneri',
        description:
          'api6.akakce.com/autocomplete ucunu sorgulayarak ürün, kategori ve marka önerilerini anında döndürür.',
      },
      akakce_compare_product_prices: {
        title: 'Çoklu Satıcı Karşılaştırma',
        description:
          'Akakçe’de arama yapıp ilk N ürünün mağaza sayfalarını paralel çekerek en ucuz satıcıları tek seferde özetler.',
      },
    },
    searchView: {
      kicker: 'AKAKCE.COM CANLI MCP · POST /mcp (akakce_search)',
      title: 'Akakçe Canlı Arama ve Fiyat Karşılaştırma',
      subtitle:
        'Buradan yaptığınız her arama doğrudan POST /mcp üzerinden Akakçe.com’a bağlanır; canlı arama sonuçlarını, mağaza tekliflerini ve fiyat geçmişini gösterir.',
      placeholder: 'Akakçe’de ara (ör. Samsung A35, Samsung A37, iPhone 16, Dyson V15, Çamaşır Makinesi)...',
      searchButton: 'Akakçe’de Ara',
      searchingButton: 'Akakçe taranıyor...',
      sortLabel: 'Sıralama',
      sorts: {
        popularity: 'Akakçe Popülerliği',
        lowest_price: 'En Düşük Fiyat',
        highest_price: 'En Yüksek Fiyat',
      },
      forceRefreshLabel: 'Önbelleği Atla',
      quickQueries: ['Samsung A35', 'Samsung A37', 'iPhone 16', 'Dyson V15', 'Çamaşır Makinesi'],
      autocompleteProducts: 'Akakçe Anlık Önerileri',
      resultsTitle: 'Akakçe Arama Sonuçları',
      resultsCountSuffix: 'ürün',
      cacheHitLabel: 'Önbellekten',
      liveFetchLabel: 'Akakçe.com Canlı',
      categoryRedirectNote: 'Kategori sayfasına yönlendirildi',
      openOnAkakce: 'Akakçe’de Aç',
      inspectOffersBtn: 'Satıcılar & Geçmiş',
      offerCountSuffix: 'satıcı fiyatı',
      followersSuffix: 'takip',
      discountPrefix: 'İndirim',
      noResults: 'Akakçe.com bu sorgu için listelenebilir ürün döndürmedi. Farklı bir anahtar kelime deneyin.',
      initialPrompt: 'Akakçe.com üzerinden canlı fiyat çekmek için yukarıdan bir ürün arayın.',
      detailsLoading: 'Akakçe ürün sayfasından satıcı teklifleri ve fiyat geçmişi yükleniyor...',
      sellersTab: 'Mağaza Teklifleri',
      historyTab: 'Fiyat Değişimi',
      specsTab: 'Teknik Özellikler',
      variantsTitle: 'Diğer Varyant / Renk Seçenekleri',
      rankCol: 'Sıra',
      marketplaceSellerCol: 'Pazaryeri / Satıcı',
      listingTitleCol: 'Satıcı İlan Başlığı',
      shippingStockCol: 'Kargo ve Teslimat',
      priceCol: 'Fiyat',
      cheapestBadge: 'En Ucuz',
      noOffersParsed: 'Bu ürün için aktif satıcı listesi bulunamadı.',
      noHistoryParsed: 'Bu ürün sayfasında fiyat değişim tablosu yer almıyor.',
      dateCol: 'Tarih',
      lowestHistoryCol: 'En Ucuz Fiyat',
      changeCol: 'Değişim',
      percentCol: 'Oran',
      minRecordedLabel: 'Dönem En Düşük',
      maxRecordedLabel: 'Dönem En Yüksek',
      currentPriceLabel: 'Güncel En Ucuz',
      ratingLabel: 'Puan',
      reviewsSuffix: 'değerlendirme',
      closeDetails: 'Kapat',
      perPageLabel: 'Sonuç',
      allResultsOption: 'Tümü',
      crawlingAllNote: 'Tüm Akakçe sayfaları paralel çekiliyor...',
      loadingMoreLabel: 'Kalan Akakçe sayfaları yükleniyor',
      stopCrawlingLabel: 'Durdur',
      filterResultsPlaceholder: 'Yüklenen sonuçlar içinde filtrele...',
      akakcePagesSuffix: 'Akakçe sayfası',
      prevPage: 'Önceki Sayfa',
      nextPage: 'Sonraki Sayfa',
      pageLabel: 'Sayfa',
      singleSellerNote: 'Tek Satıcı',
      searchOnAkakce: 'Akakçe’de Ara',
    },
    playground: {
      kicker: 'MODEL CONTEXT PROTOCOL · JSON-RPC 2.0',
      title: 'MCP JSON-RPC 2.0 Test Alanı',
      subtitle:
        'Claude Desktop, Cursor veya herhangi bir AI ajanının POST /mcp ucuna göndereceği ham JSON-RPC 2.0 isteklerini doğrudan test edin.',
      rpcMethodLabel: 'JSON-RPC Yöntemi',
      targetToolLabel: 'MCP Aracı',
      argumentsLabel: 'Parametreler',
      useFormInputs: 'Form Kullan',
      editRawJson: 'Ham JSON Düzenle',
      resourceUriLabel: 'Kaynak URI',
      executeButton: 'MCP İsteğini Çalıştır',
      executingButton: 'Çalıştırılıyor...',
      roundTrip: 'Yanıt süresi',
      copyJson: 'JSON Kopyala',
      copied: 'Kopyalandı',
      requestHeader: 'İstek · POST /mcp',
      responseHeader: 'JSON-RPC 2.0 Yanıtı',
      invalidJsonError: 'Ham parametre alanında geçersiz JSON sözdizimi.',
      reachError: '/mcp sunucusuna ulaşılamadı.',
    },
    setup: {
      kicker: '@modelcontextprotocol/sdk · CLAUDE DESKTOP & CURSOR',
      title: 'Akakçe MCP Kurulumu ve Starter Kodu',
      subtitle:
        'Bu uygulamanın canlı POST /mcp HTTP uç noktasını doğrudan bağlayabilir veya yerel bilgisayarınızda stdio tabanlı bağımsız Akakçe MCP sunucusunu çalıştırabilirsiniz.',
      httpConfigTitle: '1. Canlı HTTP MCP Uç Noktası',
      httpConfigDesc: 'Uzak MCP destekleyen istemcilerde doğrudan bu sunucunun /mcp adresini kullanın:',
      stdioTitle: '2. Bağımsız Yerel Stdio Akakçe MCP Projesi',
      stdioDesc: 'Claude Desktop veya Cursor ile yerelde akakce.com’a bağlanan saf TypeScript MCP dosyaları:',
      copy: 'Kopyala',
      copied: 'Kopyalandı',
      download: 'İndir',
      quickCommandsLabel: 'Terminal Kurulum Komutları',
    },
  },
  en: {
    topBar: {
      nav: {
        search: 'Live Search',
        playground: 'MCP Playground',
        setup: 'Setup & Code',
      },
      copyConfig: 'Copy MCP Config',
      copiedConfig: 'Copied',
    },
    apiHealth: {
      healthy: 'API Healthy',
      degraded: 'Degraded',
      checking: 'Checking',
      healthEndpoint: 'REST Health',
      mcpEndpoint: 'MCP JSON-RPC',
      targetLabel: 'Source',
      toolsUnit: 'Tools',
      resourcesUnit: 'Resources',
      uptimeLabel: 'Uptime',
      checkedLabel: 'Checked',
      checkNow: 'Check Now',
      unreachable: 'Unreachable',
    },
    sidebar: {
      languageLabel: 'Language',
      sectionsLabel: 'Workspace',
      sections: {
        search: '01. Live Akakçe Search',
        playground: '02. MCP JSON-RPC Lab',
        setup: '03. Setup & Starter Code',
      },
      toolsLabel: 'Registered Akakçe Tools',
      endpoint: 'MCP Endpoint',
      targetSite: 'Live Target',
      currency: 'Currency',
      currencyValue: 'TRY (Live Akakçe)',
    },
    tools: {
      akakce_search: {
        title: 'Live Akakçe Product Search',
        description:
          'Queries akakce.com/arama/ live and returns matching products, lowest TRY prices, offer counts, and direct Akakçe links.',
      },
      akakce_get_product_offers: {
        title: 'Live Seller Offers',
        description:
          'Fetches a specific Akakçe product page to parse all live merchant offers, shipping fees, stock status, and specs.',
      },
      akakce_get_price_history: {
        title: 'Akakçe Price History',
        description:
          'Extracts the official Price Change table (date, lowest price, TRY delta, % delta) directly from an Akakçe product page.',
      },
      akakce_autocomplete: {
        title: 'Akakçe Autocomplete',
        description:
          'Queries api6.akakce.com/autocomplete for instant product, category, and brand suggestions.',
      },
      akakce_compare_product_prices: {
        title: 'Multi-Product Seller Comparison',
        description:
          'Searches Akakçe and fetches seller offer lists for the top N results in parallel.',
      },
    },
    searchView: {
      kicker: 'AKAKCE.COM LIVE MCP · POST /mcp (akakce_search)',
      title: 'Akakçe Live Search & Price Comparison',
      subtitle:
        'Every search executes real JSON-RPC calls against akakce.com via POST /mcp, returning live search results, merchant offers, and price history.',
      placeholder: 'Search Akakçe live (e.g. Samsung A35, Samsung A37, iPhone 16, Dyson V15)...',
      searchButton: 'Search Akakçe',
      searchingButton: 'Querying Akakçe...',
      sortLabel: 'Sort',
      sorts: {
        popularity: 'Akakçe Popularity',
        lowest_price: 'Lowest Price',
        highest_price: 'Highest Price',
      },
      forceRefreshLabel: 'Bypass Cache',
      quickQueries: ['Samsung A35', 'Samsung A37', 'iPhone 16', 'Dyson V15', 'Çamaşır Makinesi'],
      autocompleteProducts: 'Akakçe Live Suggestions',
      resultsTitle: 'Akakçe Search Results',
      resultsCountSuffix: 'products',
      cacheHitLabel: 'Cached',
      liveFetchLabel: 'Live Akakce.com',
      categoryRedirectNote: 'Redirected to category page',
      openOnAkakce: 'Open on Akakçe',
      inspectOffersBtn: 'Sellers & History',
      offerCountSuffix: 'offers',
      followersSuffix: 'followers',
      discountPrefix: 'Drop',
      noResults: 'Akakce.com returned no product listings for this query. Try another search term.',
      initialPrompt: 'Search for any product above to fetch live prices from Akakce.com.',
      detailsLoading: 'Loading live merchant offers and price history from Akakce.com...',
      sellersTab: 'Merchant Offers',
      historyTab: 'Price History',
      specsTab: 'Specifications',
      variantsTitle: 'Other Color / Variant Options',
      rankCol: 'Rank',
      marketplaceSellerCol: 'Marketplace / Seller',
      listingTitleCol: 'Seller Listing Title',
      shippingStockCol: 'Shipping & Delivery',
      priceCol: 'Price',
      cheapestBadge: 'Cheapest',
      noOffersParsed: 'No active seller list found on this product page.',
      noHistoryParsed: 'No price change history table found for this product.',
      dateCol: 'Date',
      lowestHistoryCol: 'Lowest Price',
      changeCol: 'Delta',
      percentCol: '% Change',
      minRecordedLabel: 'Period Low',
      maxRecordedLabel: 'Period High',
      currentPriceLabel: 'Current Lowest',
      ratingLabel: 'Rating',
      reviewsSuffix: 'reviews',
      closeDetails: 'Close',
      perPageLabel: 'Results',
      allResultsOption: 'All',
      crawlingAllNote: 'Fetching all Akakçe result pages in parallel...',
      loadingMoreLabel: 'Loading remaining Akakçe pages',
      stopCrawlingLabel: 'Stop',
      filterResultsPlaceholder: 'Filter within loaded results...',
      akakcePagesSuffix: 'Akakçe pages',
      prevPage: 'Previous Page',
      nextPage: 'Next Page',
      pageLabel: 'Page',
      singleSellerNote: 'Single Offer',
      searchOnAkakce: 'Find on Akakçe',
    },
    playground: {
      kicker: 'MODEL CONTEXT PROTOCOL · JSON-RPC 2.0',
      title: 'MCP JSON-RPC 2.0 Test Console',
      subtitle:
        'Send raw JSON-RPC 2.0 requests to POST /mcp just as Claude Desktop or Cursor does, and inspect the live Akakçe payloads.',
      rpcMethodLabel: 'JSON-RPC Method',
      targetToolLabel: 'MCP Tool',
      argumentsLabel: 'Arguments',
      useFormInputs: 'Use Form',
      editRawJson: 'Edit Raw JSON',
      resourceUriLabel: 'Resource URI',
      executeButton: 'Execute MCP Call',
      executingButton: 'Executing...',
      roundTrip: 'Latency',
      copyJson: 'Copy JSON',
      copied: 'Copied',
      requestHeader: 'Request · POST /mcp',
      responseHeader: 'JSON-RPC 2.0 Response',
      invalidJsonError: 'Invalid JSON syntax in arguments editor.',
      reachError: 'Failed to reach /mcp server.',
    },
    setup: {
      kicker: '@modelcontextprotocol/sdk · CLAUDE DESKTOP & CURSOR',
      title: 'Akakçe MCP Setup & Starter Code',
      subtitle:
        'Connect directly to this server’s live POST /mcp HTTP endpoint or run the standalone stdio TypeScript MCP server locally.',
      httpConfigTitle: '1. Live HTTP MCP Endpoint',
      httpConfigDesc: 'Point remote-MCP-capable clients directly to this server’s /mcp endpoint:',
      stdioTitle: '2. Standalone Local Stdio Akakçe MCP Project',
      stdioDesc: 'Pure TypeScript MCP server files connecting directly to akakce.com for Claude Desktop or Cursor:',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      quickCommandsLabel: 'Terminal Setup Commands',
    },
  },
};
