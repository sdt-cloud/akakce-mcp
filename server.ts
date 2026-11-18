import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAktuelCacheSummary } from './src/mcp/aktuelClient.ts';
import {
  executeMcpTool,
  listMcpResources,
  listMcpTools,
  readMcpResource,
} from './src/mcp/tools.ts';
import type { JsonRpcRequest, JsonRpcResponse } from './src/mcp/types.ts';
import {
  BrochureVisionError,
  locateProductsInBrochure,
  type BrochureCandidateProduct,
} from './src/server/brochureVision.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SERVER_STARTED_AT = Date.now();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const cache = getAktuelCacheSummary();
    res.json({
      status: 'ok',
      service: 'Aktuel-MCP',
      targetSite: 'bim.com.tr · a101 · sokmarket.com.tr',
      protocolVersion: '2025-03-26',
      toolsRegistered: listMcpTools().length,
      resourcesRegistered: listMcpResources().length,
      marketsCache: cache.markets,
      uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/api/brochures/locate-products', async (req, res) => {
    const body = (req.body ?? {}) as {
      imageUrl?: string;
      pageImages?: string[];
      targetProductId?: string;
      targetProductTitle?: string;
      candidates?: BrochureCandidateProduct[];
    };

    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      res.status(400).json({ error: 'Geçerli bir broşür görsel URL adresi gerekli.' });
      return;
    }

    const pageImages = Array.isArray(body.pageImages)
      ? body.pageImages.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
      : undefined;

    try {
      const result = await locateProductsInBrochure({
        imageUrl,
        pageImages,
        targetProductId: typeof body.targetProductId === 'string' ? body.targetProductId : undefined,
        targetProductTitle:
          typeof body.targetProductTitle === 'string' ? body.targetProductTitle : undefined,
        candidates: Array.isArray(body.candidates) ? body.candidates : undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof BrochureVisionError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Broşür görseli analiz edilemedi.',
        code: 'GEMINI_API_ERROR',
      });
    }
  });

  app.get('/mcp', (_req, res) => {
    res.json({
      name: 'aktuel-mcp',
      version: '1.0.0',
      targetSite: 'bim.com.tr · a101 · sokmarket.com.tr',
      protocol: 'Model Context Protocol (JSON-RPC 2.0 over HTTP)',
      endpoint: '/mcp',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      tools: listMcpTools().map((t) => ({ name: t.name, description: t.description })),
    });
  });

  app.post('/mcp', async (req, res) => {
    const body = req.body as Partial<JsonRpcRequest> | undefined;

    if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
      const errResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: body?.id ?? null,
        error: {
          code: -32600,
          message: 'Geçersiz JSON-RPC 2.0 isteği. { jsonrpc: "2.0", id, method } bekleniyor.',
        },
      };
      res.status(400).json(errResp);
      return;
    }

    const id = body.id ?? null;
    const params = (body.params ?? {}) as Record<string, unknown>;

    try {
      if (body.method === 'initialize') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: {
              name: 'aktuel-mcp',
              version: '1.0.0',
            },
          },
        });
        return;
      }

      if (body.method === 'notifications/initialized' || body.method === 'ping') {
        res.json({ jsonrpc: '2.0', id, result: {} });
        return;
      }

      if (body.method === 'tools/list') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: listMcpTools(),
          },
        });
        return;
      }

      if (body.method === 'tools/call') {
        const toolName = typeof params.name === 'string' ? params.name : '';
        const toolArgs =
          params.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {};

        if (!toolName) {
          res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Eksik zorunlu parametre: params.name' },
          });
          return;
        }

        const result = await executeMcpTool(toolName, toolArgs);
        res.json({
          jsonrpc: '2.0',
          id,
          result,
        });
        return;
      }

      if (body.method === 'resources/list') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            resources: listMcpResources(),
          },
        });
        return;
      }

      if (body.method === 'resources/read') {
        const uri = typeof params.uri === 'string' ? params.uri : '';
        if (!uri) {
          res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Eksik zorunlu parametre: params.uri' },
          });
          return;
        }
        const resourceResult = await readMcpResource(uri);
        res.json({
          jsonrpc: '2.0',
          id,
          result: resourceResult,
        });
        return;
      }

      res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Yöntem bulunamadı: ${body.method}`,
        },
      });
    } catch (err) {
      res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Sunucu hatası',
        },
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aktuel-MCP server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Aktuel-MCP server:', err);
  process.exit(1);
});
