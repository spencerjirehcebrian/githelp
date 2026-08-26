import { useState, useEffect, useCallback } from 'react';
import type {
  BucketType,
  EnrichedNotification,
  StatusResponse,
} from '../types';
import * as api from '../lib/api';

export function useNotifications() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<BucketType>('action_required');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let bucketParam = '';
      let statusParam = 'inbox';

      if (selectedBucket === 'done') {
        statusParam = 'done';
      } else if (selectedBucket === 'snoozed') {
        statusParam = 'snoozed';
      } else {
        bucketParam = selectedBucket;
        statusParam = 'inbox';
      }

      const data = await api.getNotifications({
        bucket: bucketParam,
        status: statusParam,
        repo: selectedRepo,
        q: searchQuery,
      });

      // Filter by reason locally if reason is selected
      const filtered = selectedReason
        ? data.filter((item) => item.reason.toLowerCase() === selectedReason.toLowerCase())
        : data;

      setNotifications(filtered);
      setSelectedIndex((prev) => (prev >= filtered.length ? Math.max(0, filtered.length - 1) : prev));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBucket, selectedRepo, selectedReason, searchQuery]);

  useEffect(() => {
    fetchStatus();
    fetchNotifications();
  }, [fetchStatus, fetchNotifications]);

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      await api.syncNotifications();
      await fetchStatus();
      await fetchNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const markItemDone = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.updateNotificationState(id, { status: 'done' });
      fetchStatus();
    } catch (err) {
      console.error('Failed to mark done:', err);
      fetchNotifications();
    }
  };

  const snoozeItem = async (id: string, until: Date) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.updateNotificationState(id, {
        status: 'snoozed',
        snoozed_until: until.toISOString(),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to snooze item:', err);
      fetchNotifications();
    }
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, triage: { ...n.triage, pinned: !currentPinned } } : n))
    );
    try {
      await api.updateNotificationState(id, { pinned: !currentPinned });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      fetchNotifications();
    }
  };

  const toggleUnread = async (id: string, currentUnread: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !currentUnread } : n))
    );
    try {
      await api.updateNotificationState(id, { unread: !currentUnread });
    } catch (err) {
      console.error('Failed to toggle unread:', err);
      fetchNotifications();
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, triage: { ...n.triage, notes } } : n))
    );
    try {
      await api.updateNotificationState(id, { notes });
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  const markAllDone = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    setNotifications([]);
    try {
      await api.bulkUpdateNotifications(ids, 'done');
      fetchStatus();
    } catch (err) {
      console.error('Bulk mark done error:', err);
      fetchNotifications();
    }
  };

  return {
    status,
    notifications,
    selectedBucket,
    setSelectedBucket,
    selectedRepo,
    setSelectedRepo,
    selectedReason,
    setSelectedReason,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    isSyncing,
    error,
    triggerSync,
    markItemDone,
    snoozeItem,
    togglePin,
    toggleUnread,
    updateNotes,
    markAllDone,
    refresh: () => {
      fetchStatus();
      fetchNotifications();
    },
  };
}
