'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Cpu,
  Eraser,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Moon,
  ScanSearch,
  ShieldCheck,
  Sun,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import RiskGauge from '@/components/RiskGauge';
import HistoryDrawer from '@/components/HistoryDrawer';
import { INPUT_LIMITS, LEVELS, SAFETY_TIPS } from '@/lib/scamRules';
import { EXAMPLES, LEVEL_STYLES, LOADING_STEPS, SEVERITY_LABELS, TABS } from '@/lib/uiConfig';

const TAB_ICONS = { message: MessageSquare, job: Briefcase, profile: UserRound };

/* ------------------------------ Small parts ------------------------------ */

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* storage may be blocked; the toggle still works for this visit */
    }
  }

  return (
    <button type="button" onClick={toggle} className="btn-ghost !px-2.5" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function EmptyResult() {
  return (
    <div className="card flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink/5">
        <ShieldCheck size={24} className="text-muted" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-semibold">Your result will appear here</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        We scan the text for known red flags first, then ask an AI model to look for subtler tricks like
        impersonation and pressure tactics.
      </p>
    </div>
  );
}

function LoadingResult({ step }) {
  return (
    <div className="card min-h-[320px] p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Loader2 size={22} className="animate-spin" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Checking now</h2>
      </div>
      <ol className="mt-6 space-y-3">
        {LOADING_STEPS.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 text-sm ${i <= step ? 'text-ink' : 'text-muted/60'}`}>
            {i < step ? (
              <CheckCircle2 size={18} className="text-safe" aria-hidden="true" />
            ) : i === step ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Circle size={18} aria-hidden="true" />
            )}
            {label}
          </li>
        ))}
      </ol>
      <div className="mt-8 space-y-3" aria-hidden="true">
        <div className="h-3 w-3/4 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-full animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
      </div>
    </div>
  );
}

function SeverityTag({ severity }) {
  const styles = {
    high: 'bg-danger/10 text-danger',
    medium: 'bg-warn/10 text-warn',
    low: 'bg-muted/15 text-muted',
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${styles[severity] || styles.low}`}>
      {SEVERITY_LABELS[severity] || 'Low'}
    </span>
  );
}

function EngineNote({ engine }) {
  if (!engine) return null;

  let text;
  if (engine.aiUsed) {
    text = `Rules scored ${engine.ruleScore}. AI (${engine.provider}) scored ${engine.aiScore}. Final score blends both.`;
  } else if (engine.aiEnabled) {
    text = `Rules scored ${engine.ruleScore}. The AI layer failed, so this result uses rules only.`;
  } else {
    text = `Rules scored ${engine.ruleScore}. The AI layer is off. Add AI_API_KEY to .env.local for deeper analysis.`;
  }

  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
      <Cpu size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {text}
        {engine.aiError ? <span className="mt-1 block text-warn">{engine.aiError.slice(0, 160)}</span> : null}
      </span>
    </p>
  );
}

function ResultPanel({ result }) {
  const style = LEVEL_STYLES[result.riskLevel] || LEVEL_STYLES.safe;
  const levelLabel = LEVELS[result.riskLevel]?.label || result.label;
  const [checked, setChecked] = useState({});

  useEffect(() => {
    setChecked({});
  }, [result]);

  const flags = result.flags || [];
  const tips = result.tips && result.tips.length ? result.tips : SAFETY_TIPS[result.riskLevel] || [];

  return (
    <div className="space-y-5">
      <section className={`card border ${style.border} p-6`}>
        <RiskGauge score={result.riskScore} levelLabel={levelLabel} levelClass={style.text} />
        <p className="mx-auto mt-5 max-w-md text-center text-sm leading-relaxed">
          {result.summary || LEVELS[result.riskLevel]?.summary}
        </p>
        {result.techniques && result.techniques.length ? (
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {result.techniques.map((t) => (
              <li key={t} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                {t}
              </li>
            ))}
          </ul>
        ) : null}
        {result.engine ? (
          <div className="mt-5 border-t border-line pt-4">
            <EngineNote engine={result.engine} />
          </div>
        ) : null}
      </section>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TriangleAlert size={18} className={style.text} aria-hidden="true" />
          Red flags found
          <span className="text-sm font-normal text-muted">({flags.length})</span>
        </h2>

        {flags.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Nothing matched our scam patterns. That does not prove the sender is genuine, so still verify them
            through the company&apos;s official website.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {flags.map((flag, i) => (
              <li key={`${flag.id}-${i}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityTag severity={flag.severity} />
                  <span className="text-sm font-semibold">{flag.label}</span>
                  <span className="text-xs text-muted">{flag.source === 'ai' ? 'Found by AI' : 'Found by rules'}</span>
                </div>
                {flag.explanation ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{flag.explanation}</p> : null}
                {flag.evidence ? (
                  <p className="mt-2 inline-block max-w-full break-words rounded-md bg-ink/5 px-2 py-1 font-mono text-xs">
                    {flag.evidence}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks size={18} aria-hidden="true" />
          What to do next
        </h2>
        <ul className="mt-4 space-y-1">
          {tips.map((tip, i) => {
            const done = Boolean(checked[i]);
            return (
              <li key={tip}>
                <button
                  type="button"
                  onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  aria-pressed={done}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink/5"
                >
                  {done ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-safe" aria-hidden="true" />
                  ) : (
                    <Circle size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span className={`text-sm leading-relaxed ${done ? 'text-muted line-through' : ''}`}>{tip}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {result.dbNote ? <p className="text-xs text-warn">{result.dbNote}</p> : null}
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function HomePage() {
  const [tab, setTab] = useState('message');
  const [texts, setTexts] = useState({ message: '', job: '', profile: '' });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dbDriver, setDbDriver] = useState('');
  const [dbNote, setDbNote] = useState('');
  const [saveText, setSaveText] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);

  const resultRef = useRef(null);

  const activeTab = TABS.find((t) => t.id === tab);
  const text = texts[tab];
  const tooShort = text.trim().length < INPUT_LIMITS.min;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history?limit=30', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setHistoryEnabled(data.enabled !== false);
        setRetentionDays(data.retentionDays || 30);
        setHistory(data.scans || []);
        setDbDriver(data.dbDriver || '');
        setDbNote(data.dbNote || '');
      }
    } catch {
      /* history is optional; ignore network errors */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function analyze() {
    setError('');
    setResult(null);
    setLoading(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1400);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputType: tab, text, saveText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again in a moment.');
      setResult(data);
      loadHistory();
      if (window.innerWidth < 1024) {
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  function setText(value) {
    setTexts((t) => ({ ...t, [tab]: value }));
  }

  function openFromHistory(item) {
    setTab(item.inputType);
    if (item.inputText) setTexts((t) => ({ ...t, [item.inputType]: item.inputText }));
    setError('');
    setResult({
      riskScore: item.riskScore,
      riskLevel: item.riskLevel,
      label: LEVELS[item.riskLevel]?.label,
      summary: null,
      flags: item.reasons || [],
      tips: null,
      engine: null,
      techniques: [],
    });
    setHistoryOpen(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function clearHistory() {
    if (!window.confirm('Delete all saved scans? This cannot be undone.')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
    } finally {
      loadHistory();
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-paper">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-bold">Scam Check</p>
              <p className="hidden text-xs text-muted sm:block">for LinkedIn messages, jobs and profiles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {historyEnabled ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setHistoryOpen(true);
                  loadHistory();
                }}
              >
                <History size={16} aria-hidden="true" />
                Recent scans
                {history.length > 0 ? <span className="rounded-full bg-ink/10 px-1.5 text-xs tabular-nums">{history.length}</span> : null}
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Check it before you reply.</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Paste a LinkedIn message, job post or profile. You get a risk score, the red flags behind it and a short
            list of what to do next.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Input column */}
          <section aria-label="Input">
            <div role="tablist" aria-label="What are you checking?" className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
              {TABS.map((t) => {
                const Icon = TAB_ICONS[t.id];
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTab(t.id);
                      setError('');
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="card p-4 sm:p-5">
              <label htmlFor="scan-input" className="mb-2 block text-sm font-semibold">
                {activeTab.fieldLabel}
              </label>
              <textarea
                id="scan-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={INPUT_LIMITS.max}
                rows={11}
                placeholder={activeTab.placeholder}
                className="w-full resize-y rounded-lg border border-line bg-paper/60 p-3 text-sm leading-relaxed placeholder:text-muted/70"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Try an example:</span>
                  <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => setText(EXAMPLES[tab].scam)}>
                    scam
                  </button>
                  <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => setText(EXAMPLES[tab].safe)}>
                    legitimate
                  </button>
                </div>
                <span className="tabular-nums">
                  {text.length.toLocaleString()} / {INPUT_LIMITS.max.toLocaleString()}
                </span>
              </div>

              {historyEnabled ? (
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveText}
                    onChange={(e) => setSaveText(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[rgb(var(--ink))]"
                  />
                  <span>
                    Keep the pasted text in my history
                    <span className="block text-xs text-muted">
                      Untick to save only the score and red flags. The text is then never stored.
                    </span>
                  </span>
                </label>
              ) : null}

              {error ? (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary" onClick={analyze} disabled={loading || tooShort}>
                  {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ScanSearch size={18} aria-hidden="true" />}
                  {loading ? 'Checking…' : 'Check for scam signs'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setText('');
                    setResult(null);
                    setError('');
                  }}
                  disabled={loading || (!text && !result)}
                >
                  <Eraser size={16} aria-hidden="true" />
                  Clear
                </button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {historyEnabled
                  ? `Your scan history is private to this browser (an anonymous cookie, no account) and is deleted automatically after ${retentionDays} days. Other visitors cannot see it. `
                  : 'Scans are not stored. '}
                Do not paste passwords or card numbers. The text is sent to an AI service for analysis. A score is a guide, not proof.
              </p>
            </div>
          </section>

          {/* Result column */}
          <section aria-label="Result" ref={resultRef} className="scroll-mt-6">
            {loading ? <LoadingResult step={step} /> : result ? <ResultPanel result={result} /> : <EmptyResult />}
          </section>
        </div>
      </main>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={history}
        loading={historyLoading}
        dbDriver={dbDriver}
        dbNote={dbNote}
        retentionDays={retentionDays}
        onSelect={openFromHistory}
        onClear={clearHistory}
      />
    </div>
  );
}
