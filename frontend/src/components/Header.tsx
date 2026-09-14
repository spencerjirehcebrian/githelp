/**
 * The one line of chrome above the brief.
 *
 * It answers two questions and nothing else: which repo, and how old is
 * this. Controls are text, not icons, because there are only three of them
 * and a label is unambiguous.
 *
 * There is deliberately no count of how much is blocking somebody. That is
 * urgency framing, and the lane it would count is already the first thing
 * under the header.
 */

import { memo } from 'react';
import type { Brief } from '../types/brief';

export interface HeaderProps {
  brief: Brief | null;
  isRefreshing: boolean;
  /** Number of items surviving the filter, when a filter is active. */
  filteredCount: number | null;
  onRefresh: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

/**
 * Renders a timestamp as elapsed time.
 *
 * The absolute time is never the question. "4m ago" answers "can I trust
 * this" in one glance; "14:32" requires arithmetic.
 */
export function formatAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'unknown';

  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 45) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function Header({
  brief,
  isRefreshing,
  filteredCount,
  onRefresh,
  onExport,
  onOpenSettings,
}: HeaderProps) {
  const counts = brief?.counts;

  return (
    <header className="mb-8 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-title font-semibold tracking-tight text-text">
          {brief?.repo ?? 'Brief'}
        </h1>

        <p className="mt-1 text-meta text-faint tabular">
          {brief ? (
            <>
              <span aria-live="polite">
                {isRefreshing ? 'Refreshing' : `Generated ${formatAge(brief.generated_at)}`}
              </span>
              {counts && (
                <>
                  <Separator />
                  {counts.total} {counts.total === 1 ? 'item' : 'items'}
                </>
              )}
              {filteredCount !== null && (
                <>
                  <Separator />
                  {filteredCount} matching
                </>
              )}
            </>
          ) : (
            'Loading'
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <HeaderButton onClick={onExport} hint="y">
          Export
        </HeaderButton>
        <HeaderButton onClick={onRefresh} disabled={isRefreshing} hint="r">
          Refresh
        </HeaderButton>
        <HeaderButton onClick={onOpenSettings} hint="" label="Settings">
          Settings
        </HeaderButton>
      </div>
    </header>
  );
}

function Separator() {
  return <span className="px-1.5 text-line">/</span>;
}

interface HeaderButtonProps {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  /** Keyboard shortcut shown beside the label, if it has one. */
  hint?: string;
  label?: string;
}

function HeaderButton({ children, onClick, disabled, hint, label }: HeaderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ?? children}
      className="rounded px-2 py-1 text-meta text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
    >
      {children}
      {hint && <span className="ml-1.5 font-mono text-faint">{hint}</span>}
    </button>
  );
}

export default memo(Header);
