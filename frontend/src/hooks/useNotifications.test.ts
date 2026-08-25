import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from './useNotifications';
import * as api from '../lib/api';

describe('hooks/useNotifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches status and notifications on mount', async () => {
    vi.spyOn(api, 'getStatus').mockResolvedValueOnce({
      auth: { authenticated: true, auth_mode: 'gh_cli', username: 'spencer' },
      bucket_counts: { action_required: 1 },
      repo_counts: { 'owner/repo': 1 },
      server_time: '2026-08-25T10:00:00Z',
    });

    vi.spyOn(api, 'getNotifications').mockResolvedValueOnce([
      {
        id: '101',
        github_id: '101',
        repository: 'owner/repo',
        title: 'Sample Notification',
        type: 'PullRequest',
        reason: 'review_requested',
        url: '',
        html_url: '',
        state: 'open',
        ci_status: 'success',
        author: 'alice',
        author_avatar: '',
        unread: true,
        updated_at: new Date().toISOString(),
        triage: {
          notification_id: '101',
          bucket: 'action_required',
          status: 'inbox',
          pinned: false,
          notes: '',
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      // Allow async effects to resolve
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.selectedBucket).toBe('action_required');
  });

  it('optimistically removes item when markItemDone is called', async () => {
    vi.spyOn(api, 'getStatus').mockResolvedValue({
      auth: { authenticated: true, auth_mode: 'gh_cli' },
      bucket_counts: {},
      repo_counts: {},
      server_time: '',
    });
    vi.spyOn(api, 'getNotifications').mockResolvedValue([
      {
        id: '101',
        github_id: '101',
        repository: 'owner/repo',
        title: 'Sample Notification',
        type: 'PullRequest',
        reason: 'review_requested',
        url: '',
        html_url: '',
        state: 'open',
        ci_status: 'success',
        author: 'alice',
        author_avatar: '',
        unread: true,
        updated_at: new Date().toISOString(),
        triage: {
          notification_id: '101',
          bucket: 'action_required',
          status: 'inbox',
          pinned: false,
          notes: '',
          updated_at: new Date().toISOString(),
        },
      },
    ]);
    vi.spyOn(api, 'updateNotificationState').mockResolvedValue();

    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    expect(result.current.notifications.length).toBe(1);

    await act(async () => {
      await result.current.markItemDone('101');
    });

    expect(result.current.notifications.length).toBe(0);
    expect(api.updateNotificationState).toHaveBeenCalledWith('101', { status: 'done' });
  });
});
