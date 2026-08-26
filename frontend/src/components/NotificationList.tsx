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
      <div className="p-3 space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-16 rounded-md bg-zinc-900/40 border border-zinc-900 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2.5">
            <SearchX className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-medium text-zinc-200 mb-1">No matching notifications</h3>
          <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
            No items matched "{searchQuery}".
          </p>
        </div>
      );
    }

    if (selectedBucket === 'action_required') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-fade-in">
          <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-2.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-200 mb-1">Inbox Zero Achieved</h3>
          <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
            You're completely caught up! No pending reviews or urgent items waiting on you.
          </p>
        </div>
      );
    }

    if (selectedBucket === 'done') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-xs font-medium text-zinc-200 mb-1">No archived notifications</h3>
          <p className="text-[11px] text-zinc-500 max-w-xs">
            Completed notifications marked with <kbd className="px-1 font-mono text-[9px] bg-black border border-zinc-800 rounded">e</kbd> will show up here.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2.5">
          <Inbox className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-medium text-zinc-200 mb-1">Bucket is empty</h3>
        <p className="text-[11px] text-zinc-500 max-w-xs">
          Press <kbd className="px-1 font-mono text-[9px] bg-black border border-zinc-800 rounded text-zinc-300">r</kbd> to sync with GitHub.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1.5 max-w-5xl mx-auto">
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

