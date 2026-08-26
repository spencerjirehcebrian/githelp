import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectionDrawer } from './InspectionDrawer';
import type { EnrichedNotification } from '../types';

describe('components/InspectionDrawer', () => {
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
    author_avatar: '',
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

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <InspectionDrawer
        isOpen={false}
        onClose={vi.fn()}
        item={sampleItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders drawer with item details when isOpen is true', () => {
    const onClose = vi.fn();
    render(
      <InspectionDrawer
        isOpen={true}
        onClose={onClose}
        item={sampleItem}
        onMarkDone={vi.fn()}
        onOpenSnooze={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleUnread={vi.fn()}
        onToast={vi.fn()}
      />
    );

    expect(screen.getByTestId('inspection-drawer')).toBeInTheDocument();
    expect(screen.getByText('Feat: Add lightning-fast notification sync')).toBeInTheDocument();

    const closeBtn = screen.getByTitle('Close drawer (Esc)');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
