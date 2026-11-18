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
