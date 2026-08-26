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
  FilterX,
  Layers,
  CheckSquare,
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
      label: 'Completed Tasks',
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
  ];

  const repoList = Object.entries(repoCounts).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="w-60 h-screen bg-github-darker border-r border-github-border flex flex-col select-none shrink-0 text-github-text">
      {/* App Brand Header */}
      <div className="p-3.5 border-b border-github-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
            <Layers className="w-3.5 h-3.5 text-zinc-200" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-tight text-white">GitHelp</span>
            <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
              Tasks
            </span>
          </div>
        </div>
      </div>

      {/* Primary Work Queue Header */}
      <div className="p-2 border-b border-github-border">
        <button
          onClick={() => {
            onSelectBucket('action_required');
            onSelectRepo('');
          }}
          aria-label="Developer Task List"
          className={cn(
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors',
            selectedBucket === 'action_required' && !selectedRepo
              ? 'bg-zinc-900 text-white font-medium border border-zinc-800'
              : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
          )}
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Developer Task Queue</span>
          </div>
          {bucketCounts['inbox_total'] ? (
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-black border border-zinc-800 text-zinc-400 tabular-nums">
              {bucketCounts['inbox_total']}
            </span>
          ) : null}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-5">
        {/* Primary Buckets */}
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Work Queues
          </div>
          {primaryBuckets.map((bucket) => {
            const Icon = bucket.icon;
            const count = bucketCounts[bucket.id] || 0;
            const isSelected = selectedBucket === bucket.id && !selectedRepo;

            return (
              <button
                key={bucket.id}
                onClick={() => {
                  onSelectBucket(bucket.id);
                  onSelectRepo('');
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group',
                  isSelected
                    ? 'bg-zinc-900 text-white font-medium border border-zinc-800'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-3.5 h-3.5', isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300')} />
                  <span className="truncate">{bucket.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 text-[10px] font-mono rounded tabular-nums',
                      isSelected
                        ? 'bg-black text-white border border-zinc-700'
                        : bucket.id === 'action_required'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                        : 'bg-black/60 text-zinc-500 border border-zinc-800/60 group-hover:text-zinc-400'
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
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Saved & Completed
          </div>
          {secondaryBuckets.map((bucket) => {
            const Icon = bucket.icon;
            const count = bucketCounts[bucket.id] || 0;
            const isSelected = selectedBucket === bucket.id && !selectedRepo;

            return (
              <button
                key={bucket.id}
                onClick={() => {
                  onSelectBucket(bucket.id);
                  onSelectRepo('');
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group',
                  isSelected
                    ? 'bg-zinc-900 text-white font-medium border border-zinc-800'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-3.5 h-3.5', isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300')} />
                  <span className="truncate">{bucket.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 text-[10px] font-mono rounded tabular-nums',
                      isSelected
                        ? 'bg-black text-white border border-zinc-700'
                        : 'bg-black/60 text-zinc-500 border border-zinc-800/60 group-hover:text-zinc-400'
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
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Repositories
              </span>
              {selectedRepo && (
                <button
                  onClick={() => onSelectRepo('')}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-0.5"
                >
                  <FilterX className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-44 overflow-y-auto">
              {repoList.map(([repo, count]) => {
                const isSelected = selectedRepo === repo;
                return (
                  <button
                    key={repo}
                    onClick={() => onSelectRepo(isSelected ? '' : repo)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left truncate group',
                      isSelected
                        ? 'bg-zinc-900 border border-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderGit2 className="w-3 h-3 shrink-0 text-zinc-500" />
                      <span className="truncate">{repo}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0 pl-1 tabular-nums">
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
      <div className="p-3 border-t border-github-border bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {status?.auth.avatar_url ? (
            <img
              src={status.auth.avatar_url}
              alt={status.auth.username || 'User avatar'}
              className="w-6 h-6 rounded-full border border-zinc-800 shrink-0 object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-semibold text-zinc-400 shrink-0">
              ?
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-zinc-200 truncate">
              {status?.auth.name || status?.auth.username || 'Not Connected'}
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 truncate">
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
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Settings (s)"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
