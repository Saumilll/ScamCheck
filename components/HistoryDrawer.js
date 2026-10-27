'use client';

import { useEffect } from 'react';
import { Briefcase, MessageSquare, Trash2, UserRound, X } from 'lucide-react';
import { LEVELS } from '@/lib/scamRules';
import { LEVEL_STYLES } from '@/lib/uiConfig';

const TYPE_ICONS = { message: MessageSquare, job: Briefcase, profile: UserRound };
const TYPE_NAMES = { message: 'Message', job: 'Job post', profile: 'Profile' };

function timeAgo(iso) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryDrawer({ open, onClose, items, loading, dbDriver, dbNote, retentionDays, onSelect, onClear }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Recent scans">
      <button
        type="button"
        aria-label="Close recent scans"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <aside className="drawer-in absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Recent scans</h2>
            <p className="text-xs text-muted">
              {`Only you can see these (this browser). Deleted after ${retentionDays || 30} days.`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !px-2" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {dbNote ? <p className="border-b border-line bg-warn/10 px-5 py-2 text-xs text-warn">{dbNote}</p> : null}

        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="p-5 text-sm text-muted">Loading your scans…</p>
          ) : items.length === 0 ? (
            <p className="p-5 text-sm text-muted">No scans yet. Your checks will appear here, visible only to you.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const Icon = TYPE_ICONS[item.inputType] || MessageSquare;
                const style = LEVEL_STYLES[item.riskLevel] || LEVEL_STYLES.safe;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-ink/5"
                    >
                      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold tabular-nums ${style.soft} ${style.text}`}>
                        {item.riskScore}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Icon size={14} className="text-muted" aria-hidden="true" />
                          {TYPE_NAMES[item.inputType] || item.inputType}
                          <span className={`text-xs font-medium ${style.text}`}>{LEVELS[item.riskLevel]?.label}</span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted">{item.inputText || 'Text not saved (score and red flags only)'}</span>
                        <span className="mt-1 block text-xs text-muted">{timeAgo(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <footer className="border-t border-line p-4">
            <button type="button" onClick={onClear} className="btn-ghost w-full text-danger">
              <Trash2 size={16} aria-hidden="true" />
              Delete my scans
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
