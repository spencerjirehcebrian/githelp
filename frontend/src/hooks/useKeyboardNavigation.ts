import { useEffect, useCallback } from 'react';
import type {
  EnrichedNotification,
  DashboardLayoutMode,
  PipelineColumnId,
} from '../types';
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
  onOpenCommandPalette?: () => void;
  onOpenDrawer?: () => void;
  onToggleLayoutMode?: () => void;
  layoutMode?: DashboardLayoutMode;
  activeColumnId?: PipelineColumnId;
  onSelectColumn?: (col: PipelineColumnId) => void;
  onFocusSearch: () => void;
  onToast: (msg: string) => void;
  isModalOpen: boolean;
}

const PIPELINE_COLUMNS: PipelineColumnId[] = [
  'review_required',
  'ci_failing',
  'ready_to_merge',
  'waiting',
];

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
  onOpenCommandPalette,
  onOpenDrawer,
  onToggleLayoutMode,
  layoutMode = 'stream',
  activeColumnId = 'review_required',
  onSelectColumn,
  onFocusSearch,
  onToast,
  isModalOpen,
}: UseKeyboardNavigationProps) {
  const selectedItem = notifications[selectedIndex] || null;

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Global Cmd+K / Ctrl+K Command Palette trigger (works even from inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        }
        return;
      }

      // Don't handle navigation shortcuts if typing in an input/textarea or if modal is open
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isModalOpen) {
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

        // Column Navigation in Board Mode
        case 'h':
        case 'ArrowLeft': {
          if (layoutMode === 'board' && onSelectColumn) {
            e.preventDefault();
            const currIdx = PIPELINE_COLUMNS.indexOf(activeColumnId);
            const nextIdx = Math.max(currIdx - 1, 0);
            onSelectColumn(PIPELINE_COLUMNS[nextIdx]);
          }
          break;
        }
        case 'l':
        case 'ArrowRight': {
          if (layoutMode === 'board' && onSelectColumn) {
            e.preventDefault();
            const currIdx = PIPELINE_COLUMNS.indexOf(activeColumnId);
            const nextIdx = Math.min(currIdx + 1, PIPELINE_COLUMNS.length - 1);
            onSelectColumn(PIPELINE_COLUMNS[nextIdx]);
          }
          break;
        }

        // Toggle Task Sections vs Board View
        case 'v': {
          if (onToggleLayoutMode) {
            e.preventDefault();
            onToggleLayoutMode();
            onToast(
              layoutMode === 'board'
                ? 'Switched to Task Sections view'
                : 'Switched to Pipeline Board view'
            );
          }
          break;
        }

        // Open Inspection Drawer on Enter, i, or d
        case 'Enter':
        case 'i':
        case 'd': {
          if (selectedItem && onOpenDrawer) {
            e.preventDefault();
            onOpenDrawer();
          }
          break;
        }

        // Open in browser (o)
        case 'o': {
          if (selectedItem?.html_url) {
            e.preventDefault();
            window.open(selectedItem.html_url, '_blank', 'noopener,noreferrer');
          }
          break;
        }

        // Complete Task (Space or e)
        case ' ':
        case 'e': {
          if (selectedItem) {
            e.preventDefault();
            onMarkDone(selectedItem.id);
            onToast(selectedItem.triage?.status === 'done' ? 'Reopened task' : 'Completed task');
          }
          break;
        }

        // Toggle Today's Focus (t) or Pin (p)
        case 't':
        case 'p': {
          if (selectedItem) {
            e.preventDefault();
            const wasPinned = selectedItem.triage?.pinned || false;
            onTogglePin(selectedItem.id, wasPinned);
            onToast(wasPinned ? "Removed from Today's Focus" : "Pinned to Today's Focus");
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
          onToast('Syncing GitHub tasks...');
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
      onOpenCommandPalette,
      onOpenDrawer,
      onToggleLayoutMode,
      layoutMode,
      activeColumnId,
      onSelectColumn,
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
