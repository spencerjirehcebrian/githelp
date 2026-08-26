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
  Flame,
  XCircle,
  CheckCircle2,
  LayoutList,
  Columns3,
  Star,
  Activity,
} from 'lucide-react';
import type {
  BucketType,
  DashboardLayoutMode,
  VisibilityMetrics,
  TaskBurndownMetrics,
} from '../types';
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
  layoutMode?: DashboardLayoutMode;
  onToggleLayoutMode?: () => void;
  visibilityMetrics?: VisibilityMetrics;
  burndownMetrics?: TaskBurndownMetrics;
  showCI?: boolean;
  onToggleCI?: () => void;
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
  layoutMode = 'stream',
  onToggleLayoutMode,
  visibilityMetrics,
  burndownMetrics,
  showCI = false,
  onToggleCI,
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
        return 'Completed Tasks';
      case 'snoozed':
        return 'Snoozed';
      default:
        return 'Work Queue';
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
      {/* Title & Count & Minimalist Visibility HUD */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xs font-semibold text-white tracking-tight truncate flex items-center gap-2">
            <span>{getBucketDisplayName(selectedBucket)}</span>
            {selectedRepo && (
              <span className="text-[10px] font-mono font-normal text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                {selectedRepo}
              </span>
            )}
          </h1>
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800/80 px-1.5 py-0.2 rounded tabular-nums">
            {itemCount}
          </span>
        </div>

        {/* Today's Focus Burndown Pill */}
        {burndownMetrics && burndownMetrics.todayTotal > 0 && (
          <div
            data-testid="today-burndown-pill"
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-800/40 text-[10px] font-medium text-amber-300"
            title="Today's Focus Task Progress"
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>
              Today: {burndownMetrics.todayCompleted}/{burndownMetrics.todayTotal} Done
            </span>
          </div>
        )}

        {/* Minimalist Visibility HUD Strip */}
        {visibilityMetrics && (
          <div
            data-testid="visibility-hud-strip"
            className="hidden md:flex items-center gap-1.5 pl-2 border-l border-zinc-800"
          >
            {/* Blockers */}
            <button
              onClick={() => onSelectReason(selectedReason === 'review_requested' ? '' : 'review_requested')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border',
                selectedReason === 'review_requested'
                  ? 'bg-amber-950/80 text-amber-200 border-amber-700'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-amber-300 border-zinc-800/80 hover:bg-zinc-900'
              )}
              title="Filter by items requiring review"
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span className="font-mono text-[10px]">{visibilityMetrics.blockersCount}</span>
              <span className="hidden lg:inline text-[10px]">Blockers</span>
            </button>

            {/* CI Failing */}
            <button
              onClick={() => onSelectReason(selectedReason === 'ci_activity' ? '' : 'ci_activity')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border',
                selectedReason === 'ci_activity'
                  ? 'bg-rose-950/80 text-rose-200 border-rose-700'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-rose-300 border-zinc-800/80 hover:bg-zinc-900'
              )}
              title="Filter by CI activity and failures"
            >
              <XCircle className="w-3 h-3 text-rose-400" />
              <span className="font-mono text-[10px]">{visibilityMetrics.ciFailingCount}</span>
              <span className="hidden lg:inline text-[10px]">CI Failing</span>
            </button>

            {/* Ready */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900/60 text-zinc-400 border border-zinc-800/80"
              title="PRs with passing CI checks"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                {visibilityMetrics.readyToMergeCount}
              </span>
              <span className="hidden lg:inline text-[10px]">Ready</span>
            </div>
          </div>
        )}
      </div>

      {/* Center: Command Palette Trigger & Search */}
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
            placeholder="Search tasks... (/)"
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

      {/* Right: Actions & Toggles */}
      <div className="flex items-center gap-1.5">
        {/* Show/Hide CI Toggle */}
        {onToggleCI && (
          <button
            onClick={onToggleCI}
            aria-label="Toggle CI Badges"
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
              showCI
                ? 'bg-zinc-800 text-emerald-300 border-zinc-700'
                : 'bg-zinc-900/80 text-zinc-500 hover:text-zinc-300 border-zinc-800'
            )}
            title={showCI ? 'Hide CI badges on cards' : 'Show CI badges on cards'}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[10px]">
              {showCI ? 'CI On' : 'CI Off'}
            </span>
          </button>
        )}

        {/* Layout Mode Switcher (Tasks vs Board) */}
        {onToggleLayoutMode && (
          <button
            onClick={onToggleLayoutMode}
            aria-label="Toggle Layout Mode"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
              layoutMode === 'board'
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
            )}
            title={`Switch to ${layoutMode === 'board' ? 'Task Sections' : 'Pipeline Board'} view (v)`}
          >
            {layoutMode === 'board' ? (
              <Columns3 className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <LayoutList className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span className="hidden sm:inline text-[11px]">
              {layoutMode === 'board' ? 'Board' : 'Tasks'}
            </span>
            <kbd className="text-[9px] font-mono bg-black px-1 py-0.2 rounded border border-zinc-800 text-zinc-500">
              v
            </kbd>
          </button>
        )}

        {/* Mark all as done */}
        {itemCount > 0 && selectedBucket !== 'done' && (
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
