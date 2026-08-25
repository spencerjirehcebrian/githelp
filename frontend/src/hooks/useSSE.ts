import { useEffect, useRef } from 'react';
import { playNotificationSound } from '../lib/sound';

interface UseSSEProps {
  onSyncCompleted?: (data: { synced_count: number; bucket_counts: Record<string, number> }) => void;
  onNotificationUpdated?: (data: { id: string; status: string; bucket_counts: Record<string, number> }) => void;
  onSnoozeExpired?: (data: { reactivated_ids: string[] }) => void;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
}

export function useSSE({
  onSyncCompleted,
  onNotificationUpdated,
  onSnoozeExpired,
  enableSound = false,
  enableBrowserNotifications = true,
}: UseSSEProps) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.addEventListener('sync_completed', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.synced_count > 0) {
          if (enableSound) playNotificationSound();
          if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('GitHelp: New Notifications', {
              body: `${data.synced_count} updated GitHub notifications synced.`,
              icon: '/favicon.ico',
            });
          }
        }
        onSyncCompleted?.(data);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    es.addEventListener('notification_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        onNotificationUpdated?.(data);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    es.addEventListener('bulk_updated', () => {
      onSyncCompleted?.({ synced_count: 0, bucket_counts: {} });
    });

    es.addEventListener('snooze_expired', (e) => {
      try {
        const data = JSON.parse(e.data);
        onSnoozeExpired?.(data);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    return () => {
      es.close();
    };
  }, [onSyncCompleted, onNotificationUpdated, onSnoozeExpired, enableSound, enableBrowserNotifications]);
}
