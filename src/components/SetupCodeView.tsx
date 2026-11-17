import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { AKAKCE_STARTER_FILES } from '../data/akakceStarter';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface SetupCodeViewProps {
  language: Language;
}

export function SetupCodeView({ language }: SetupCodeViewProps) {
  const t = TRANSLATIONS[language].setup;
  const [selectedPath, setSelectedPath] = useState(AKAKCE_STARTER_FILES[0].path);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const httpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'akakce-mcp': {
          url: `${origin}/mcp`,
        },
      },
    },
    null,
    2,
  );

  const activeFile =
    AKAKCE_STARTER_FILES.find((f) => f.path === selectedPath) ?? AKAKCE_STARTER_FILES[0];

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownload = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1.5 border-b border-slate-200 pb-5">
        <p className="font-mono text-xs font-medium text-blue-700">{t.kicker}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{t.title}</h1>
        <p className="max-w-3xl text-sm text-slate-600">{t.subtitle}</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t.httpConfigTitle}</h2>
          <p className="text-sm text-slate-600">{t.httpConfigDesc}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <span className="font-mono text-xs text-slate-300">mcp-http-config.json</span>
            <button
              type="button"
              onClick={() => void handleCopy('http', httpConfigSnippet)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white"
            >
              {copiedId === 'http' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedId === 'http' ? t.copied : t.copy}</span>
            </button>
          </div>
          <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed text-emerald-300">
            {httpConfigSnippet}
          </pre>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t.stdioTitle}</h2>
          <p className="text-sm text-slate-600">{t.stdioDesc}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-2">
            <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
              {AKAKCE_STARTER_FILES.map((file) => {
                const isSelected = file.path === selectedPath;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-xs transition-colors ${
                      isSelected
                        ? 'bg-slate-900 font-semibold text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{file.path}</span>
                    <span className={isSelected ? 'text-slate-400' : 'text-slate-400'}>
                      {file.language}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700">{t.quickCommandsLabel}</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
                {`npm install\nnpm run mcp:stdio\n\n# Claude Code CLI:\nclaude mcp add akakce-mcp -- npx tsx $(pwd)/src/stdio.ts`}
              </pre>
            </div>
          </div>

          <div className="lg:col-span-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
              <span className="font-mono text-xs font-semibold text-slate-200">{activeFile.path}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload(activeFile.path, activeFile.content)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.download}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(activeFile.path, activeFile.content)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
                >
                  {copiedId === activeFile.path ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedId === activeFile.path ? t.copied : t.copy}</span>
                </button>
              </div>
            </div>
            <pre className="max-h-[520px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
              {activeFile.content}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
