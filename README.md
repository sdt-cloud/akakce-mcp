# aktuel-mcp

**Akakçe MCP kurulumu** · Akakçe.com’da ürün aramak ve satıcı fiyatlarını karşılaştırmak için [Claude ve ChatGPT kurulum rehberine](https://github.com/sdt-cloud/akakce-mcp/tree/akakce-vercel#h%C4%B1zl%C4%B1-kurulum) bakın.

**BİM, A101 ve ŞOK** marketlerinin haftalık aktüel ürün kataloglarını, fiyatlarını, geçerlilik tarihlerini ve broşür görsellerini canlı ayrıştırıp yapay zeka istemcilerine (Claude Desktop, Cursor, Gemini CLI vb.) sunan **Model Context Protocol (MCP)** sunucusu.

## Sağlanan MCP Araçları

1. `aktuel_bu_hafta(market, onlyActiveOrUpcoming?, limitPerMarket?, forceRefresh?)`
   Seçilen marketin (veya hepsinin) güncel haftalık aktüel kataloğunu, kampanya tarihlerini ve broşür bilgilerini döndürür.
2. `aktuel_urun_ara(query, market?, sortBy?, timing?, limit?)`
   Türkçe karakter uyumlu, yazım hatası toleranslı (fuzzy) ve eş anlamlı (`kettle → su ısıtıcı`, `airfryer → yağsız fritöz`) arama ile istenen ürünün bu hafta hangi markete kaç TL'den geldiğini listeler.
3. `aktuel_kategori(kategori, market?, sortBy?, limit?)`
   `elektronik`, `mutfak`, `kamp`, `ev_yasam`, `yapi_oto`, `oyuncak`, `giyim`, `gida` kategorilerindeki fırsatları karşılaştırır.
4. `aktuel_takvim(market?, gun?, durum?)`
   Salı–Cumartesi döngüsündeki aktif ve yaklaşan aktüel kampanya tarihlerini listeler.
5. `aktuel_liste_tara(items, market?)`
   Çoklu ihtiyaç listesini tek seferde 3 markette tarayıp en ucuz eşleşmeleri ve tahmini sepet toplamını hesaplar.
6. `aktuel_brosurler(market?, forceRefresh?)`
   Haftalık broşür sayfalarının yüksek çözünürlüklü görsel URL'lerini döndürür.
7. `aktuel_piyasa_karsilastir(query, market?)`
   Bulunan aktüel ürünün fiyatını Akakçe'deki canlı çevrimiçi piyasa fiyatıyla kıyaslar.

## Web Konsolu & Broşür Görüntüleyici
- **Canlı Katalog & Akakçe Kıyaslama:** Ürün arama sonuçlarında tek tıkla Akakçe online piyasa kıyaslaması ve **Broşürde Gör** modalı.
- **Yakınlaştırılabilir Broşür Modalı (`POST /api/brochures/locate-products`):** Tıklanan ürünün orijinal katalog sayfasındaki konumunu talep üzerine (`gemini-4-hydrogen`) bounding box ile işaretler ve önbelleğe alır.

## Çalıştırma

```bash
npm install
npm run dev        # Web konsolu + POST /mcp (port 3000)
npm run mcp:stdio  # Claude Desktop / Cursor için stdio MCP sunucusu
```

