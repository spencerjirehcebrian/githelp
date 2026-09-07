import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StandupView } from './StandupView';
import * as api from '../lib/api';
import * as utils from '../lib/utils';
import type { StandupResponse, ClaimableIssue } from '../types';

vi.mock('../lib/api');
vi.mock('../lib/utils', async () => {
  const actual = await vi.importActual('../lib/utils');
  return {
    ...actual,
    copyToClipboard: vi.fn().mockResolvedValue(true),
  };
});

describe('components/StandupView', () => {
  const mockStandup: StandupResponse = {
    date: '2026-09-07',
    formatted_text: `Merged:
#101(merged) - Fix edge case in auth token refresher

For Review:
#102(for review) - Add persistent worktree scanner (waiting on @keith / approved by @antonio)

Done:
- Completed documentation verification
- #101: Fix edge case in auth token refresher

Todo:
- Deploy staging containers`,
    is_saved: false,
    merged: ['#101(merged) - Fix edge case in auth token refresher'],
    for_review: ['#102(for review) - Add persistent worktree scanner (waiting on @keith / approved by @antonio)'],
    done: ['Completed documentation verification', '#101: Fix edge case in auth token refresher'],
    todo: ['Deploy staging containers'],
  };

  const mockBacklog: ClaimableIssue[] = [
    {
      id: 'issue-1',
      github_id: '1',
      repository: 'theteamatx/x-benjamin-repo',
      title: 'Support multi-repo GraphQL query pagination',
      type: 'Issue',
      reason: 'assign',
      url: 'https://api.github.com/repos/theteamatx/x-benjamin-repo/issues/205',
      html_url: 'https://github.com/theteamatx/x-benjamin-repo/issues/205',
      state: 'open',
      author: 'antonio',
      author_avatar: '',
      ci_status: '',
      number: 205,
      unread: false,
      updated_at: '2026-09-07T01:00:00Z',
      days_open: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getStandup).mockResolvedValue(mockStandup);
    vi.mocked(api.getBacklog).mockResolvedValue(mockBacklog);
    vi.mocked(api.saveStandup).mockResolvedValue({ status: 'ok', date: '2026-09-07' });
  });

  it('loads and renders the standup and claimable backlog', async () => {
    const onToast = vi.fn();
    render(<StandupView onToast={onToast} trackedRepo="theteamatx/x-benjamin-repo" />);

    expect(screen.getByText('Loading daily repository state...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Rad Standup & Claimable Backlog')).toBeInTheDocument();
      expect(screen.getByText('Claimable Backlog')).toBeInTheDocument();
    });

    expect(screen.getByText('Rad Standup Snippet')).toBeInTheDocument();
    expect(screen.getByText('Support multi-repo GraphQL query pagination')).toBeInTheDocument();
    expect(screen.getByText('#205')).toBeInTheDocument();
  });

  it('copies standup text to clipboard on button click', async () => {
    const onToast = vi.fn();
    render(<StandupView onToast={onToast} trackedRepo="theteamatx/x-benjamin-repo" />);

    await waitFor(() => {
      expect(screen.getByText('Copy Rad Standup (c)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copy Rad Standup (c)'));

    await waitFor(() => {
      expect(utils.copyToClipboard).toHaveBeenCalledWith(mockStandup.formatted_text);
      expect(onToast).toHaveBeenCalledWith('Rad Standup copied to clipboard');
    });
  });

  it('allows editing and saving customized standup text', async () => {
    const onToast = vi.fn();
    render(<StandupView onToast={onToast} trackedRepo="theteamatx/x-benjamin-repo" />);

    await waitFor(() => {
      expect(screen.getByText('Edit (e)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit (e)'));

    const textarea = screen.getByPlaceholderText('Draft your standup...');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Customized standup notes' } });
    fireEvent.click(screen.getByText('Save Standup'));

    await waitFor(() => {
      expect(api.saveStandup).toHaveBeenCalledWith(
        expect.any(String),
        'Customized standup notes'
      );
      expect(onToast).toHaveBeenCalledWith('Standup saved to local database');
    });
  });

  it('saves standup text on Cmd+Enter shortcut inside textarea', async () => {
    const onToast = vi.fn();
    render(<StandupView onToast={onToast} trackedRepo="theteamatx/x-benjamin-repo" />);

    await waitFor(() => {
      expect(screen.getByText('Edit (e)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit (e)'));

    const textarea = screen.getByPlaceholderText('Draft your standup...');
    fireEvent.change(textarea, { target: { value: 'Shortcut saved standup' } });

    // Press Cmd+Enter inside the textarea
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    await waitFor(() => {
      expect(api.saveStandup).toHaveBeenCalledWith(
        expect.any(String),
        'Shortcut saved standup'
      );
      expect(onToast).toHaveBeenCalledWith('Standup saved to local database');
    });
  });

  it('supports inspecting claimable issue from backlog', async () => {
    const onToast = vi.fn();
    const onInspectItem = vi.fn();
    render(
      <StandupView
        onToast={onToast}
        onInspectItem={onInspectItem}
        trackedRepo="theteamatx/x-benjamin-repo"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Inspect (i)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Inspect (i)'));

    expect(onInspectItem).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Support multi-repo GraphQL query pagination',
        number: 205,
      })
    );
  });

  it('loads with undefined trackedRepo falling back to server default', async () => {
    const onToast = vi.fn();
    render(<StandupView onToast={onToast} />);

    await waitFor(() => {
      expect(api.getStandup).toHaveBeenCalledWith(expect.any(String), undefined);
      expect(api.getBacklog).toHaveBeenCalledWith(undefined);
    });
  });
});
