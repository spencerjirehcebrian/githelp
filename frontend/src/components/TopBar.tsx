import React, { useState, useRef, useEffect } from 'react';
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
  GitPullRequest,
  FolderGit2,
  Settings,
  ChevronDown,
  Archive,
  Clock,
  Inbox,
  User,
  Sparkles,
} from 'lucide-react';
import type {
  BucketType,
  DashboardLayoutMode,
  VisibilityMetrics,
  TaskBurndownMetrics,
  StatusResponse,
} from '../types';
import { cn } from '../lib/utils';

interface TopBarProps {
  status: StatusResponse | null;
  selectedBucket: BucketType;
  onSelectBucket: (bucket: BucketType) => void;
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
  selectedReason: string;
  onSelectReason: (reason: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSyncing: boolean;
  onSync: () => void;
  onMarkAllDone: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings: () => void;
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
  status,
  selectedBucket,
  onSelectBucket,
  selectedRepo,
  onSelectRepo,
  selectedReason,
  onSelectReason,
  searchQuery,
  onSearchChange,
  isSyncing,
  onSync,
  onMarkAllDone,
  onOpenShortcuts,
  onOpenCommandPalette,
  onOpenSettings,
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
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setIsRepoDropdownOpen(false);
      }
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scopes: { id: BucketType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'action_required', label: 'Active Tasks', icon: Inbox },
    { id: 'snoozed', label: 'Snoozed', icon: Clock },
    { id: 'done', label: 'Completed Archive', icon: Archive },
  ];

  const currentScope = scopes.find((s) => s.id === selectedBucket) || scopes[0];

  const repoEntries = Object.entries(status?.repo_counts || {}).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <header className="h-12 border-b border-github-border bg-black px-3.5 flex items-center justify-between gap-3 select-none shrink-0 text-github-text z-20">
      {/* Left: Brand & Scope + Repo Selectors */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Brand */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-zinc-800">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-white">
            <GitPullRequest className="w-3.5 h-3.5 text-zinc-100" />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">GitHelp</span>
        </div>

        {/* Task Scope Selector Dropdown */}
        <div className="relative" ref={scopeDropdownRef}>
          <button
            onClick={() => setIsScopeDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 rounded-md text-xs font-medium text-zinc-200 transition-colors"
            title="Switch task view scope"
          >
            <currentScope.icon className="w-3 h-3 text-zinc-400" />
            <span className="max-w-[110px] truncate">{currentScope.label}</span>
            <span className="text-[10px] font-mono text-zinc-500 bg-black px-1 rounded border border-zinc-800">
              {itemCount}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
          </button>

          {isScopeDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-50">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Work Scope
              </div>
              {scopes.map((s) => {
                const Icon = s.icon;
                const isSelected = selectedBucket === s.id;
                const count =
                  s.id === 'done'
                    ? status?.bucket_counts?.done || 0
                    : s.id === 'snoozed'
                    ? status?.bucket_counts?.snoozed || 0
                    : (status?.bucket_counts?.action_required || 0) +
                      (status?.bucket_counts?.waiting_on_others || 0) +
                      (status?.bucket_counts?.mentions || 0) +
                      (status?.bucket_counts?.assigned || 0);

                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectBucket(s.id);
                      setIsScopeDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{s.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Repository Filter Dropdown */}
        {repoEntries.length > 0 && (
          <div className="relative" ref={repoDropdownRef}>
            <button
              onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors max-w-[160px] truncate',
                selectedRepo
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
              )}
              title="Filter by repository"
            >
              <FolderGit2 className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="truncate">{selectedRepo ? selectedRepo.split('/')[1] || selectedRepo : 'All Repos'}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5 shrink-0" />
            </button>

            {isRepoDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-50 max-h-60 overflow-y-auto">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Filter Repository
                </div>
                <button
                  onClick={() => {
                    onSelectRepo('');
                    setIsRepoDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors',
                    !selectedRepo
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  )}
                >
                  <span>All Repositories</span>
                </button>
                {repoEntries.map(([repo, count]) => (
                  <button
                    key={repo}
                    onClick={() => {
                      onSelectRepo(repo);
                      setIsRepoDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors',
                      selectedRepo === repo
                        ? 'bg-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    )}
                  >
                    <span className="truncate font-mono text-[11px]">{repo}</span>
                    <span className="text-[10px] font-mono text-zinc-500 ml-2">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Visibility HUD Strip */}
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
      <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
        {/* Command Palette button */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            aria-label="Command Palette"
            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
            title="Open Command Palette (Cmd+K / Ctrl+K)"
          >
            <Command className="w-3 h-3 text-zinc-400" />
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
            <span className="hidden xl:inline text-[10px]">
              {showCI ? 'CI On' : 'CI Off'}
            </span>
          </button>
        )}

        {/* Layout Mode Switcher (Tasks vs Board vs Standup) */}
        {onToggleLayoutMode && (
          <button
            onClick={onToggleLayoutMode}
            aria-label="Toggle Layout Mode"
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
              layoutMode === 'board'
                ? 'bg-zinc-800 text-blue-300 border-zinc-700'
                : layoutMode === 'standup'
                ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
            )}
            title={`Current: ${layoutMode === 'board' ? 'Pipeline Board' : layoutMode === 'standup' ? 'Daily Standup & Backlog' : 'Task Feed'} (v to cycle)`}
          >
            {layoutMode === 'board' ? (
              <Columns3 className="w-3.5 h-3.5 text-blue-400" />
            ) : layoutMode === 'standup' ? (
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <LayoutList className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span className="hidden md:inline text-[11px]">
              {layoutMode === 'board' ? 'Board' : layoutMode === 'standup' ? 'Standup' : 'Tasks'}
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
            className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white rounded-md transition-colors"
            title="Mark all items in this view as done"
          >
            <CheckCheck className="w-3 h-3 text-emerald-400" />
            <span className="hidden xl:inline">Mark All Done</span>
          </button>
        )}

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white rounded-md transition-colors disabled:opacity-50"
          title="Refresh tasks (r)"
        >
          <RotateCw className={cn('w-3 h-3 text-zinc-400', isSyncing && 'animate-spin text-white')} />
          <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
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

        {/* User Profile / Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
          title="Preferences & Settings (s)"
        >
          {status?.auth?.avatar_url ? (
            <img
              src={status.auth.avatar_url}
              alt=""
              className="w-4 h-4 rounded-full bg-zinc-800 object-cover"
            />
          ) : (
            <User className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span className="hidden lg:inline text-[11px] font-medium max-w-[80px] truncate">
            {status?.auth?.name || status?.auth?.username || 'Settings'}
          </span>
          <Settings className="w-3 h-3 text-zinc-500" />
        </button>
      </div>
    </header>
  );
};
