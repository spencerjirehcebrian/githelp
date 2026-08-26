import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import type { EnrichedNotification } from '../types';

describe('hooks/useKeyboardNavigation', () => {
  const mockNotifications: EnrichedNotification[] = [
    {
      id: 'item-1',
      github_id: '1',
      repository: 'owner/repo',
      title: 'First PR',
      type: 'PullRequest',
      reason: 'review_requested',
      url: '',
      html_url: 'https://github.com/owner/repo/pull/1',
      state: 'open',
      ci_status: 'success',
      author: 'alice',
      author_avatar: '',
      branch: 'feature-1',
      number: 1,
      unread: true,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'item-1',
        bucket: 'action_required',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'item-2',
      github_id: '2',
      repository: 'owner/repo',
      title: 'Second Issue',
      type: 'Issue',
      reason: 'mention',
      url: '',
      html_url: 'https://github.com/owner/repo/issues/2',
      state: 'open',
      ci_status: '',
      author: 'bob',
      author_avatar: '',
      number: 2,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'item-2',
        bucket: 'mentions',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
  ];

  let selectedIndex = 0;
  const setSelectedIndex = vi.fn((fn) => {
    if (typeof fn === 'function') {
      selectedIndex = fn(selectedIndex);
    } else {
      selectedIndex = fn;
    }
  });

  const onMarkDone = vi.fn();
  const onOpenSnooze = vi.fn();
  const onTogglePin = vi.fn();
  const onToggleUnread = vi.fn();
  const onSync = vi.fn();
  const onOpenShortcuts = vi.fn();
  const onFocusSearch = vi.fn();
  const onToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    selectedIndex = 0;
  });

  it('handles j (down) and k (up) navigation', () => {
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
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
        isModalOpen: false,
      })
    );

    // Press 'j'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    expect(setSelectedIndex).toHaveBeenCalled();

    // Press 'k'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(setSelectedIndex).toHaveBeenCalled();
  });

  it('handles e and Space (mark complete)', () => {
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(onMarkDone).toHaveBeenCalledWith('item-1');

    onMarkDone.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onMarkDone).toHaveBeenCalledWith('item-1');
  });

  it('handles t (toggle Today focus pin)', () => {
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    expect(onTogglePin).toHaveBeenCalledWith('item-1', false);
  });

  it('handles z (snooze)', () => {
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(onOpenSnooze).toHaveBeenCalledWith('item-1');
  });

  it('ignores shortcuts when modal is open', () => {
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onFocusSearch,
        onToast,
        isModalOpen: true, // Modal is active
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(onMarkDone).not.toHaveBeenCalled();
  });

  it('triggers onOpenCommandPalette on Cmd+K / Ctrl+K', () => {
    const onOpenCommandPalette = vi.fn();
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onOpenCommandPalette,
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleLayoutMode on v key', () => {
    const onToggleLayoutMode = vi.fn();
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        onToggleLayoutMode,
        layoutMode: 'stream',
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(onToggleLayoutMode).toHaveBeenCalledTimes(1);
  });

  it('handles h and l for column navigation in board mode', () => {
    const onSelectColumn = vi.fn();
    renderHook(() =>
      useKeyboardNavigation({
        notifications: mockNotifications,
        selectedIndex: 0,
        setSelectedIndex,
        onMarkDone,
        onOpenSnooze,
        onTogglePin,
        onToggleUnread,
        onSync,
        onOpenShortcuts,
        layoutMode: 'board',
        activeColumnId: 'review_required',
        onSelectColumn,
        onFocusSearch,
        onToast,
        isModalOpen: false,
      })
    );

    // Press 'l' (next column)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
    expect(onSelectColumn).toHaveBeenCalledWith('ci_failing');
  });
});
