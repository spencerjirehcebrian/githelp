/**
 * The client's entire network surface.
 *
 * Four endpoints. The brief is the only one on the hot path; the rest are
 * settings, which are read when the settings sheet opens and written when
 * the user changes something.
 */

import type { AppSettings, AuthStatus, StatusResponse } from '../types';
import type { Brief } from '../types/brief';

const API_BASE = '/api';

async function failure(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  return new Error(data.error || `${fallback}: ${res.statusText}`);
}

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
  if (!res.ok) throw await failure(res, 'Failed to fetch brief');
  return res.json();
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw await failure(res, 'Failed to fetch status');
  return res.json();
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw await failure(res, 'Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw await failure(res, 'Failed to save settings');
}

export async function setPAT(token: string): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/pat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw await failure(res, 'Failed to save the token');
  return res.json();
}

export async function disconnectAuth(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/disconnect`, { method: 'POST' });
  if (!res.ok) throw await failure(res, 'Failed to disconnect');
  return res.json();
}
