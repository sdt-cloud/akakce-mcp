import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import type { JsonRpcResponse, McpToolDefinition } from '../mcp/types';

interface McpPlaygroundViewProps {
  language: Language;
  tools: McpToolDefinition[];
  selectedToolName: string;
  onSelectToolName: (name: string) => void;
}

type RpcMethod = 'tools/call' | 'tools/list' | 'resources/list' | 'resources/read';

const DEFAULT_ARGS: Record<string, Record<string, unknown>> = {
  aktuel_bu_hafta: {
    market: 'hepsi',
    onlyActiveOrUpcoming: true,
    limitPerMarket: 25,
    forceRefresh: false,
  },
  aktuel_urun_ara: {
    query: 'TV',
    market: 'hepsi',
    sortBy: 'lowest_price',
    timing: 'hepsi',
    limit: 25,
  },
  aktuel_kategori: {
    kategori: 'elektronik',
    market: 'hepsi',
    sortBy: 'lowest_price',
    limit: 30,
  },
  aktuel_takvim: {
    market: 'hepsi',
    gun: 'hepsi',
    durum: 'hepsi',
  },
  aktuel_liste_tara: {
    items: ['televizyon', 'matkap', 'tava'],
    market: 'hepsi',
  },
  aktuel_brosurler: {
    market: 'hepsi',
    forceRefresh: false,
  },
  aktuel_piyasa_karsilastir: {
    query: 'Onvo QLED TV',
    market: 'a101',
  },
};

export function McpPlaygroundView({
  language,
  tools,
  selectedToolName,
  onSelectToolName,
}: McpPlaygroundViewProps) {
  const t = TRANSLATIONS[language].playground;
  const toolStrings = TRANSLATIONS[language].tools;

  const [rpcMethod, setRpcMethod] = useState<RpcMethod>('tools/call');
  const [argsByTool, setArgsByTool] = useState<Record<string, Record<string, unknown>>>(DEFAULT_ARGS);
  const [resourceUri, setResourceUri] = useState('mcp://aktuel/server/info');
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonDraft, setRawJsonDraft] = useState(
    JSON.stringify(DEFAULT_ARGS.aktuel_bu_hafta, null, 2),
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<Record<string, unknown> | null>(null);
  const [lastResponse, setLastResponse] = useState<JsonRpcResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const activeTool = useMemo(
    () => tools.find((tool) => tool.name === selectedToolName) ?? tools[0],
    [tools, selectedToolName],
  );

  const currentArgs = argsByTool[selectedToolName] ?? {};

  useEffect(() => {
    setRawJsonDraft(JSON.stringify(argsByTool[selectedToolName] ?? {}, null, 2));
  }, [selectedToolName, argsByTool]);

  const runRpc = useCallback(
    async (overrideMethod?: RpcMethod, overrideTool?: string, overrideArgs?: Record<string, unknown>) => {
      const methodToRun = overrideMethod ?? rpcMethod;
      const toolToRun = overrideTool ?? selectedToolName;

      let params: Record<string, unknown> = {};
      if (methodToRun === 'tools/call') {
        let parsedArgs = overrideArgs ?? argsByTool[toolToRun] ?? {};
        if (!overrideArgs && rawJsonMode) {
          try {
            parsedArgs = JSON.parse(rawJsonDraft);
          } catch {
            setErrorMsg(t.invalidJsonError);
            return;
          }
        }
        params = { name: toolToRun, arguments: parsedArgs };
      } else if (methodToRun === 'resources/read') {
        params = { uri: resourceUri };
      }

      const payload = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: methodToRun,
        params,
      };

      setIsLoading(true);
      setErrorMsg(null);
      setLastRequest(payload);
      const t0 = performance.now();

      try {
        const res = await fetch('/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as JsonRpcResponse;
        setLatencyMs(Math.round(performance.now() - t0));
        setLastResponse(data);
        if (data.error) {
          setErrorMsg(data.error.message);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t.reachError);
      } finally {
        setIsLoading(false);
      }
    },
    [rpcMethod, selectedToolName, argsByTool, rawJsonMode, rawJsonDraft, resourceUri, t.invalidJsonError, t.reachError],
  );

  useEffect(() => {
    void runRpc('tools/call', selectedToolName, argsByTool[selectedToolName]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToolName]);

  const updateArg = (key: string, value: unknown) => {
    setArgsByTool((prev) => ({
      ...prev,
      [selectedToolName]: {
        ...(prev[selectedToolName] ?? {}),
        [key]: value,
      },
    }));
  };

  const handleCopy = async () => {
    if (!lastResponse) return;
    await navigator.clipboard.writeText(JSON.stringify(lastResponse, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 border-b border-slate-200 pb-5">
        <p className="font-mono text-xs font-medium text-blue-700">{t.kicker}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{t.title}</h1>
        <p className="max-w-3xl text-sm text-slate-600">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4 space-y-5 rounded-xl border border-slate-200 bg-white p-5 self-start">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">{t.rpcMethodLabel}</label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {(['tools/call', 'tools/list', 'resources/list', 'resources/read'] as RpcMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRpcMethod(m)}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                    rpcMethod === m
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {rpcMethod === 'tools/call' && activeTool && (
            <>
              <div className="space-y-2">
                <label htmlFor="aktuel-tool-select" className="block text-xs font-semibold text-slate-700">
                  {t.targetToolLabel}
                </label>
                <select
                  id="aktuel-tool-select"
                  value={selectedToolName}
                  onChange={(e) => onSelectToolName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {tools.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-slate-500">
                  {toolStrings[activeTool.name]?.description ?? activeTool.description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-xs font-semibold text-slate-700">{t.argumentsLabel}</span>
                <button
                  type="button"
                  onClick={() => setRawJsonMode((v) => !v)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
                >
                  {rawJsonMode ? t.useFormInputs : t.editRawJson}
                </button>
              </div>

              {rawJsonMode ? (
                <textarea
                  value={rawJsonDraft}
                  onChange={(e) => setRawJsonDraft(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100 focus:border-blue-600 focus:outline-none"
                />
              ) : (
                <div className="space-y-3">
                  {Object.entries(activeTool.inputSchema.properties).map(([propName, schema]) => {
                    const value = currentArgs[propName];
                    const isRequired = activeTool.inputSchema.required?.includes(propName);

                    if (schema.enum) {
                      return (
                        <div key={propName} className="space-y-1">
                          <label className="block text-xs font-medium text-slate-700">
                            <span className="font-mono">{propName}</span>
                            {isRequired ? ' *' : ''}
                          </label>
                          <select
                            value={String(value ?? schema.default ?? schema.enum[0])}
                            onChange={(e) => updateArg(propName, e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          >
                            {schema.enum.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (schema.type === 'array') {
                      const arrVal = Array.isArray(value) ? value.join(', ') : String(value ?? '');
                      return (
                        <div key={propName} className="space-y-1">
                          <label className="block text-xs font-medium text-slate-700">
                            <span className="font-mono">{propName}</span>
                            {isRequired ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            value={arrVal}
                            placeholder="televizyon, matkap, tava"
                            onChange={(e) =>
                              updateArg(
                                propName,
                                e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                      );
                    }

                    if (schema.type === 'boolean') {
                      return (
                        <label
                          key={propName}
                          className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => updateArg(propName, e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="space-y-0.5">
                            <span className="block font-mono text-xs font-medium text-slate-800">
                              {propName}
                            </span>
                            <span className="block text-xs text-slate-500">{schema.description}</span>
                          </div>
                        </label>
                      );
                    }

                    if (schema.type === 'number') {
                      return (
                        <div key={propName} className="space-y-1">
                          <label className="block text-xs font-medium text-slate-700">
                            <span className="font-mono">{propName}</span>
                          </label>
                          <input
                            type="number"
                            value={value === undefined ? '' : String(value)}
                            onChange={(e) =>
                              updateArg(propName, e.target.value === '' ? undefined : Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={propName} className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700">
                          <span className="font-mono">{propName}</span>
                          {isRequired ? ' *' : ''}
                        </label>
                        <input
                          type="text"
                          value={String(value ?? '')}
                          placeholder={schema.description}
                          onChange={(e) => updateArg(propName, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {rpcMethod === 'resources/read' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">{t.resourceUriLabel}</label>
              <select
                value={resourceUri}
                onChange={(e) => setResourceUri(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
              >
                <option value="mcp://aktuel/server/info">mcp://aktuel/server/info</option>
                <option value="mcp://aktuel/takvim/bu-hafta">mcp://aktuel/takvim/bu-hafta</option>
                <option value="mcp://aktuel/marketler/durum">mcp://aktuel/marketler/durum</option>
              </select>
            </div>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void runRpc()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{isLoading ? t.executingButton : t.executeButton}</span>
          </button>
        </div>

        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="font-mono text-xs font-semibold text-slate-700">
              {t.responseHeader}
            </span>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {latencyMs !== null && (
                <span className="font-mono tabular-nums">
                  {t.roundTrip}: {latencyMs} ms
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!lastResponse}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? t.copied : t.copyJson}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <div className="border-b border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300">
              {t.requestHeader}
            </div>
            <pre className="max-h-48 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {JSON.stringify(lastRequest, null, 2)}
            </pre>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <div className="border-b border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300">
              {t.responseHeader}
            </div>
            <pre className="max-h-[460px] overflow-auto p-4 font-mono text-xs leading-relaxed text-emerald-300">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
