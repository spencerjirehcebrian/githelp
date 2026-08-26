import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TopBar } from './TopBar';
import type { StatusResponse } from '../types';

describe('components/TopBar', () => {
  const mockStatus: StatusResponse = {
    auth: {
      authenticated: true,
      auth_mode: 'gh_cli',
      username: 'spencer',
      name: 'Spencer',
      avatar_url: '',
    },
    bucket_counts: {
      action_required: 4,
      waiting_on_others: 2,
      mentions: 1,
      done: 10,
    },
    repo_counts: {
      'owner/repo-a': 3,
      'owner/repo-b': 1,
    },
    server_time: '',
  };

  it('renders brand, scope selector, repo dropdown, burndown pill, CI toggle, and handles interactions', () => {
    const onSearchChange = vi.fn();
    const onSelectBucket = vi.fn();
    const onSelectRepo = vi.fn();
    const onSelectReason = vi.fn();
    const onSync = vi.fn();
    const onToggleLayoutMode = vi.fn();
    const onToggleCI = vi.fn();
    const onOpenSettings = vi.fn();
    const inputRef = React.createRef<HTMLInputElement>();

    render(
      <TopBar
        status={mockStatus}
        selectedBucket="action_required"
        onSelectBucket={onSelectBucket}
        selectedRepo=""
        onSelectRepo={onSelectRepo}
        selectedReason=""
        onSelectReason={onSelectReason}
        searchQuery=""
        onSearchChange={onSearchChange}
        isSyncing={false}
        onSync={onSync}
        onMarkAllDone={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onOpenSettings={onOpenSettings}
        currentTheme="dark"
        onToggleTheme={vi.fn()}
        itemCount={5}
        searchInputRef={inputRef}
        layoutMode="stream"
        onToggleLayoutMode={onToggleLayoutMode}
        visibilityMetrics={{
          blockersCount: 2,
          ciFailingCount: 1,
          readyToMergeCount: 3,
          staleCount: 0,
        }}
        burndownMetrics={{
          todayTotal: 4,
          todayCompleted: 2,
          reviewsCount: 1,
          authoredCount: 1,
          issuesCount: 1,
          completedCount: 2,
        }}
        showCI={false}
        onToggleCI={onToggleCI}
      />
    );

    // Brand
    expect(screen.getByText('GitHelp')).toBeInTheDocument();

    // Scope button
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Today's Burndown Pill
    expect(screen.getByText('Today: 2/4 Done')).toBeInTheDocument();

    // Repo dropdown trigger
    expect(screen.getByText('All Repos')).toBeInTheDocument();
    fireEvent.click(screen.getByText('All Repos'));
    expect(screen.getByText('owner/repo-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner/repo-a'));
    expect(onSelectRepo).toHaveBeenCalledWith('owner/repo-a');

    // Visibility HUD strip metrics
    expect(screen.getByTestId('visibility-hud-strip')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // CI Toggle
    const ciToggleBtn = screen.getByTitle('Show CI badges on cards');
    expect(ciToggleBtn).toBeInTheDocument();
    fireEvent.click(ciToggleBtn);
    expect(onToggleCI).toHaveBeenCalledTimes(1);

    // Layout mode switcher
    const toggleBtn = screen.getByTitle('Switch to Pipeline Board view (v)');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(onToggleLayoutMode).toHaveBeenCalledTimes(1);

    // Settings trigger
    fireEvent.click(screen.getByTitle('Preferences & Settings (s)'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    // Sync button
    fireEvent.click(screen.getByTitle('Refresh tasks (r)'));
    expect(onSync).toHaveBeenCalled();
  });
});
