export interface StarterFile {
  path: string;
  language: string;
  content: string;
}

export const AKTUEL_STARTER_FILES: StarterFile[] = [
  {
    path: 'claude_desktop_config.json',
    language: 'json',
    content: `{
  "mcpServers": {
    "aktuel-mcp": {
      "command": "npx",
      "args": ["tsx", "/TAM/YOL/aktuel-mcp/src/stdio.ts"]
    }
  }
}`,
  },
  {
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "aktuel-mcp",
  "version": "1.0.0",
  "type": "module",
  "description": "BİM, A101 ve ŞOK haftalık aktüel ürünler MCP sunucusu",
  "scripts": {
    "dev": "tsx server.ts",
    "mcp:stdio": "tsx src/stdio.ts",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "dotenv": "^17.2.3",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "tsx": "^4.21.0",
    "typescript": "^5.8.0"
  }
}`,
  },
  {
    path: 'src/stdio.ts',
    language: 'typescript',
    content: `import readline from 'node:readline';
import {
  executeMcpTool,
  listMcpResources,
  listMcpTools,
  readMcpResource,
} from './mcp/tools.ts';

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const req = JSON.parse(trimmed);
  if (req.id === undefined || req.id === null) return;

  if (req.method === 'initialize') {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } },
        serverInfo: { name: 'aktuel-mcp', version: '1.0.0' },
      },
    }) + '\\n');
    return;
  }

  if (req.method === 'tools/list') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools: listMcpTools() } }) + '\\n');
    return;
  }

  if (req.method === 'tools/call') {
    const result = await executeMcpTool(req.params?.name, req.params?.arguments ?? {});
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\\n');
    return;
  }

  if (req.method === 'resources/list') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { resources: listMcpResources() } }) + '\\n');
    return;
  }

  if (req.method === 'resources/read') {
    const result = await readMcpResource(req.params?.uri);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\\n');
  }
});`,
  },
  {
    path: 'ornek-promptlar.md',
    language: 'markdown',
    content: `# Örnek Yapay Zeka İstemleri (Prompts)

1. "Bu hafta BİM ve A101'e gelen teknolojik ürünler neler, fiyatları ne kadar ve hangisi daha avantajlı?"
2. "Bu cuma BİM'de kaç TL'den televizyon veya küçük ev aleti var?"
3. "Şu ihtiyaç listemi BİM, A101 ve ŞOK aktüellerinde tara: televizyon, şarjlı matkap, tava, termos."
4. "A101 19 Kasım kataloğundaki Onvo QLED TV gerçekten ucuz mu, Akakçe piyasa fiyatıyla kıyasla?"
5. "Yarın veya bu hafta sonu hangi markete yeni aktüel katalog geliyor?"`,
  },
];
