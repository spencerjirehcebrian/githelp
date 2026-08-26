import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectionCockpit } from './InspectionCockpit';
import type { EnrichedNotification } from '../types';

describe('components/InspectionCockpit', () => {
  const sampleItem: EnrichedNotification = {
    id: 'notif-1',
    github_id: '1',
    repository: 'owner/awesome-repo',
    title: 'Feat: Add biometric login support',
    type: 'PullRequest',
    reason: 'review_requested',
    url: '',
    html_url: 'https://github.com/owner/awesome-repo/pull/101',
    state: 'open',
    ci_status: 'success',
    author: 'alice',
    author_avatar: '',
    branch: 'feature/biometrics',
    number: 101,
    unread: true,
    updated_at: new Date().toISOString(),
    raw_data: JSON.stringify({
      body: 'Detailed PR summary for biometric support.',
      additions: 120,
      deletions: 15,
      changed_files: 2,
      comments_count: 4,
      labels: [{ name: 'security', color: 'd73a4a' }],
      files: [
        { filename: 'src/auth.ts', status: 'added', additions: 100, deletions: 0, patch: '+export function login() {}' },
        { filename: 'src/index.ts', status: 'modified', additions: 20, deletions: 15 }
      ],
      ci_details: [
        { name: 'Build & Lint', status: 'success', description: 'Passed in 30s' }
      ]
    }),
    triage: {
      notification_id: 'notif-1',
      bucket: 'action_required',
      status: 'inbox',
      pinned: false,
      notes: 'Initial review notes',
      updated_at: new Date().toISOString(),
    },
  };

  it('renders empty state when item is null', () => {
    render(
      <InspectionCockpit
        item={null}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByText('No Notification Selected')).toBeInTheDocument();
  });

  it('renders selected PR details, branch checkout, diff stats and tabs', () => {
    render(
      <InspectionCockpit
        item={sampleItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByText('Feat: Add biometric login support')).toBeInTheDocument();
    expect(screen.getByText('owner/awesome-repo')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.getByText('Detailed PR summary for biometric support.')).toBeInTheDocument();
    expect(screen.getByText('+120')).toBeInTheDocument();
    expect(screen.getByText('-15')).toBeInTheDocument();
    expect(screen.getByText('security')).toBeInTheDocument();
  });

  it('switches between Overview, Files Changed, and Git Recipes tabs', () => {
    render(
      <InspectionCockpit
        item={sampleItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    // Switch to Files Changed tab
    const filesTab = screen.getByRole('button', { name: /Files Changed/i });
    fireEvent.click(filesTab);
    expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();

    // Switch to Git Recipes tab
    const recipesTab = screen.getByRole('button', { name: /Git Recipes/i });
    fireEvent.click(recipesTab);
    expect(screen.getByText('1. Checkout & Switch to Branch')).toBeInTheDocument();
    expect(screen.getByText('git checkout feature/biometrics')).toBeInTheDocument();
  });

  it('allows editing and saving developer notes', () => {
    const onUpdateNotes = vi.fn();
    const onToast = vi.fn();

    render(
      <InspectionCockpit
        item={sampleItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onUpdateNotes={onUpdateNotes}
        onToast={onToast}
      />
    );

    // Switch to Notes tab
    const notesTab = screen.getByRole('button', { name: /Notes/i });
    fireEvent.click(notesTab);

    const textarea = screen.getByPlaceholderText(/Write your private review notes/i);
    expect(textarea).toHaveValue('Initial review notes');

    fireEvent.change(textarea, { target: { value: 'Updated review notes for testing' } });
    const saveBtn = screen.getByRole('button', { name: /Save Notes/i });
    fireEvent.click(saveBtn);

    expect(onUpdateNotes).toHaveBeenCalledWith('notif-1', 'Updated review notes for testing');
    expect(onToast).toHaveBeenCalledWith('Notes saved');
  });
});
