import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TopBar } from './TopBar';

describe('components/TopBar', () => {
  it('renders search input, reason pills, burndown pill, CI toggle, and handles interactions', () => {
    const onSearchChange = vi.fn();
    const onSelectReason = vi.fn();
    const onSync = vi.fn();
    const onToggleLayoutMode = vi.fn();
    const onToggleCI = vi.fn();
    const inputRef = React.createRef<HTMLInputElement>();

    render(
      <TopBar
        selectedBucket="action_required"
        selectedRepo=""
        selectedReason=""
        onSelectReason={onSelectReason}
        searchQuery=""
        onSearchChange={onSearchChange}
        isSyncing={false}
        onSync={onSync}
        onMarkAllDone={vi.fn()}
        onOpenShortcuts={vi.fn()}
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

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Today's Burndown Pill
    expect(screen.getByText('Today: 2/4 Done')).toBeInTheDocument();

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

    // Reason pill
    fireEvent.click(screen.getByText('Reviews'));
    expect(onSelectReason).toHaveBeenCalledWith('review_requested');

    // Sync button
    fireEvent.click(screen.getByTitle('Refresh notifications (r)'));
    expect(onSync).toHaveBeenCalled();
  });
});
