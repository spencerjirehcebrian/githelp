import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Flame,
  GitPullRequest,
  CheckCircle2,
  Star,
  Sparkles,
  CircleDot,
} from 'lucide-react';
import type { EnrichedNotification, TaskSectionId } from '../types';
import { NotificationCard } from './NotificationCard';
import { categorizeIntoTaskSections, cn } from '../lib/utils';

interface TaskSectionListProps {
  notifications: EnrichedNotification[];
  selectedItemId: string | null;
  onSelectItem: (item: EnrichedNotification) => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onToast: (msg: string) => void;
  isLoading?: boolean;
  searchQuery?: string;
  showCI?: boolean;
}

interface SectionMeta {
  id: TaskSectionId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
}

export const TaskSectionList: React.FC<TaskSectionListProps> = ({
  notifications,
  selectedItemId,
  onSelectItem,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onToast,
  isLoading = false,
  searchQuery = '',
  showCI = false,
}) => {
  const sections = categorizeIntoTaskSections(notifications);

  // Collapsed sections state
  const [collapsed, setCollapsed] = useState<Record<TaskSectionId, boolean>>({
    today: false,
    reviews: false,
    authored: false,
    issues: false,
    completed: true, // Completed tasks collapsed by default
  });

  const toggleSection = (id: TaskSectionId) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sectionConfigs: SectionMeta[] = [
    {
      id: 'today',
      title: "Today's Focus",
      subtitle: 'Priority tasks pinned for today',
      icon: Star,
      accentColor: 'text-amber-400',
      badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    },
    {
      id: 'reviews',
      title: 'PRs Needing Your Review',
      subtitle: 'Unblock teammates waiting on your feedback',
      icon: Flame,
      accentColor: 'text-rose-400',
      badgeBg: 'bg-rose-950/60 text-rose-300 border-rose-800/40',
    },
    {
      id: 'authored',
      title: 'Your Authored PRs',
      subtitle: 'In-flight pull requests and review responses',
      icon: GitPullRequest,
      accentColor: 'text-blue-400',
      badgeBg: 'bg-blue-950/60 text-blue-300 border-blue-800/40',
    },
    {
      id: 'issues',
      title: 'Assigned Issues & Tasks',
      subtitle: 'GitHub issues assigned to you',
      icon: CircleDot,
      accentColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
    },
    {
      id: 'completed',
      title: 'Completed Today',
      subtitle: 'Finished tasks and merged work',
      icon: CheckCircle2,
      accentColor: 'text-zinc-400',
      badgeBg: 'bg-zinc-900 text-zinc-400 border-zinc-800',
    },
  ];

  // Loading skeleton
  if (isLoading && notifications.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-lg border border-zinc-900 bg-zinc-950/40 animate-pulse space-y-2.5"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              <div className="h-3 w-28 bg-zinc-800 rounded" />
              <div className="h-3 w-16 bg-zinc-800/60 rounded" />
            </div>
            <div className="h-4 w-3/4 bg-zinc-800/80 rounded" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-3 w-20 bg-zinc-800/40 rounded" />
              <div className="h-3 w-24 bg-zinc-800/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Total non-completed count
  const activeCount =
    sections.today.length +
    sections.reviews.length +
    sections.authored.length +
    sections.issues.length;

  if (activeCount === 0 && sections.completed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8 select-none">
        <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">
          {searchQuery ? 'No matching tasks' : 'All Tasks Completed!'}
        </h3>
        <p className="text-xs text-zinc-500 max-w-xs mt-1">
          {searchQuery
            ? `No tasks found matching "${searchQuery}". Try another search term.`
            : "You're completely caught up on your reviews, PRs, and assigned issues."}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="task-section-list"
      className="p-3 space-y-4 overflow-y-auto h-full"
    >
      {sectionConfigs.map((cfg) => {
        const items = sections[cfg.id] || [];
        const isSectionCollapsed = collapsed[cfg.id];
        const Icon = cfg.icon;

        // Don't render empty sections except Today and Completed if there is activity
        if (items.length === 0 && cfg.id !== 'today' && cfg.id !== 'completed') {
          return null;
        }

        // If today has 0 items and other sections have items, show friendly placeholder
        if (items.length === 0 && cfg.id === 'today') {
          return (
            <div
              key={cfg.id}
              className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-zinc-200">Today's Focus</span>
                  <span className="text-[10px] text-zinc-600 font-mono">0 active</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 italic">
                Press 't' on any review, PR, or issue below to pin it to Today's Focus.
              </p>
            </div>
          );
        }

        if (items.length === 0 && cfg.id === 'completed') {
          return null;
        }

        return (
          <div
            key={cfg.id}
            data-testid={`task-section-${cfg.id}`}
            className="rounded-lg border border-zinc-900 bg-zinc-950/60 overflow-hidden transition-colors"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(cfg.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors text-left select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isSectionCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                )}
                <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.accentColor)} />
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {cfg.title}
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border',
                    cfg.badgeBg
                  )}
                >
                  {items.length}
                </span>
              </div>

              <span className="text-[10px] text-zinc-500 hidden sm:inline">
                {cfg.subtitle}
              </span>
            </button>

            {/* Section Item Cards */}
            {!isSectionCollapsed && (
              <div className="p-2 space-y-2 bg-zinc-950/30">
                {items.map((item) => (
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
