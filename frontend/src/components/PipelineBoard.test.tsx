import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PipelineBoard } from './PipelineBoard';
import type { EnrichedNotification } from '../types';

describe('components/PipelineBoard', () => {
  const mockNotifications: EnrichedNotification[] = [
    {
      id: 'notif-review',
      github_id: '1',
      repository: 'owner/repo-a',
      title: 'Review: Refactor authentication system',
      type: 'PullRequest',
      reason: 'review_requested',
      url: '',
      html_url: 'https://github.com/owner/repo-a/pull/1',
      state: 'open',
      ci_status: 'pending',
      author: 'alice',
      author_avatar: '',
      branch: 'feat/auth',
      number: 1,
      unread: true,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'notif-review',
        bucket: 'action_required',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'notif-ci',
      github_id: '2',
      repository: 'owner/repo-b',
      title: 'Fix: Database race condition',
      type: 'PullRequest',
      reason: 'ci_activity',
      url: '',
      html_url: 'https://github.com/owner/repo-b/pull/2',
      state: 'open',
      ci_status: 'failure',
      author: 'bob',
      author_avatar: '',
      branch: 'fix/db-race',
      number: 2,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'notif-ci',
        bucket: 'action_required',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'notif-ready',
      github_id: '3',
      repository: 'owner/repo-c',
      title: 'Feat: Add CLI command helper',
      type: 'PullRequest',
      reason: 'author',
      url: '',
      html_url: 'https://github.com/owner/repo-c/pull/3',
      state: 'open',
      ci_status: 'success',
      author: 'carol',
      author_avatar: '',
      branch: 'feat/cli',
      number: 3,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'notif-ready',
        bucket: 'participating',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'notif-waiting',
      github_id: '4',
      repository: 'owner/repo-d',
      title: 'Discussion: Architectural RFC',
      type: 'Issue',
      reason: 'mention',
      url: '',
      html_url: 'https://github.com/owner/repo-d/issues/4',
      state: 'open',
      ci_status: '',
      author: 'dave',
      author_avatar: '',
      number: 4,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'notif-waiting',
        bucket: 'mentions',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
  ];

  it('renders all 4 pipeline columns and distributes items accurately', () => {
    const onSelectItem = vi.fn();
    const onSelectColumn = vi.fn();

    render(
      <PipelineBoard
        notifications={mockNotifications}
        selectedItemId="notif-review"
        onSelectItem={onSelectItem}
        activeColumnId="review_required"
        onSelectColumn={onSelectColumn}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByText('Needs Your Review')).toBeInTheDocument();
    expect(screen.getByText('CI Failing')).toBeInTheDocument();
    expect(screen.getByText('Ready to Merge')).toBeInTheDocument();
    expect(screen.getByText('Waiting on Others')).toBeInTheDocument();

    // Check items exist in the document
    expect(screen.getByText('Review: Refactor authentication system')).toBeInTheDocument();
    expect(screen.getByText('Fix: Database race condition')).toBeInTheDocument();
    expect(screen.getByText('Feat: Add CLI command helper')).toBeInTheDocument();
    expect(screen.getByText('Discussion: Architectural RFC')).toBeInTheDocument();

    // Clicking column triggers onSelectColumn
    fireEvent.click(screen.getByTestId('pipeline-column-ci_failing'));
    expect(onSelectColumn).toHaveBeenCalledWith('ci_failing');

    // Clicking a card triggers onSelectItem
    fireEvent.click(screen.getByText('Fix: Database race condition'));
    expect(onSelectItem).toHaveBeenCalled();
  });

  it('renders empty column state when there are no items in that stage', () => {
    render(
      <PipelineBoard
        notifications={[]}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        activeColumnId="review_required"
        onSelectColumn={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByText('No pending reviews')).toBeInTheDocument();
    expect(screen.getByText('All CI checks passing')).toBeInTheDocument();
  });
});
