import { useMemo, useState } from 'react';
import { ApiHealthBar } from './components/ApiHealthBar';
import { BrochuresView } from './components/BrochuresView';
import { CatalogExplorerView } from './components/CatalogExplorerView';
import { McpPlaygroundView } from './components/McpPlaygroundView';
import { SetupCodeView } from './components/SetupCodeView';
import { Sidebar } from './components/Sidebar';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { type Language } from './i18n/translations';
import { AKTUEL_MCP_TOOLS } from './mcp/definitions';

export default function App() {
  const [language, setLanguage] = useState<Language>('tr');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('catalog');
  const [selectedToolName, setSelectedToolName] = useState<string>('aktuel_bu_hafta');
  const [copiedConfig, setCopiedConfig] = useState(false);

  const tools = useMemo(() => AKTUEL_MCP_TOOLS, []);

  const handleCopyConfig = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const config = JSON.stringify(
      {
        mcpServers: {
          'aktuel-mcp': {
            url: `${origin}/mcp`,
          },
        },
      },
      null,
      2,
    );
    await navigator.clipboard.writeText(config);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        language={language}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onCopyConfig={() => void handleCopyConfig()}
        copiedConfig={copiedConfig}
      />

      <ApiHealthBar language={language} />

      <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
        <Sidebar
          language={language}
          onSelectLanguage={setLanguage}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          tools={tools}
          selectedToolName={selectedToolName}
          onSelectToolForPlayground={(name) => {
            setSelectedToolName(name);
            setActiveTab('playground');
          }}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {activeTab === 'catalog' && <CatalogExplorerView language={language} />}
          {activeTab === 'brochures' && <BrochuresView language={language} />}
          {activeTab === 'playground' && (
            <McpPlaygroundView
              language={language}
              tools={tools}
              selectedToolName={selectedToolName}
              onSelectToolName={setSelectedToolName}
            />
          )}
          {activeTab === 'setup' && <SetupCodeView language={language} />}
        </main>
      </div>
    </div>
  );
}
