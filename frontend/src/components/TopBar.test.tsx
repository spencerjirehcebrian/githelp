import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TopBar } from './TopBar';

describe('components/TopBar', () => {
  it('renders search input, reason pills, and handles interactions', () => {
    const onSearchChange = vi.fn();
    const onSelectReason = vi.fn();
    const onSync = vi.fn();
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
      />
    );

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Reason pill
    fireEvent.click(screen.getByText('Reviews'));
    expect(onSelectReason).toHaveBeenCalledWith('review_requested');

    // Sync button
    fireEvent.click(screen.getByTitle('Refresh notifications (r)'));
    expect(onSync).toHaveBeenCalled();
  });
});
