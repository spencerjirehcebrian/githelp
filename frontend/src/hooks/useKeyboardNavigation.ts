import { useEffect, useCallback } from 'react';
import type { EnrichedNotification } from '../types';
import { copyToClipboard } from '../lib/utils';

interface UseKeyboardNavigationProps {
  notifications: EnrichedNotification[];
  selectedIndex: number;
  setSelectedIndex: (idx: number | ((prev: number) => number)) => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleUnread: (id: string, unread: boolean) => void;
  onSync: () => void;
  onOpenShortcuts: () => void;
  onFocusSearch: () => void;
  onToast: (msg: string) => void;
  isModalOpen: boolean;
}

export function useKeyboardNavigation({
  notifications,
  selectedIndex,
  setSelectedIndex,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onSync,
  onOpenShortcuts,
  onFocusSearch,
  onToast,
  isModalOpen,
}: UseKeyboardNavigationProps) {
  const selectedItem = notifications[selectedIndex] || null;

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Don't handle shortcuts if typing in an input/textarea or if modal is open
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isModalOpen) {
        if (e.key === 'Escape') {
          // Handled by modal
        }
        return;
      }

      if (isInput) {
        if (e.key === 'Escape') {
          target.blur();
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        // Selection Navigation
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, notifications.length - 1));
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }

        // Open in browser
        case 'Enter':
        case 'o': {
          if (selectedItem?.html_url) {
            e.preventDefault();
            window.open(selectedItem.html_url, '_blank', 'noopener,noreferrer');
          }
          break;
        }

        // Mark Done
        case 'e': {
          if (selectedItem) {
            e.preventDefault();
            onMarkDone(selectedItem.id);
            onToast('Marked as done');
          }
          break;
        }

        // Snooze
        case 'z': {
          if (selectedItem) {
            e.preventDefault();
            onOpenSnooze(selectedItem.id);
          }
          break;
        }

        // Pin / Unpin
        case 'p': {
          if (selectedItem) {
            e.preventDefault();
            onTogglePin(selectedItem.id, selectedItem.triage.pinned);
            onToast(selectedItem.triage.pinned ? 'Unpinned' : 'Pinned to top');
          }
          break;
        }

        // Toggle Unread
        case 'u': {
          if (selectedItem) {
            e.preventDefault();
            onToggleUnread(selectedItem.id, selectedItem.unread);
            onToast(selectedItem.unread ? 'Marked as read' : 'Marked as unread');
          }
          break;
        }

        // Copy checkout or link
        case 'c': {
          if (selectedItem) {
            e.preventDefault();
            if (selectedItem.branch) {
              const cmd = `git checkout ${selectedItem.branch}`;
              await copyToClipboard(cmd);
              onToast(`Copied: ${cmd}`);
            } else if (selectedItem.html_url) {
              await copyToClipboard(selectedItem.html_url);
              onToast('Copied URL to clipboard');
            }
          }
          break;
        }

        // Search focus
        case '/': {
          e.preventDefault();
          onFocusSearch();
          break;
        }

        // Sync refresh
        case 'r': {
          e.preventDefault();
          onSync();
          onToast('Syncing GitHub notifications...');
          break;
        }

        // Shortcuts Help
        case '?': {
          e.preventDefault();
          onOpenShortcuts();
          break;
        }
      }
    },
    [
      notifications,
      selectedIndex,
      selectedItem,
      setSelectedIndex,
      onMarkDone,
      onOpenSnooze,
      onTogglePin,
      onToggleUnread,
      onSync,
      onOpenShortcuts,
      onFocusSearch,
      onToast,
      isModalOpen,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
