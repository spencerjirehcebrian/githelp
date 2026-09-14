import type {
  AppSettings,
  AuthStatus,
  EnrichedNotification,
  NotificationStatus,
  StatusResponse,
  SyncResponse,
  StandupResponse,
  ClaimableIssue,
  WorktreesResponse,
} from '../types';
import type { Brief } from '../types/brief';

const API_BASE = '/api';

/**
 * Fetches the complete ranked brief.
 *
 * This is the only call the brief makes. Filtering, grouping, collapsing, and
 * exporting all happen on the payload in memory, so typing in the filter box
 * costs nothing. Pass refresh to bypass the server's short cache, which is
 * what the `r` key does.
 */
export async function getBrief(options?: {
  repo?: string;
  refresh?: boolean;
}): Promise<Brief> {
  const query = new URLSearchParams();
  if (options?.repo) query.set('repo', options.repo);
  if (options?.refresh) query.set('refresh', '1');

  const suffix = query.toString();
  const res = await fetch(`${API_BASE}/brief${suffix ? `?${suffix}` : ''}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch brief: ${res.statusText}`);
  }
  return res.json();
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json();
}

export async function getNotifications(params?: {
  bucket?: string;
  repo?: string;
  status?: string;
  q?: string;
}): Promise<EnrichedNotification[]> {
  const query = new URLSearchParams();
  if (params?.bucket) query.set('bucket', params.bucket);
  if (params?.repo) query.set('repo', params.repo);
  if (params?.status) query.set('status', params.status);
  if (params?.q) query.set('q', params.q);

  const res = await fetch(`${API_BASE}/notifications?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

export async function syncNotifications(): Promise<SyncResponse> {
  const res = await fetch(`${API_BASE}/notifications/sync`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Sync failed: ${res.statusText}`);
  }
  return res.json();
}

export async function updateNotificationState(
  id: string,
  state: {
    status?: NotificationStatus;
    snoozed_until?: string | null;
    pinned?: boolean;
    notes?: string;
    unread?: boolean;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/${encodeURIComponent(id)}/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Failed to update notification state: ${res.statusText}`);
}

export async function bulkUpdateNotifications(
  ids: string[],
  status: NotificationStatus,
  snoozed_until?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status, snoozed_until }),
  });
  if (!res.ok) throw new Error(`Bulk update failed: ${res.statusText}`);
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
  return res.json();
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to save settings: ${res.statusText}`);
}

export async function setPAT(token: string): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/pat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save PAT');
  }
  return res.json();
}

export async function disconnectAuth(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to disconnect: ${res.statusText}`);
  return res.json();
}

export async function getStandup(date?: string, repo?: string): Promise<StandupResponse> {
  const query = new URLSearchParams();
  if (date) query.set('date', date);
  if (repo) query.set('repo', repo);
  const res = await fetch(`${API_BASE}/standup?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch standup: ${res.statusText}`);
  return res.json();
}

export async function saveStandup(date: string, content: string): Promise<{ status: string; date: string }> {
  const res = await fetch(`${API_BASE}/standup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, content }),
  });
  if (!res.ok) throw new Error(`Failed to save standup: ${res.statusText}`);
  return res.json();
}

export async function getBacklog(repo?: string): Promise<ClaimableIssue[]> {
  const query = new URLSearchParams();
  if (repo) query.set('repo', repo);
  const res = await fetch(`${API_BASE}/backlog?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch backlog: ${res.statusText}`);
  return res.json();
}

export async function getWorktrees(): Promise<WorktreesResponse> {
  const res = await fetch(`${API_BASE}/worktrees`);
  if (!res.ok) throw new Error(`Failed to fetch worktrees: ${res.statusText}`);
  return res.json();
}
