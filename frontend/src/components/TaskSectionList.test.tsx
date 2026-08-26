import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskSectionList } from './TaskSectionList';
import type { EnrichedNotification } from '../types';

describe('components/TaskSectionList', () => {
  const mockTasks: EnrichedNotification[] = [
    {
      id: 'task-review',
      github_id: '1',
      repository: 'owner/repo-a',
      title: 'Review: Refactor authentication system',
      type: 'PullRequest',
      reason: 'review_requested',
      url: '',
      html_url: 'https://github.com/owner/repo-a/pull/1',
      state: 'open',
      ci_status: 'success',
      author: 'alice',
      author_avatar: '',
      number: 1,
      unread: true,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'task-review',
        bucket: 'action_required',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'task-today',
      github_id: '2',
      repository: 'owner/repo-b',
      title: 'Focus: Fix database race condition',
      type: 'PullRequest',
      reason: 'author',
      url: '',
      html_url: 'https://github.com/owner/repo-b/pull/2',
      state: 'open',
      ci_status: 'failure',
      author: 'spencerjirehcebrian',
      author_avatar: '',
      number: 2,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'task-today',
        bucket: 'participating',
        status: 'inbox',
        pinned: true,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'task-issue',
      github_id: '3',
      repository: 'owner/repo-c',
      title: 'Issue: Investigate Flutter profiling deadlock',
      type: 'Issue',
      reason: 'assigned',
      url: '',
      html_url: 'https://github.com/owner/repo-c/issues/3',
      state: 'open',
      ci_status: '',
      author: 'charlie',
      author_avatar: '',
      number: 3,
      unread: false,
      updated_at: new Date().toISOString(),
      triage: {
        notification_id: 'task-issue',
        bucket: 'assigned',
        status: 'inbox',
        pinned: false,
        notes: '',
        updated_at: new Date().toISOString(),
      },
    },
  ];

  it('renders section headers and organizes tasks into correct sections', () => {
    const onSelectItem = vi.fn();

    render(
      <TaskSectionList
        notifications={mockTasks}
        selectedItemId="task-today"
        onSelectItem={onSelectItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getAllByText("Today's Focus")[0]).toBeInTheDocument();
    expect(screen.getByText('PRs Needing Your Review')).toBeInTheDocument();
    expect(screen.getByText('Assigned Issues & Tasks')).toBeInTheDocument();

    expect(screen.getByText('Focus: Fix database race condition')).toBeInTheDocument();
    expect(screen.getByText('Review: Refactor authentication system')).toBeInTheDocument();
    expect(screen.getByText('Issue: Investigate Flutter profiling deadlock')).toBeInTheDocument();
  });

  it('toggles section collapsing when clicking header', () => {
    render(
      <TaskSectionList
        notifications={mockTasks}
        selectedItemId="task-today"
        onSelectItem={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    const reviewHeader = screen.getByText('PRs Needing Your Review');
    expect(screen.getByText('Review: Refactor authentication system')).toBeInTheDocument();

    fireEvent.click(reviewHeader);
    expect(screen.queryByText('Review: Refactor authentication system')).not.toBeInTheDocument();
  });

  it('renders clean empty state when no tasks exist', () => {
    render(
      <TaskSectionList
        notifications={[]}
        selectedItemId={null}
        onSelectItem={vi.fn()}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByText('All Tasks Completed!')).toBeInTheDocument();
  });
});
