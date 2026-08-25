import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { StatusResponse } from '../types';

describe('components/Sidebar', () => {
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

  it('renders buckets with badge counts', () => {
    render(
      <Sidebar
        status={mockStatus}
        selectedBucket="action_required"
        onSelectBucket={vi.fn()}
        selectedRepo=""
        onSelectRepo={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Waiting on Others')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('owner/repo-a')).toBeInTheDocument();
    expect(screen.getByText('Spencer')).toBeInTheDocument();
  });

  it('calls onSelectBucket when clicking a bucket', () => {
    const onSelectBucket = vi.fn();
    render(
      <Sidebar
        status={mockStatus}
        selectedBucket="action_required"
        onSelectBucket={onSelectBucket}
        selectedRepo=""
        onSelectRepo={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Waiting on Others'));
    expect(onSelectBucket).toHaveBeenCalledWith('waiting_on_others');
  });
});
