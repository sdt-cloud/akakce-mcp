import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { McpToolDefinition } from '../mcp/types';
import type { WorkspaceTab } from './TopBar';

interface SidebarProps {
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  tools: McpToolDefinition[];
  selectedToolName: string;
  onSelectToolForPlayground: (name: string) => void;
}

export function Sidebar({
  language,
  onSelectLanguage,
  activeTab,
  onSelectTab,
  tools,
  selectedToolName,
  onSelectToolForPlayground,
}: SidebarProps) {
  const t = TRANSLATIONS[language].sidebar;
  const toolStrings = TRANSLATIONS[language].tools;

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'catalog', label: t.sections.catalog },
    { id: 'brochures', label: t.sections.brochures },
    { id: 'playground', label: t.sections.playground },
    { id: 'setup', label: t.sections.setup },
  ];

  return (
    <aside className="w-full lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
      <div className="p-4 sm:p-5 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">{t.languageLabel}</div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(['tr', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onSelectLanguage(lang)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  language === lang
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'tr' ? 'Türkçe' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">{t.sectionsLabel}</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5 space-y-2">
          <div className="text-xs font-semibold text-slate-500">{t.toolsLabel}</div>
          <div className="space-y-1">
            {tools.map((tool) => {
              const isSelected = activeTab === 'playground' && selectedToolName === tool.name;
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => onSelectToolForPlayground(tool.name)}
                  className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold truncate">{tool.name}</span>
                  <span
                    className={`text-xs truncate ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {toolStrings[tool.name]?.title ?? tool.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-2">
            <span>{t.endpoint}</span>
            <span className="font-mono text-slate-800">POST /mcp</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>{t.targetSite}</span>
            <span className="font-mono text-slate-800">BİM · A101 · ŞOK</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>{t.currency}</span>
            <span className="font-mono text-slate-800">{t.currencyValue}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
