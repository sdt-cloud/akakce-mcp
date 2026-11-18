import { Check, Copy } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export type WorkspaceTab = 'catalog' | 'brochures' | 'playground' | 'setup';

interface TopBarProps {
  language: Language;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onCopyConfig: () => void;
  copiedConfig: boolean;
}

export function TopBar({
  language,
  activeTab,
  onSelectTab,
  onCopyConfig,
  copiedConfig,
}: TopBarProps) {
  const t = TRANSLATIONS[language].topBar;

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'catalog', label: t.nav.catalog },
    { id: 'brochures', label: t.nav.brochures },
    { id: 'playground', label: t.nav.playground },
    { id: 'setup', label: t.nav.setup },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          {t.brand}
        </button>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'border-blue-600 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onCopyConfig}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {copiedConfig ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copiedConfig ? t.copiedConfig : t.copyConfig}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
