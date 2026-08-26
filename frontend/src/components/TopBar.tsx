import React from 'react';
import {
  Search,
  RotateCw,
  Keyboard,
  Sun,
  Moon,
  CheckCheck,
  X,
  Command,
} from 'lucide-react';
import type { BucketType, AppViewMode } from '../types';
import { cn } from '../lib/utils';

interface TopBarProps {
  selectedBucket: BucketType;
  selectedRepo: string;
  selectedReason: string;
  onSelectReason: (reason: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSyncing: boolean;
  onSync: () => void;
  onMarkAllDone: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette?: () => void;
  currentTheme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  itemCount: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  currentView?: AppViewMode;
}

export const TopBar: React.FC<TopBarProps> = ({
  selectedBucket,
  selectedRepo,
  selectedReason,
  onSelectReason,
  searchQuery,
  onSearchChange,
  isSyncing,
  onSync,
  onMarkAllDone,
  onOpenShortcuts,
  onOpenCommandPalette,
  currentTheme,
  onToggleTheme,
  itemCount,
  searchInputRef,
  currentView = 'triage',
}) => {
  const getBucketDisplayName = (bucket: BucketType) => {
    switch (bucket) {
      case 'action_required':
        return 'Action Required';
      case 'waiting_on_others':
        return 'Waiting on Others';
      case 'mentions':
        return 'Mentions';
      case 'assigned':
        return 'Assigned to You';
      case 'participating':
        return 'Participating';
      case 'done':
        return 'Done / Archive';
      case 'snoozed':
        return 'Snoozed';
      default:
        return 'Notifications';
    }
  };

  const reasonFilters = [
    { id: '', label: 'All' },
    { id: 'review_requested', label: 'Reviews' },
    { id: 'mention', label: 'Mentions' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'author', label: 'Author' },
    { id: 'ci_activity', label: 'CI' },
  ];

  return (
    <header className="h-14 border-b border-github-border bg-github-dark/95 backdrop-blur px-5 flex items-center justify-between gap-3 select-none shrink-0">
      {/* Title & Count */}
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-sm font-semibold text-white tracking-tight truncate flex items-center gap-2">
          {currentView === 'git_assistant' ? (
            <span>Git Assistant</span>
          ) : (
            <>
              <span>{getBucketDisplayName(selectedBucket)}</span>
              {selectedRepo && (
                <span className="text-xs font-mono font-normal text-github-muted bg-github-darker px-2 py-0.5 rounded border border-github-border">
                  {selectedRepo}
                </span>
              )}
            </>
          )}
        </h1>
        {currentView === 'triage' && (
          <span className="text-xs font-mono text-github-muted bg-github-hover px-2 py-0.5 rounded-full">
            {itemCount}
          </span>
        )}
      </div>

      {/* Center: Command Palette Trigger & Search */}
      {currentView === 'triage' ? (
        <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-center">
          {/* Command Palette button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1 bg-github-darker hover:bg-github-hover border border-github-border rounded-lg text-xs text-github-muted hover:text-white transition-all shadow-sm shrink-0"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <Command className="w-3.5 h-3.5 text-github-accent" />
              <span className="hidden md:inline">Command Palette</span>
              <kbd className="text-[10px] font-mono bg-github-dark px-1.5 py-0.2 rounded border border-github-border text-github-muted">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Search input */}
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 text-github-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notifications... (/)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-github-darker border border-github-border rounded-lg pl-8 pr-7 py-1 text-xs text-github-text placeholder:text-github-muted focus:outline-none focus:border-github-accent focus:ring-1 focus:ring-github-accent transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-github-muted hover:text-github-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-github-muted bg-github-hover px-1 rounded border border-github-border pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Reason Filter Pills */}
          <div className="hidden xl:flex items-center gap-1 bg-github-darker p-0.5 rounded-lg border border-github-border">
            {reasonFilters.map((rf) => (
              <button
                key={rf.id}
                onClick={() => onSelectReason(rf.id)}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-md transition-all',
                  selectedReason === rf.id
                    ? 'bg-github-hover text-white shadow-sm font-semibold'
                    : 'text-github-muted hover:text-github-text'
                )}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex justify-center">
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1 bg-github-darker hover:bg-github-hover border border-github-border rounded-lg text-xs text-github-muted hover:text-white transition-all shadow-sm"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <Command className="w-3.5 h-3.5 text-github-accent" />
              <span>Command Palette</span>
              <kbd className="text-[10px] font-mono bg-github-dark px-1.5 py-0.2 rounded border border-github-border text-github-muted">
                ⌘K
              </kbd>
            </button>
          )}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Mark all as done */}
        {currentView === 'triage' && itemCount > 0 && selectedBucket !== 'done' && (
          <button
            onClick={onMarkAllDone}
            className="flex items-center gap-1.5 px-3 py-1 bg-github-hover hover:bg-github-border border border-github-border text-xs font-medium text-github-text hover:text-white rounded-lg transition-colors"
            title="Mark all items in this view as done"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Mark All Done</span>
          </button>
        )}

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 bg-github-hover hover:bg-github-border border border-github-border text-xs font-medium text-github-text hover:text-white rounded-lg transition-colors disabled:opacity-50"
          title="Refresh notifications (r)"
        >
          <RotateCw className={cn('w-3.5 h-3.5 text-github-accent', isSyncing && 'animate-spin')} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Keyboard shortcuts helper */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-github-muted hover:text-white hover:bg-github-hover border border-transparent hover:border-github-border rounded-lg transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-github-muted hover:text-white hover:bg-github-hover border border-transparent hover:border-github-border rounded-lg transition-colors"
          title="Toggle Theme"
        >
          {currentTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
