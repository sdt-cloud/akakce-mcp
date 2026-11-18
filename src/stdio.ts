import readline from 'node:readline';
import {
  executeMcpTool,
  listMcpResources,
  listMcpTools,
  readMcpResource,
} from './mcp/tools.ts';
import type { JsonRpcRequest, JsonRpcResponse } from './mcp/types.ts';

function writeResponse(res: JsonRpcResponse) {
  process.stdout.write(`${JSON.stringify(res)}\n`);
}

async function handleRequest(req: JsonRpcRequest) {
  const id = req.id ?? null;

  // Notifications have no id and expect no JSON-RPC response
  if (req.id === undefined || req.id === null) {
    return;
  }

  try {
    if (req.method === 'initialize') {
      const requestedVersion =
        typeof req.params?.protocolVersion === 'string'
          ? req.params.protocolVersion
          : '2025-03-26';

      writeResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: requestedVersion,
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

    if (req.method === 'ping') {
      writeResponse({ jsonrpc: '2.0', id, result: {} });
      return;
    }

    if (req.method === 'tools/list') {
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: { tools: listMcpTools() },
      });
      return;
    }

    if (req.method === 'tools/call') {
      const toolName = String(req.params?.name ?? '');
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await executeMcpTool(toolName, args);
      writeResponse({
        jsonrpc: '2.0',
        id,
        result,
      });
      return;
    }

    if (req.method === 'resources/list') {
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: { resources: listMcpResources() },
      });
      return;
    }

    if (req.method === 'resources/read') {
      const uri = String(req.params?.uri ?? '');
      const resourceResult = await readMcpResource(uri);
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: resourceResult,
      });
      return;
    }

    writeResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Desteklenmeyen MCP yöntemi: ${req.method}`,
      },
    });
  } catch (err) {
    writeResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : 'Aktüel MCP stdio sunucu hatası',
      },
    });
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let inFlightRequests = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && inFlightRequests === 0) {
    process.exit(0);
  }
}

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed) as JsonRpcRequest;
    inFlightRequests += 1;
    void handleRequest(req).finally(() => {
      inFlightRequests -= 1;
      maybeExit();
    });
  } catch {
    writeResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Geçersiz JSON-RPC satırı.' },
    });
  }
});

rl.on('close', () => {
  stdinClosed = true;
  maybeExit();
});

process.stdin.on('close', () => {
  stdinClosed = true;
  maybeExit();
});

console.error('Aktuel MCP stdio sunucusu dinliyor');
