import React from 'react';
import {
  Flame,
  XCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Inbox,
} from 'lucide-react';
import type {
  EnrichedNotification,
  PipelineColumnId,
} from '../types';
import { categorizeIntoPipeline, cn } from '../lib/utils';
import { NotificationCard } from './NotificationCard';

interface PipelineBoardProps {
  notifications: EnrichedNotification[];
  selectedItemId: string | null;
  onSelectItem: (item: EnrichedNotification) => void;
  activeColumnId: PipelineColumnId;
  onSelectColumn: (columnId: PipelineColumnId) => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onToast: (msg: string) => void;
  isLoading?: boolean;
  searchQuery?: string;
  showCI?: boolean;
}

interface ColumnDef {
  id: PipelineColumnId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  borderAccent: string;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  notifications,
  selectedItemId,
  onSelectItem,
  activeColumnId,
  onSelectColumn,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onToast,
  isLoading,
  searchQuery,
  showCI = false,
}) => {
  const columns: ColumnDef[] = [
    {
      id: 'review_required',
      title: 'Needs Your Review',
      subtitle: 'Urgent reviews & blockers',
      icon: Flame,
      accentColor: 'text-amber-400',
      badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
      borderAccent: 'border-t-amber-500',
    },
    {
      id: 'ci_failing',
      title: 'CI Failing',
      subtitle: 'Broken checks & alerts',
      icon: XCircle,
      accentColor: 'text-rose-400',
      badgeBg: 'bg-rose-950/40 text-rose-300 border-rose-800/40',
      borderAccent: 'border-t-rose-500',
    },
    {
      id: 'ready_to_merge',
      title: 'Ready to Merge',
      subtitle: 'Passing checks & approved',
      icon: CheckCircle2,
      accentColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
      borderAccent: 'border-t-emerald-500',
    },
    {
      id: 'waiting',
      title: 'Waiting on Others',
      subtitle: 'Mentions & in-flight work',
      icon: Clock,
      accentColor: 'text-blue-400',
      badgeBg: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
      borderAccent: 'border-t-blue-500',
    },
  ];

  const pipelineMap = categorizeIntoPipeline(notifications);

  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {[1, 2, 3, 4].map((col) => (
          <div
            key={col}
            className="flex-1 min-w-[280px] bg-zinc-950/50 rounded-lg border border-zinc-900 p-3 space-y-3 animate-pulse"
          >
            <div className="h-6 bg-zinc-900 rounded w-1/2" />
            <div className="h-20 bg-zinc-900 rounded" />
            <div className="h-20 bg-zinc-900 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="pipeline-board"
      className="flex-1 flex gap-3 p-3 overflow-x-auto overflow-y-hidden bg-github-dark min-w-0"
    >
      {columns.map((col) => {
        const Icon = col.icon;
        const items = pipelineMap[col.id] || [];
        const isActiveColumn = activeColumnId === col.id;

        return (
          <div
            key={col.id}
            onClick={() => onSelectColumn(col.id)}
            data-testid={`pipeline-column-${col.id}`}
            className={cn(
              'flex-1 min-w-[280px] max-w-[380px] flex flex-col rounded-lg border bg-zinc-950/60 transition-all duration-150',
              col.borderAccent,
              'border-t-2',
              isActiveColumn
                ? 'border-zinc-700 bg-zinc-950/90 shadow-md ring-1 ring-zinc-700/50'
                : 'border-zinc-900 hover:border-zinc-800'
            )}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-zinc-900/80 flex items-center justify-between gap-2 shrink-0 bg-black/40">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={cn('w-4 h-4 shrink-0', col.accentColor)} />
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-zinc-200 truncate">
                    {col.title}
                  </h3>
                  <p className="text-[10px] text-zinc-500 truncate leading-tight">
                    {col.subtitle}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border tabular-nums shrink-0',
                  items.length > 0 ? col.badgeBg : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                )}
              >
                {items.length}
              </span>
            </div>

            {/* Column Content / Cards List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
                  <div className="w-8 h-8 rounded-md bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center text-zinc-500 mb-2">
                    {col.id === 'review_required' ? (
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Inbox className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {searchQuery
                      ? `No matching items for "${searchQuery}"`
                      : col.id === 'review_required'
                      ? 'No pending reviews'
                      : col.id === 'ci_failing'
                      ? 'All CI checks passing'
                      : 'No items in this stage'}
                  </span>
                  <span className="text-[10px] text-zinc-600 mt-0.5">
                    {searchQuery
                      ? 'Try another search term'
                      : col.id === 'review_required'
                      ? 'Inbox zero achieved!'
                      : 'Clean state'}
                  </span>
                </div>
              ) : (
                items.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedItemId}
                    onSelect={() => onSelectItem(item)}
                    onMarkDone={onMarkDone}
                    onOpenSnooze={onOpenSnooze}
                    onTogglePin={onTogglePin}
                    onToggleUnread={onToggleUnread}
                    onToast={onToast}
                    showCI={showCI}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
