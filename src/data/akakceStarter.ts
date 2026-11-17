export interface StarterFile {
  path: string;
  language: string;
  content: string;
}

export const AKAKCE_STARTER_FILES: StarterFile[] = [
  {
    path: 'README.md',
    language: 'markdown',
    content: `# Akakce MCP (GitHub + Antigravity + Claude)

Gerçek zamanlı olarak \`akakce.com\` ve \`api6.akakce.com/autocomplete\` uç noktalarını sorgulayan Model Context Protocol (MCP) sunucusu.

## 1. Kurulum
\`\`\`bash
git clone <repo-url>
cd akakce-mcp
npm install
\`\`\`

## 2. Antigravity & Antigravity CLI Ayarı
\`~/.gemini/antigravity/mcp_config.json\` dosyanıza (veya Antigravity -> MCP Servers -> Manage MCP Servers -> View raw config) ekleyin:

\`\`\`json
{
  "mcpServers": {
    "akakce-mcp": {
      "command": "npx",
      "args": ["tsx", "/TAM/YOL/akakce-mcp/src/stdio.ts"]
    }
  }
}
\`\`\`

> **Windows kullanıcıları** \`npx\` yerine \`"command": "cmd"\`, \`"args": ["/c", "npx", "tsx", "C:\\\\yol\\\\akakce-mcp\\\\src\\\\stdio.ts"]\` kullanabilir.

## 3. Claude Code CLI ile Tek Komut Kurulum
\`\`\`bash
claude mcp add akakce-mcp -- npx tsx /TAM/YOL/akakce-mcp/src/stdio.ts
\`\`\`

## 4. Claude Desktop Ayarı
\`claude_desktop_config.json\` içine ekleyin:
\`\`\`json
{
  "mcpServers": {
    "akakce-mcp": {
      "command": "npx",
      "args": ["tsx", "/TAM/YOL/akakce-mcp/src/stdio.ts"]
    }
  }
}
\`\`\`

## 5. HTTP Modu (Yerel Web UI + Uzak POST /mcp)
\`\`\`bash
npm run dev
# MCP HTTP: http://localhost:3000/mcp
# Claude CLI HTTP: claude mcp add --transport http akakce-mcp http://localhost:3000/mcp
\`\`\``,
  },
  {
    path: 'antigravity_mcp_config.json',
    language: 'json',
    content: `{
  "mcpServers": {
    "akakce-mcp": {
      "command": "npx",
      "args": ["tsx", "/TAM/YOL/akakce-mcp/src/stdio.ts"]
    }
  }
}`,
  },
  {
    path: 'claude_desktop_config.json',
    language: 'json',
    content: `{
  "mcpServers": {
    "akakce-mcp": {
      "command": "npx",
      "args": ["tsx", "/TAM/YOL/akakce-mcp/src/stdio.ts"]
    }
  }
}`,
  },
  {
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "akakce-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "mcp:stdio": "tsx src/stdio.ts",
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "node server.ts"
  },
  "dependencies": {
    "dotenv": "^17.2.3",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "tsx": "^4.21.0",
    "typescript": "^5.8.0"
  }
}`,
  },
];
