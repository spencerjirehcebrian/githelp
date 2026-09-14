import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';

function respond(body: unknown, ok = true, statusText = 'OK') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    statusText,
    json: async () => body,
  } as Response);
}

describe('lib/api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the brief with no query string by default', async () => {
    respond({ repo: 'acme/widgets', items: [] });

    await api.getBrief();
    expect(fetch).toHaveBeenCalledWith('/api/brief');
  });

  it('passes the repository and the cache bypass through', async () => {
    respond({ repo: 'acme/other', items: [] });

    await api.getBrief({ repo: 'acme/other', refresh: true });
    expect(fetch).toHaveBeenCalledWith('/api/brief?repo=acme%2Fother&refresh=1');
  });

  it('surfaces the server error message rather than the status text', async () => {
    respond({ error: 'Not authenticated with GitHub' }, false, 'Unauthorized');

    await expect(api.getBrief()).rejects.toThrow('Not authenticated with GitHub');
  });

  it('falls back to the status text when there is no error body', async () => {
    respond({}, false, 'Bad Gateway');

    await expect(api.getBrief()).rejects.toThrow('Failed to fetch brief: Bad Gateway');
  });

  it('reads the auth status', async () => {
    respond({
      auth: { authenticated: true, auth_mode: 'gh_cli', username: 'ada' },
      server_time: '2026-09-14T06:00:00Z',
    });

    const data = await api.getStatus();
    expect(data.auth.username).toBe('ada');
    expect(fetch).toHaveBeenCalledWith('/api/status');
  });

  it('writes settings as a partial update', async () => {
    respond({});

    await api.updateSettings({ tracked_repos: ['acme/widgets'] });
    expect(fetch).toHaveBeenCalledWith(
      '/api/settings',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked_repos: ['acme/widgets'] }),
      })
    );
  });
});
