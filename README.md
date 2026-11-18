# Akakçe MCP

Gerçek zamanlı olarak `akakce.com` ve `api6.akakce.com/autocomplete` uç noktalarını sorgulayan Model Context Protocol (MCP) sunucusu ve web arayüzü.

## Özellikler
- **`akakce_search`**: Akakçe.com canlı ürün araması (`popularity`, `lowest_price` / `s=2`, `highest_price` / `s=4`, kategori yönlendirmeli `,sayfa,sıra.html` desteği, `25/50/100` sayfalama ve `fetchAll` ile tüm sayfaları tarama).
- **`akakce_get_product_offers`**: Seçilen ürünün tüm mağaza tekliflerini (`n11`, `Hepsiburada`, `Trendyol`, `Amazon`, `İdefix`, `PttAVM` vb.), kargo ve stok durumunu, varyantlarını ve teknik özelliklerini çeker *(en hızlı sonuç için doğrudan `akakceUrl` parametresi kullanmanız önerilir; soğuk oturumda sayısal `productId` de desteklenir)*.
- **`akakce_get_price_history`**: Resmi Akakçe fiyat geçmişi tablosunu çıkarır *(doğrudan `akakceUrl` önerilir)*.
- **`akakce_autocomplete`**: `api6.akakce.com/autocomplete` üzerinden anlık öneriler döndürür.
- **`akakce_compare_product_prices`**: Arama sonuçlarındaki ilk N ürünün satıcı tekliflerini paralel karşılaştırır.

---

## Debian / Linux Kurulumu

```bash
git clone https://github.com/sdt-cloud/akakce-mcp.git
cd akakce-mcp
npm install
```

### 1. Antigravity & Antigravity CLI (`stdio`)
`~/.gemini/antigravity/mcp_config.json` dosyasına ekleyin:

```json
{
  "mcpServers": {
    "akakce-mcp": {
      "command": "npx",
      "args": ["tsx", "/home/KULLANICI_ADIN/akakce-mcp/src/stdio.ts"]
    }
  }
}
```

### 2. Claude Code CLI
```bash
claude mcp add akakce-mcp -- npx tsx "$PWD/src/stdio.ts"
```

### 3. Web Arayüzü + HTTP MCP (`POST /mcp`)
```bash
npm run dev
# Web arayüzü: http://localhost:3000
# MCP HTTP ucu: http://localhost:3000/mcp
```

---

## Yasal Uyarı ve Sorumluluk Reddi (Legal Disclaimer)

- **Resmi Olmayan Proje / Marka Bildirimi**: Bu proje bağımsız ve açık kaynaklı bir Model Context Protocol (MCP) entegrasyon örneğidir. **Akakçe.com** veya bağlı kuruluşları ile hiçbir resmi bağı, ortaklığı, sponsorluğu veya onayı bulunmamaktadır. "Akakçe" adı ve markası ilgili hak sahibine aittir; burada yalnızca hedeflenen kamuya açık web arayüzünü tanımlamak amacıyla kullanılmıştır.
- **Yalnızca Eğitim, Araştırma ve Kişisel Kullanım**: Bu yazılım yalnızca kişisel fiyat takibi, geliştirici eğitimi ve teknik MCP protokolü araştırması amacıyla sunulmuştur. Ticari veri toplama, fiyat verilerinin yeniden satışı veya üçüncü taraf platformların altyapısına aşırı yük bindirecek (yüksek frekanslı / otomatik bot) kullanımlar amaçlanmamıştır.
- **Hedef Site Kullanım Koşullarına Uyum**: Bu aracı çalıştıran her kullanıcı; hedef web sitesinin kullanım koşullarına (Terms of Service), `robots.txt` kurallarına, hız sınırlarına (rate limiting) ve yürürlükteki yerel/uluslararası mevzuata uymakla kendisi yükümlüdür.
- **Sorumluluk Reddi ("OLDUĞU GİBİ" / "AS IS")**: Yazılım [MIT Lisansı](./LICENSE) kapsamında **"OLDUĞU GİBİ"** ve hiçbir açık ya da zımni garanti verilmeksizin sunulmaktadır. Bu yazılımın kullanımından, yanlış/eksik fiyat bilgisinden, IP/erişim kısıtlamalarından veya üçüncü taraf kullanım koşullarının ihlalinden doğabilecek hiçbir doğrudan veya dolaylı zarardan proje geliştiricileri veya katkıda bulunanlar sorumlu tutulamaz. Tüm risk ve sorumluluk aracı kullanan son kullanıcıya aittir.

> **English Notice**: This is an unofficial, independent open-source MCP project provided **strictly for educational, research, and personal use** under the [MIT License](./LICENSE) **"AS IS" without warranty of any kind**. It is not affiliated with, endorsed by, or connected to Akakçe. Users are solely responsible for complying with the target website's Terms of Service, rate limits, and applicable laws. The authors assume no liability for any misuse or damages arising from using this software.

