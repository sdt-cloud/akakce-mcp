export type Language = 'tr' | 'en';

export interface Translations {
  topBar: {
    brand: string;
    nav: {
      catalog: string;
      brochures: string;
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
      catalog: string;
      brochures: string;
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
  categories: Record<string, string>;
  timings: Record<string, string>;
  catalogView: {
    kicker: string;
    title: string;
    subtitle: string;
    placeholder: string;
    searchButton: string;
    loadingButton: string;
    forceRefreshLabel: string;
    quickQueries: string[];
    marketAll: string;
    timingAll: string;
    sortLowest: string;
    sortHighest: string;
    sortRelevance: string;
    resultsTitle: string;
    resultsCountSuffix: string;
    cacheHitLabel: string;
    liveFetchLabel: string;
    noResults: string;
    loadingNote: string;
    compareBtn: string;
    comparingBtn: string;
    openSourceBtn: string;
    comparePanelTitle: string;
    closePanel: string;
    aktuelPriceLabel: string;
    akakceLowestLabel: string;
    verdictLabels: {
      piyasadan_ucuz: string;
      piyasayla_benzer: string;
      piyasadan_pahali: string;
      karsilastirilamadi: string;
    };
    onlineMatchesTitle: string;
    noOnlineMatches: string;
    campaignsStripTitle: string;
    viewInBrochureBtn: string;
  };
  brochuresView: {
    kicker: string;
    title: string;
    subtitle: string;
    allMarkets: string;
    refreshBtn: string;
    loadingNote: string;
    emptyNote: string;
    pagesSuffix: string;
    productsSuffix: string;
    openOriginal: string;
    closeModal: string;
    pageLabel: string;
    productsInBrochure: string;
    filterProductsPlaceholder: string;
    showAllProducts: string;
    collapseProducts: string;
    locateOnPage: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    showBoxes: string;
    hideBoxes: string;
    scanPage: string;
    scanningPage: string;
    prevPage: string;
    nextPage: string;
    detectedOnPageTitle: string;
    brochureCatalogTitle: string;
    noDetectionsYet: string;
    selectedProductLabel: string;
    notFoundOnScannedPages: string;
    panHint: string;
    cachedBadge: string;
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
      brand: 'Aktüel MCP',
      nav: {
        catalog: 'Aktüel Katalog',
        brochures: 'Afiş & Broşürler',
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
      targetLabel: 'Marketler',
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
        catalog: '01. Haftalık Aktüel Katalog',
        brochures: '02. Broşür & Afiş Galerisi',
        playground: '03. MCP JSON-RPC Testi',
        setup: '04. Kurulum ve Starter Kod',
      },
      toolsLabel: 'Kayıtlı Aktüel Araçları',
      endpoint: 'MCP Ucu',
      targetSite: 'Canlı Kaynak',
      currency: 'Para Birimi',
      currencyValue: 'TRY (BİM · A101 · ŞOK)',
    },
    tools: {
      aktuel_bu_hafta: {
        title: 'Haftalık Aktüel Kataloğu',
        description:
          'BİM, A101 ve ŞOK marketlerinin bu haftaki güncel indirim kataloğunu, tarihlerini ve ürünlerini getirir.',
      },
      aktuel_urun_ara: {
        title: 'Aktüel Ürün Arama',
        description:
          'Aranan ürünün bu hafta BİM, A101 veya ŞOK aktüellerine gelip gelmediğini yazım hatası toleranslı (fuzzy) ve eş anlamlı (kettle → su ısıtıcı) arama ile listeler.',
      },
      aktuel_kategori: {
        title: 'Kategori Karşılaştırma',
        description:
          'Elektronik, mutfak, kamp veya yapı-oto kategorisindeki haftalık fırsatları 3 market arasında karşılaştırır.',
      },
      aktuel_takvim: {
        title: 'Haftalık Kampanya Takvimi',
        description:
          'Salı, Çarşamba, Perşembe, Cuma ve Cumartesi aktüel tarihlerini aktif ve yaklaşan olarak listeler.',
      },
      aktuel_liste_tara: {
        title: 'Toplu İhtiyaç Listesi',
        description:
          'Birden fazla ürünü tek istekte 3 markette tarayıp en ucuz eşleşmeleri ve toplam maliyeti hesaplar.',
      },
      aktuel_brosurler: {
        title: 'Broşür & Afiş Görselleri',
        description:
          'Yüksek çözünürlüklü BİM, A101 ve ŞOK broşür sayfalarının görsel URL listesini döndürür.',
      },
      aktuel_piyasa_karsilastir: {
        title: 'Piyasa (Akakçe) Kontrolü',
        description:
          'Aktüel ürün fiyatını Akakçe’deki canlı online piyasa fiyatıyla karşılaştırıp fırsat analizini çıkarır.',
      },
    },
    categories: {
      hepsi: 'Tüm Kategoriler',
      elektronik: 'Elektronik',
      mutfak: 'Mutfak',
      kamp: 'Kamp',
      ev_yasam: 'Ev & Yaşam',
      yapi_oto: 'Yapı & Oto',
      oyuncak: 'Oyuncak',
      giyim: 'Giyim',
      gida: 'Gıda',
      diger: 'Diğer',
    },
    timings: {
      hepsi: 'Tüm Tarihler',
      aktif: 'Aktif Katalog',
      yaklasan: 'Yaklaşan',
      gecmis: 'Geçmiş',
    },
    catalogView: {
      kicker: 'BİM · A101 · ŞOK CANLI MCP · POST /mcp',
      title: 'Haftalık Aktüel Ürünler ve Fiyat Karşılaştırma',
      subtitle:
        'BİM, A101 ve ŞOK marketlerinin bu haftaki aktüel kataloglarını canlı tarayın; kategoriye veya tarihe göre filtreleyin ve Akakçe piyasa fiyatıyla kıyaslayın.',
      placeholder: 'Aktüellerde ara (ör. TV, matkap, termos, tava, buzdolabı, nevresim)...',
      searchButton: 'Katalogda Ara',
      loadingButton: 'Taranıyor...',
      forceRefreshLabel: 'Canlı Yenile',
      quickQueries: ['TV', 'Matkap', 'Termos', 'Tava', 'Buzdolabı', 'Oyuncak'],
      marketAll: 'Tüm Marketler',
      timingAll: 'Tüm Tarihler',
      sortLowest: 'En Ucuz',
      sortHighest: 'En Pahalı',
      sortRelevance: 'İlgili',
      resultsTitle: 'Aktüel Ürün Listesi',
      resultsCountSuffix: 'ürün',
      cacheHitLabel: 'Önbellekten',
      liveFetchLabel: 'Canlı Çekildi',
      noResults: 'Seçilen filtrelerle eşleşen aktüel ürün bulunamadı.',
      loadingNote: 'BİM, A101 ve ŞOK haftalık katalogları canlı çekiliyor...',
      compareBtn: 'Piyasayla Kıyasla',
      comparingBtn: 'Kıyaslanıyor...',
      openSourceBtn: 'Kaynağa Git',
      comparePanelTitle: 'Akakçe Online Piyasa Karşılaştırması',
      closePanel: 'Kapat',
      aktuelPriceLabel: 'Aktüel Fiyat',
      akakceLowestLabel: 'Akakçe En Düşük',
      verdictLabels: {
        piyasadan_ucuz: 'Piyasadan Avantajlı',
        piyasayla_benzer: 'Piyasayla Benzer',
        piyasadan_pahali: 'Online Piyasa Daha Ucuz',
        karsilastirilamadi: 'Referans Bulunamadı',
      },
      onlineMatchesTitle: 'Akakçe Üzerindeki Eşleşen İlanlar',
      noOnlineMatches: 'Bu model için Akakçe üzerinde birebir online eşleşme bulunamadı.',
      campaignsStripTitle: 'Aktif ve Yaklaşan Katalog Tarihleri',
      viewInBrochureBtn: 'Broşürde Gör',
    },
    brochuresView: {
      kicker: 'HAFTALIK BROŞÜR VE AFİŞ ARŞİVİ · aktuel_brosurler',
      title: 'BİM, A101 ve ŞOK Broşür Galerisi',
      subtitle:
        'Katalogdaki ürünlere veya broşür sayfalarına tıklayarak orijinal sayfa üzerinde yakınlaştırılabilir ürün konumlarını inceleyin. Kutu tespiti yalnızca siz sayfayı açtığınızda çalışır.',
      allMarkets: 'Tümü',
      refreshBtn: 'Broşürleri Yenile',
      loadingNote: 'Haftalık broşür sayfaları yükleniyor...',
      emptyNote: 'Seçili market için aktif broşür görseli bulunamadı.',
      pagesSuffix: 'sayfa',
      productsSuffix: 'ayrıştırılan ürün',
      openOriginal: 'Orijinal Sayfa',
      closeModal: 'Kapat',
      pageLabel: 'Sayfa',
      productsInBrochure: 'Bu Broşürdeki Ürünler (Tıkla & Sayfada Gör)',
      filterProductsPlaceholder: 'Broşür içinde ürün ara...',
      showAllProducts: 'Tümünü göster',
      collapseProducts: 'Daralt',
      locateOnPage: 'Sayfada Göster',
      zoomIn: 'Yakınlaştır',
      zoomOut: 'Uzaklaştır',
      resetZoom: 'Sıfırla',
      showBoxes: 'Kutuları Göster',
      hideBoxes: 'Kutuları Gizle',
      scanPage: 'Sayfayı Tara',
      scanningPage: 'Ürün kutuları taranıyor...',
      prevPage: 'Önceki',
      nextPage: 'Sonraki',
      detectedOnPageTitle: 'Bu Sayfadaki Konumlandırılan Ürünler',
      brochureCatalogTitle: 'Broşürdeki Diğer Ürünler',
      noDetectionsYet: 'Henüz tarama yapılmadı. Kutuları görmek için sayfayı tarayın veya listeden bir ürün seçin.',
      selectedProductLabel: 'Odaklanılan Ürün',
      notFoundOnScannedPages: 'Seçilen ürün taranan sayfalarda net eşleşmedi; diğer sayfaları kontrol edebilirsiniz.',
      panHint: 'Yakınlaştırıp sürükleyerek gezinin · Kapatmak için Esc',
      cachedBadge: 'Önbellekten',
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
      title: 'Aktüel MCP Kurulumu ve Starter Kodu',
      subtitle:
        'Bu sunucunun canlı POST /mcp HTTP ucunu doğrudan AI istemcinize bağlayabilir veya yerel bilgisayarınızda stdio tabanlı aktuel-mcp sunucusunu çalıştırabilirsiniz.',
      httpConfigTitle: '1. Canlı HTTP MCP Uç Noktası',
      httpConfigDesc: 'Uzak MCP destekleyen istemcilerde doğrudan bu sunucunun /mcp adresini kullanın:',
      stdioTitle: '2. Bağımsız Yerel Stdio Aktüel MCP Projesi',
      stdioDesc: 'Claude Desktop veya Cursor ile yerelde çalışan TypeScript MCP dosyaları:',
      copy: 'Kopyala',
      copied: 'Kopyalandı',
      download: 'İndir',
      quickCommandsLabel: 'Terminal Kurulum Komutları',
    },
  },
  en: {
    topBar: {
      brand: 'Aktüel MCP',
      nav: {
        catalog: 'Weekly Catalog',
        brochures: 'Brochures',
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
      targetLabel: 'Markets',
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
        catalog: '01. Weekly Aktüel Catalog',
        brochures: '02. Brochure Gallery',
        playground: '03. MCP JSON-RPC Lab',
        setup: '04. Setup & Starter Code',
      },
      toolsLabel: 'Registered Aktüel Tools',
      endpoint: 'MCP Endpoint',
      targetSite: 'Live Sources',
      currency: 'Currency',
      currencyValue: 'TRY (BİM · A101 · ŞOK)',
    },
    tools: {
      aktuel_bu_hafta: {
        title: 'Weekly Market Catalogs',
        description:
          'Fetches this week’s active discount catalog, validity dates, and products for BİM, A101, and ŞOK.',
      },
      aktuel_urun_ara: {
        title: 'Search Weekly Deals',
        description:
          'Fuzzy and synonym-aware search (e.g. kettle → su ısıtıcı) across BİM, A101, and ŞOK weekly catalogs.',
      },
      aktuel_kategori: {
        title: 'Category Comparison',
        description:
          'Compares weekly offers in electronics, kitchen, camping, home, or tools across all 3 chains.',
      },
      aktuel_takvim: {
        title: 'Weekly Release Calendar',
        description:
          'Lists active and upcoming release dates across Tuesday–Saturday supermarket cycles.',
      },
      aktuel_liste_tara: {
        title: 'Batch Shopping List',
        description:
          'Scans a list of items across all 3 chains in one call and estimates the lowest basket total.',
      },
      aktuel_brosurler: {
        title: 'Brochure Poster URLs',
        description:
          'Returns high-resolution brochure page image URLs for BİM, A101, and ŞOK campaigns.',
      },
      aktuel_piyasa_karsilastir: {
        title: 'Market vs. Akakçe Check',
        description:
          'Compares an aktüel deal price against live online Akakçe pricing to verify real savings.',
      },
    },
    categories: {
      hepsi: 'All Categories',
      elektronik: 'Electronics',
      mutfak: 'Kitchen',
      kamp: 'Camping',
      ev_yasam: 'Home & Living',
      yapi_oto: 'Tools & Auto',
      oyuncak: 'Toys',
      giyim: 'Apparel',
      gida: 'Grocery',
      diger: 'Other',
    },
    timings: {
      hepsi: 'All Dates',
      aktif: 'Active Now',
      yaklasan: 'Upcoming',
      gecmis: 'Past',
    },
    catalogView: {
      kicker: 'BİM · A101 · ŞOK LIVE MCP · POST /mcp',
      title: 'Weekly Aktüel Catalog & Price Comparison',
      subtitle:
        'Browse live weekly discount catalogs from BİM, A101, and ŞOK, filter by category or release timing, and benchmark prices against Akakçe.',
      placeholder: 'Search weekly deals (e.g. TV, matkap, termos, tava, buzdolabı)...',
      searchButton: 'Search Catalog',
      loadingButton: 'Scanning...',
      forceRefreshLabel: 'Force Refresh',
      quickQueries: ['TV', 'Matkap', 'Termos', 'Tava', 'Buzdolabı', 'Oyuncak'],
      marketAll: 'All Markets',
      timingAll: 'All Dates',
      sortLowest: 'Lowest Price',
      sortHighest: 'Highest Price',
      sortRelevance: 'Relevant',
      resultsTitle: 'Aktüel Product Listings',
      resultsCountSuffix: 'items',
      cacheHitLabel: 'Cached',
      liveFetchLabel: 'Live Fetch',
      noResults: 'No weekly aktüel items matched your selected filters.',
      loadingNote: 'Fetching live weekly catalogs from BİM, A101, and ŞOK...',
      compareBtn: 'Compare Online',
      comparingBtn: 'Comparing...',
      openSourceBtn: 'Source',
      comparePanelTitle: 'Live Akakçe Online Benchmark',
      closePanel: 'Close',
      aktuelPriceLabel: 'Store Deal Price',
      akakceLowestLabel: 'Akakçe Lowest',
      verdictLabels: {
        piyasadan_ucuz: 'Cheaper Than Online',
        piyasayla_benzer: 'Similar To Online',
        piyasadan_pahali: 'Cheaper Online',
        karsilastirilamadi: 'No Benchmark Found',
      },
      onlineMatchesTitle: 'Matching Online Listings on Akakçe',
      noOnlineMatches: 'No direct online match found on Akakçe for this item.',
      campaignsStripTitle: 'Active & Upcoming Release Dates',
      viewInBrochureBtn: 'View in Brochure',
    },
    brochuresView: {
      kicker: 'WEEKLY BROCHURE ARCHIVE · aktuel_brosurler',
      title: 'BİM, A101 & ŞOK Brochure Gallery',
      subtitle:
        'Click any product or catalog page to inspect the original flyer in a zoomable viewer with highlighted bounding boxes. Vision detection runs on demand only when opened.',
      allMarkets: 'All',
      refreshBtn: 'Refresh Brochures',
      loadingNote: 'Loading weekly brochure posters...',
      emptyNote: 'No active brochure posters found for the selected market.',
      pagesSuffix: 'pages',
      productsSuffix: 'parsed items',
      openOriginal: 'Original Page',
      closeModal: 'Close',
      pageLabel: 'Page',
      productsInBrochure: 'Products in This Brochure (Click to Locate)',
      filterProductsPlaceholder: 'Filter items in brochure...',
      showAllProducts: 'Show all',
      collapseProducts: 'Collapse',
      locateOnPage: 'Locate on Page',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset',
      showBoxes: 'Show Boxes',
      hideBoxes: 'Hide Boxes',
      scanPage: 'Scan Page',
      scanningPage: 'Detecting product bounding boxes...',
      prevPage: 'Prev',
      nextPage: 'Next',
      detectedOnPageTitle: 'Detected Items on This Page',
      brochureCatalogTitle: 'Other Brochure Items',
      noDetectionsYet: 'Not scanned yet. Scan this page or click a product to highlight its bounding box.',
      selectedProductLabel: 'Focused Product',
      notFoundOnScannedPages: 'Selected product could not be matched on the scanned pages; try switching pages.',
      panHint: 'Scroll to zoom · Drag to pan · Esc to close',
      cachedBadge: 'Cached',
    },
    playground: {
      kicker: 'MODEL CONTEXT PROTOCOL · JSON-RPC 2.0',
      title: 'MCP JSON-RPC 2.0 Test Console',
      subtitle:
        'Send raw JSON-RPC 2.0 requests to POST /mcp just as Claude Desktop or Cursor does, and inspect the live aktuel-mcp payloads.',
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
      title: 'Aktüel MCP Setup & Starter Code',
      subtitle:
        'Connect directly to this server’s live POST /mcp HTTP endpoint or run the standalone stdio TypeScript aktuel-mcp server locally.',
      httpConfigTitle: '1. Live HTTP MCP Endpoint',
      httpConfigDesc: 'Point remote-MCP-capable clients directly to this server’s /mcp endpoint:',
      stdioTitle: '2. Standalone Local Stdio Aktüel MCP Project',
      stdioDesc: 'Pure TypeScript MCP server files connecting live to BİM, A101 & ŞOK catalogs:',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      quickCommandsLabel: 'Terminal Setup Commands',
    },
  },
};
