import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import * as api from '../lib/api';

describe('components/SettingsModal', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      auth_mode: 'gh_cli',
      poll_interval_sec: 60,
      enable_browser_notifications: true,
      enable_sound: false,
      ignored_repos: ['noisy/repo'],
      theme: 'dark',
    });
  });

  it('renders settings fields and options', async () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        authStatus={{ authenticated: true, auth_mode: 'gh_cli', username: 'spencer' }}
        onAuthUpdated={vi.fn()}
        currentTheme="dark"
        onThemeChange={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(await screen.findByText('Preferences & Settings')).toBeInTheDocument();
    expect(screen.getByText('Connected (GitHub CLI)')).toBeInTheDocument();
    expect(screen.getByText('Background Polling Interval')).toBeInTheDocument();
    expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
    expect(screen.getByText('noisy/repo')).toBeInTheDocument();
  });
});
