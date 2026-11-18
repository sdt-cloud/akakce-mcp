import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface ApiHealthData {
  status: string;
  service: string;
  targetSite: string;
  protocolVersion: string;
  toolsRegistered: number;
  resourcesRegistered: number;
  uptimeSeconds: number;
  checkedAt: string;
}

interface ApiHealthBarProps {
  language: Language;
}

export function ApiHealthBar({ language }: ApiHealthBarProps) {
  const t = TRANSLATIONS[language].apiHealth;
  const [state, setState] = useState<'checking' | 'healthy' | 'degraded'>('checking');
  const [health, setHealth] = useState<ApiHealthData | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [mcpOk, setMcpOk] = useState<boolean | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setState('checking');
    setErrorNote(null);
    const t0 = performance.now();

    try {
      const [healthRes, mcpRes] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'health', method: 'ping' }),
        }),
      ]);

      const elapsed = Math.round(performance.now() - t0);
      setLatencyMs(elapsed);

      if (!healthRes.ok) {
        throw new Error(`HTTP ${healthRes.status}`);
      }

      const healthJson = (await healthRes.json()) as ApiHealthData;
      const mcpJson = (await mcpRes.json()) as { result?: Record<string, unknown>; error?: unknown };
      const isMcpHealthy = mcpRes.ok && Boolean(mcpJson.result) && !mcpJson.error;

      setHealth(healthJson);
      setMcpOk(isMcpHealthy);
      setState(healthJson.status === 'ok' && isMcpHealthy ? 'healthy' : 'degraded');
    } catch (err) {
      setLatencyMs(Math.round(performance.now() - t0));
      setMcpOk(false);
      setState('degraded');
      setErrorNote(err instanceof Error ? err.message : t.unreachable);
    }
  }, [t.unreachable]);

  useEffect(() => {
    void checkHealth();
    const timer = setInterval(() => {
      void checkHealth();
    }, 30000);
    return () => clearInterval(timer);
  }, [checkHealth]);

  const statusTone =
    state === 'healthy'
      ? 'text-emerald-700'
      : state === 'degraded'
        ? 'text-red-700'
        : 'text-amber-700';

  const statusText =
    state === 'healthy' ? t.healthy : state === 'degraded' ? t.degraded : t.checking;

  const formattedCheckedTime = health?.checkedAt
    ? new Date(health.checkedAt).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="border-b border-slate-200 bg-slate-100/70">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 text-xs sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
          <span className={`font-semibold ${statusTone}`}>{statusText}</span>

          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>

          <span className="font-mono text-slate-700">
            {t.targetLabel}: BİM · A101 · ŞOK
          </span>

          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>

          <span className="font-mono tabular-nums">
            {t.healthEndpoint}: {state === 'healthy' ? '200 OK' : state === 'checking' ? '…' : errorNote ?? 'ERR'}
          </span>

          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>

          <span className="font-mono tabular-nums">
            {t.mcpEndpoint}: {mcpOk === true ? '200 OK' : mcpOk === false ? 'ERR' : '…'}
          </span>

          <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
            ·
          </span>

          <span className="hidden sm:inline font-mono tabular-nums">
            {health?.toolsRegistered ?? 7} {t.toolsUnit} · {health?.resourcesRegistered ?? 3} {t.resourcesUnit}
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          {latencyMs !== null && (
            <span className="font-mono tabular-nums">{latencyMs} ms</span>
          )}
          <span className="hidden md:inline font-mono tabular-nums">
            {t.uptimeLabel}: {health?.uptimeSeconds ?? 0}s
          </span>
          <span className="hidden lg:inline font-mono tabular-nums">
            {t.checkedLabel}: {formattedCheckedTime}
          </span>
          <button
            type="button"
            onClick={() => void checkHealth()}
            disabled={state === 'checking'}
            className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <RefreshCw
              className={`h-3 w-3 ${state === 'checking' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{t.checkNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
