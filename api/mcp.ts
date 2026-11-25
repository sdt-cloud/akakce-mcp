import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeMcpTool, listMcpResources, listMcpTools, readMcpResource } from '../src/mcp/tools.ts';

const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];

function send(res: ServerResponse, status: number, data: object) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.headers.origin) {
    const expectedOrigin = `https://${req.headers.host}`;
    if (req.headers.origin !== expectedOrigin) {
      send(res, 403, { error: 'Origin not allowed' });
      return;
    }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.writeHead(405).end();
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }

  const id = body?.id ?? null;
  const reply = (result: object) => send(res, 200, { jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string, status = 200) =>
    send(res, status, { jsonrpc: '2.0', id, error: { code, message } });

  if (body?.jsonrpc !== '2.0' || typeof body.method !== 'string' ||
      (id !== null && typeof id !== 'string' && typeof id !== 'number')) {
    fail(-32600, 'Invalid Request', 400);
    return;
  }

  const protocol = req.headers['mcp-protocol-version'];
  if (protocol && (typeof protocol !== 'string' || !versions.includes(protocol))) {
    fail(-32600, 'Unsupported MCP protocol version', 400);
    return;
  }

  if (id === null) {
    res.writeHead(202).end();
    return;
  }

  const params = body.params ?? {};
  try {
    switch (body.method) {
      case 'initialize':
        reply({
          protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0],
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'akakce-mcp', version: '1.0.0' },
        });
        return;
      case 'ping':
        reply({});
        return;
      case 'tools/list':
        reply({ tools: listMcpTools() });
        return;
      case 'tools/call': {
        if (typeof params.name !== 'string') {
          fail(-32602, 'Tool name is required');
          return;
        }
        reply(await executeMcpTool(params.name, params.arguments ?? {}));
        return;
      }
      case 'resources/list':
        reply({ resources: listMcpResources() });
        return;
      case 'resources/read':
        if (typeof params.uri !== 'string') {
          fail(-32602, 'Resource URI is required');
          return;
        }
        reply(readMcpResource(params.uri));
        return;
      default:
        fail(-32601, 'Method not found');
    }
  } catch {
    fail(-32603, 'Internal error');
  }
}
