import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import type { EnrichedNotification } from '../types';

describe('components/CommandPalette', () => {
  const sampleItem: EnrichedNotification = {
    id: 'notif-1',
    github_id: '1',
    repository: 'owner/repo',
    title: 'PR for testing',
    type: 'PullRequest',
    reason: 'review_requested',
    url: '',
    html_url: 'https://github.com/owner/repo/pull/10',
    state: 'open',
    ci_status: 'success',
    author: 'alice',
    author_avatar: '',
    branch: 'feat/test',
    number: 10,
    unread: true,
    updated_at: new Date().toISOString(),
    triage: {
      notification_id: 'notif-1',
      bucket: 'action_required',
      status: 'inbox',
      pinned: false,
      notes: '',
      updated_at: new Date().toISOString(),
    },
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CommandPalette
        isOpen={false}
        onClose={vi.fn()}
        selectedItem={sampleItem}
        onSelectBucket={vi.fn()}
        onSelectRepo={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onOpenGitAssistant={vi.fn()}
        onToggleTheme={vi.fn()}
        currentTheme="dark"
        onToast={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders command list and filters on typing', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        selectedItem={sampleItem}
        onSelectBucket={vi.fn()}
        onSelectRepo={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onOpenGitAssistant={vi.fn()}
        onToggleTheme={vi.fn()}
        currentTheme="dark"
        onToast={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/Type a command or search actions/i)).toBeInTheDocument();
    expect(screen.getByText('Checkout branch: feat/test')).toBeInTheDocument();
    expect(screen.getByText('Open Git Assistant & Workflow Solver')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Type a command or search actions/i);
    fireEvent.change(searchInput, { target: { value: 'Assistant' } });

    expect(screen.getByText('Open Git Assistant & Workflow Solver')).toBeInTheDocument();
    expect(screen.queryByText('Checkout branch: feat/test')).not.toBeInTheDocument();
  });
});
