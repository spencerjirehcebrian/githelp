import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';

describe('lib/api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getStatus fetches from /api/status', async () => {
    const mockData = {
      auth: { authenticated: true, auth_mode: 'gh_cli', username: 'test' },
      bucket_counts: { action_required: 2 },
      repo_counts: {},
      server_time: '2026-08-25T10:00:00Z',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const data = await api.getStatus();
    expect(data.auth.username).toBe('test');
    expect(fetch).toHaveBeenCalledWith('/api/status');
  });

  it('getNotifications queries /api/notifications with params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: '1', title: 'Test PR' }],
    } as Response);

    const items = await api.getNotifications({ bucket: 'action_required', q: 'search' });
    expect(items.length).toBe(1);
    expect(fetch).toHaveBeenCalledWith('/api/notifications?bucket=action_required&q=search');
  });

  it('syncNotifications calls POST /api/notifications/sync', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ synced_count: 5, bucket_counts: {}, repo_counts: {} }),
    } as Response);

    const res = await api.syncNotifications();
    expect(res.synced_count).toBe(5);
    expect(fetch).toHaveBeenCalledWith('/api/notifications/sync', { method: 'POST' });
  });

  it('updateNotificationState sends PATCH with state body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'updated' }),
    } as Response);

    await api.updateNotificationState('item-1', { status: 'done' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/notifications/item-1/state',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
    );
  });

  it('bulkUpdateNotifications sends POST with ids and status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ updated_count: 2 }),
    } as Response);

    await api.bulkUpdateNotifications(['1', '2'], 'done');
    expect(fetch).toHaveBeenCalledWith(
      '/api/notifications/bulk',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['1', '2'], status: 'done' }),
      })
    );
  });
});
