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
    <header className="h-12 border-b border-github-border bg-black/90 backdrop-blur px-4 flex items-center justify-between gap-3 select-none shrink-0 text-github-text">
      {/* Title & Count */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-xs font-semibold text-white tracking-tight truncate flex items-center gap-2">
          {currentView === 'git_assistant' ? (
            <span>Git Assistant</span>
          ) : (
            <>
              <span>{getBucketDisplayName(selectedBucket)}</span>
              {selectedRepo && (
                <span className="text-[10px] font-mono font-normal text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                  {selectedRepo}
                </span>
              )}
            </>
          )}
        </h1>
        {currentView === 'triage' && (
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800/80 px-1.5 py-0.2 rounded tabular-nums">
            {itemCount}
          </span>
        )}
      </div>

      {/* Center: Command Palette Trigger & Search */}
      {currentView === 'triage' ? (
        <div className="flex items-center gap-2 flex-1 max-w-xl justify-center">
          {/* Command Palette button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              aria-label="Command Palette"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <Command className="w-3 h-3 text-zinc-400" />
              <span className="hidden sm:inline text-[11px]">Command Palette</span>
              <kbd className="text-[9px] font-mono bg-black px-1 py-0.2 rounded border border-zinc-800 text-zinc-500">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Search input */}
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notifications... (/)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-md pl-8 pr-7 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-500 bg-black px-1 rounded border border-zinc-800 pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Reason Filter Pills */}
          <div className="hidden xl:flex items-center gap-0.5 bg-zinc-900/60 p-0.5 rounded-md border border-zinc-800">
            {reasonFilters.map((rf) => (
              <button
                key={rf.id}
                onClick={() => onSelectReason(rf.id)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                  selectedReason === rf.id
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
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
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-xs text-zinc-400 hover:text-white transition-colors"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <Command className="w-3 h-3 text-zinc-400" />
              <span className="text-[11px]">Command Palette</span>
              <kbd className="text-[9px] font-mono bg-black px-1.5 py-0.2 rounded border border-zinc-800 text-zinc-500">
                ⌘K
              </kbd>
            </button>
          )}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Mark all as done */}
        {currentView === 'triage' && itemCount > 0 && selectedBucket !== 'done' && (
          <button
            onClick={onMarkAllDone}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white rounded-md transition-colors mr-1"
            title="Mark all items in this view as done"
          >
            <CheckCheck className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Mark All Done</span>
          </button>
        )}

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white rounded-md transition-colors disabled:opacity-50"
          title="Refresh notifications (r)"
        >
          <RotateCw className={cn('w-3 h-3 text-zinc-400', isSyncing && 'animate-spin text-white')} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Keyboard shortcuts helper */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md transition-colors"
          title="Toggle Theme"
        >
          {currentTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};

