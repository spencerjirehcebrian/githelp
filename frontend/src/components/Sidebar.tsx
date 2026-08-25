import React from 'react';
import {
  Flame,
  Clock,
  AtSign,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  Moon,
  FolderGit2,
  Settings as SettingsIcon,
  Inbox,
  FilterX,
} from 'lucide-react';
import type { BucketType, StatusResponse } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  status: StatusResponse | null;
  selectedBucket: BucketType;
  onSelectBucket: (bucket: BucketType) => void;
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  status,
  selectedBucket,
  onSelectBucket,
  selectedRepo,
  onSelectRepo,
  onOpenSettings,
}) => {
  const bucketCounts = status?.bucket_counts || {};
  const repoCounts = status?.repo_counts || {};

  const primaryBuckets: { id: BucketType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    {
      id: 'action_required',
      label: 'Action Required',
      icon: Flame,
      color: 'text-amber-400',
    },
    {
      id: 'waiting_on_others',
      label: 'Waiting on Others',
      icon: Clock,
      color: 'text-blue-400',
    },
    {
      id: 'mentions',
      label: 'Mentions',
      icon: AtSign,
      color: 'text-purple-400',
    },
    {
      id: 'assigned',
      label: 'Assigned',
      icon: UserCheck,
      color: 'text-emerald-400',
    },
    {
      id: 'participating',
      label: 'Participating',
      icon: MessageSquare,
      color: 'text-zinc-400',
    },
  ];

  const secondaryBuckets: { id: BucketType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    {
      id: 'snoozed',
      label: 'Snoozed',
      icon: Moon,
      color: 'text-indigo-400',
    },
    {
      id: 'done',
      label: 'Done / Archive',
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
  ];

  const repoList = Object.entries(repoCounts).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="w-64 h-screen bg-github-darker border-r border-github-border flex flex-col select-none shrink-0">
      {/* App Brand Header */}
      <div className="p-4 border-b border-github-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>GitHelp</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-github-accent/20 text-github-accent border border-github-accent/30 rounded">
                v1.0
              </span>
            </div>
            <div className="text-[11px] text-github-muted">GitHub Triage Hub</div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Primary Buckets */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-github-muted">
            Triage Buckets
          </div>
          {primaryBuckets.map((bucket) => {
            const Icon = bucket.icon;
            const count = bucketCounts[bucket.id] || 0;
            const isSelected = selectedBucket === bucket.id;

            return (
              <button
                key={bucket.id}
                onClick={() => {
                  onSelectBucket(bucket.id);
                  onSelectRepo('');
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group',
                  isSelected
                    ? 'bg-github-hover text-white border border-github-border/80 shadow-sm'
                    : 'text-github-text hover:bg-github-hover/50 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn('w-4 h-4 transition-colors', bucket.color)} />
                  <span>{bucket.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-mono rounded-full font-semibold',
                      isSelected
                        ? 'bg-github-accent text-white'
                        : bucket.id === 'action_required'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-github-border/60 text-github-muted group-hover:text-github-text'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Views (Snoozed, Done) */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-github-muted">
            Saved & Completed
          </div>
          {secondaryBuckets.map((bucket) => {
            const Icon = bucket.icon;
            const count = bucketCounts[bucket.id] || 0;
            const isSelected = selectedBucket === bucket.id;

            return (
              <button
                key={bucket.id}
                onClick={() => {
                  onSelectBucket(bucket.id);
                  onSelectRepo('');
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group',
                  isSelected
                    ? 'bg-github-hover text-white border border-github-border/80 shadow-sm'
                    : 'text-github-text hover:bg-github-hover/50 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn('w-4 h-4 transition-colors', bucket.color)} />
                  <span>{bucket.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-mono rounded-full font-semibold',
                      isSelected
                        ? 'bg-github-accent text-white'
                        : 'bg-github-border/60 text-github-muted group-hover:text-github-text'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Repositories Filter */}
        {repoList.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-github-muted">
                Repositories
              </span>
              {selectedRepo && (
                <button
                  onClick={() => onSelectRepo('')}
                  className="text-[10px] text-github-accent hover:underline flex items-center gap-0.5"
                >
                  <FilterX className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {repoList.map(([repo, count]) => {
                const isSelected = selectedRepo === repo;
                return (
                  <button
                    key={repo}
                    onClick={() => onSelectRepo(isSelected ? '' : repo)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left truncate group',
                      isSelected
                        ? 'bg-github-accent/15 border border-github-accent/40 text-github-accent font-medium'
                        : 'text-github-muted hover:bg-github-hover/50 hover:text-github-text'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderGit2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{repo}</span>
                    </div>
                    <span className="text-[10px] font-mono text-github-muted shrink-0 pl-1">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-github-border bg-github-dark/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {status?.auth.avatar_url ? (
            <img
              src={status.auth.avatar_url}
              alt={status.auth.username || 'User avatar'}
              className="w-7 h-7 rounded-full border border-github-border shrink-0 object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-github-hover border border-github-border flex items-center justify-center text-xs font-semibold text-github-muted shrink-0">
              ?
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {status?.auth.name || status?.auth.username || 'Not Connected'}
            </div>
            <div className="text-[10px] text-github-muted flex items-center gap-1.5 truncate">
              {status?.auth.authenticated ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">
                    {status.auth.auth_mode === 'gh_cli' ? 'gh CLI' : 'PAT'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-github-muted hover:text-white hover:bg-github-hover transition-colors"
          title="Settings (s)"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
