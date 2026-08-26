import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCard } from './NotificationCard';
import type { EnrichedNotification } from '../types';

describe('components/NotificationCard', () => {
  const sampleItem: EnrichedNotification = {
    id: 'notif-1',
    github_id: '1',
    repository: 'owner/awesome-repo',
    title: 'Feat: Add lightning-fast notification sync',
    type: 'PullRequest',
    reason: 'review_requested',
    url: '',
    html_url: 'https://github.com/owner/awesome-repo/pull/42',
    state: 'open',
    ci_status: 'success',
    author: 'alice',
    author_avatar: 'https://avatar.test/alice.png',
    branch: 'feat/fast-sync',
    number: 42,
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

  it('renders notification title, repo, reason badge, and branch', () => {
    render(
      <NotificationCard
        item={sampleItem}
        isSelected={false}
        onSelect={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
        showCI={true}
      />
    );

    expect(screen.getByText('Feat: Add lightning-fast notification sync')).toBeInTheDocument();
    expect(screen.getByText('awesome-repo')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('feat/fast-sync')).toBeInTheDocument();
  });

  it('triggers onMarkDone when checkbox or complete button is clicked', () => {
    const onMarkDone = vi.fn();
    render(
      <NotificationCard
        item={sampleItem}
        isSelected={false}
        onSelect={vi.fn()}
        onMarkDone={onMarkDone}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    const doneBtn = screen.getByTitle('Complete task (Space / e)');
    fireEvent.click(doneBtn);
    expect(onMarkDone).toHaveBeenCalledWith('notif-1');
  });

  it('triggers onOpenSnooze when snooze button is clicked', () => {
    const onOpenSnooze = vi.fn();
    render(
      <NotificationCard
        item={sampleItem}
        isSelected={false}
        onSelect={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={onOpenSnooze}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    const snoozeBtn = screen.getByTitle('Snooze (z)');
    fireEvent.click(snoozeBtn);
    expect(onOpenSnooze).toHaveBeenCalledWith('notif-1');
  });
});
