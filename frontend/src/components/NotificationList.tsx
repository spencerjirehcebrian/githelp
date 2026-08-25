import React from 'react';
import { Sparkles, Inbox, SearchX, CheckCircle } from 'lucide-react';
import type { BucketType, EnrichedNotification } from '../types';
import { NotificationCard } from './NotificationCard';

interface NotificationListProps {
  notifications: EnrichedNotification[];
  selectedBucket: BucketType;
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  isLoading: boolean;
  searchQuery: string;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onToast: (msg: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  selectedBucket,
  selectedIndex,
  onSelectIndex,
  isLoading,
  searchQuery,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onToast,
}) => {
  if (isLoading && notifications.length === 0) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-github-dark/40 border border-github-border/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-github-hover border border-github-border flex items-center justify-center text-github-muted mb-3">
            <SearchX className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">No matching notifications</h3>
          <p className="text-xs text-github-muted max-w-sm">
            Could not find any notifications matching "{searchQuery}".
          </p>
        </div>
      );
    }

    if (selectedBucket === 'action_required') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/5">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Inbox Zero Achieved</h3>
          <p className="text-xs text-github-muted max-w-md leading-relaxed">
            You're completely caught up! There are no pending reviews, broken builds, or urgent mentions waiting on you.
          </p>
        </div>
      );
    }

    if (selectedBucket === 'done') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-github-hover border border-github-border flex items-center justify-center text-emerald-400 mb-3">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">No archived notifications</h3>
          <p className="text-xs text-github-muted max-w-sm">
            Completed notifications marked with <kbd className="px-1 font-mono text-[10px] bg-github-dark border border-github-border rounded">e</kbd> will show up here.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-github-hover border border-github-border flex items-center justify-center text-github-muted mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">No notifications in this bucket</h3>
        <p className="text-xs text-github-muted max-w-sm">
          All clean for now. Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-github-dark border border-github-border rounded text-github-accent">r</kbd> to sync.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2.5 max-w-5xl mx-auto">
      {notifications.map((item, idx) => (
        <NotificationCard
          key={item.id}
          item={item}
          isSelected={idx === selectedIndex}
          onSelect={() => onSelectIndex(idx)}
          onMarkDone={onMarkDone}
          onOpenSnooze={onOpenSnooze}
          onTogglePin={onTogglePin}
          onToggleUnread={onToggleUnread}
          onToast={onToast}
        />
      ))}
    </div>
  );
};
