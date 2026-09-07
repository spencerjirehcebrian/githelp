import { describe, it, expect } from 'vitest';
import {
  cn,
  formatTimeAgo,
  copyToClipboard,
  parsePRMetadata,
  generateGitCommands,
  categorizeIntoPipeline,
  computeVisibilityMetrics,
  categorizeIntoTaskSections,
  computeTaskBurndownMetrics,
} from './utils';

describe('lib/utils', () => {
  it('cn should merge class names and resolve tailwind collisions', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', false && 'hidden', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('formatTimeAgo should format dates relatively', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    expect(formatTimeAgo(fiveMinutesAgo)).toBe('5m ago');
    expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago');
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago');
    expect(formatTimeAgo('')).toBe('');
    expect(formatTimeAgo('invalid-date')).toBe('');
  });

  it('copyToClipboard should write to clipboard and return true', async () => {
    const res = await copyToClipboard('git checkout main');
    expect(res).toBe(true);
  });

  it('parsePRMetadata should parse json or fallback to body', () => {
    const jsonStr = JSON.stringify({ body: 'test body', additions: 10 });
    expect(parsePRMetadata(jsonStr)).toEqual({ body: 'test body', additions: 10 });
    expect(parsePRMetadata(undefined)).toBeNull();
    expect(parsePRMetadata('')).toBeNull();
    expect(parsePRMetadata('simple text description')).toEqual({ body: 'simple text description' });
  });

  it('generateGitCommands should produce valid Git and gh CLI commands', () => {
    const item: any = {
      branch: 'feature/auth',
      number: 42,
      repository: 'owner/repo',
    };
    const cmds = generateGitCommands(item);
    expect(cmds.gitCheckout).toBe('git checkout feature/auth');
    expect(cmds.ghPrCheckout).toBe('gh pr checkout 42');
    expect(cmds.ghPrDiff).toBe('gh pr diff 42');
    expect(cmds.openCursor).toBe('cursor://file/owner/repo');
    expect(cmds.openVSCode).toBe('vscode://file/owner/repo');

    // With local_worktree_path
    const worktreeItem: any = {
      ...item,
      local_worktree_path: '/Users/test/git/worktree-repo',
    };
    const wtCmds = generateGitCommands(worktreeItem);
    expect(wtCmds.openCursor).toBe('cursor://file/Users/test/git/worktree-repo');
    expect(wtCmds.openVSCode).toBe('vscode://file/Users/test/git/worktree-repo');
  });

  it('categorizeIntoTaskSections should correctly sort into task sections', () => {
    const items: any[] = [
      { id: '1', reason: 'review_requested', type: 'PullRequest', triage: { bucket: 'action_required', pinned: false, status: 'inbox' } },
      { id: '2', reason: 'author', type: 'PullRequest', triage: { bucket: 'participating', pinned: true, status: 'inbox' } },
      { id: '3', type: 'Issue', reason: 'assigned', triage: { bucket: 'assigned', pinned: false, status: 'inbox' } },
      { id: '4', reason: 'author', type: 'PullRequest', triage: { bucket: 'participating', pinned: false, status: 'inbox' } },
      { id: '5', reason: 'comment', type: 'Issue', triage: { bucket: 'done', pinned: false, status: 'done' } },
    ];

    const sections = categorizeIntoTaskSections(items);
    expect(sections.today.map((i) => i.id)).toEqual(['2']);
    expect(sections.reviews.map((i) => i.id)).toEqual(['1']);
    expect(sections.authored.map((i) => i.id)).toEqual(['4']);
    expect(sections.issues.map((i) => i.id)).toEqual(['3']);
    expect(sections.completed.map((i) => i.id)).toEqual(['5']);
  });

  it('computeTaskBurndownMetrics should count today totals, reviews, and completed items', () => {
    const items: any[] = [
      { id: '1', reason: 'review_requested', type: 'PullRequest', triage: { bucket: 'action_required', pinned: true, status: 'inbox' } },
      { id: '2', reason: 'author', type: 'PullRequest', triage: { bucket: 'participating', pinned: true, status: 'done' } },
      { id: '3', type: 'Issue', reason: 'assigned', triage: { bucket: 'assigned', pinned: false, status: 'inbox' } },
    ];

    const metrics = computeTaskBurndownMetrics(items);
    expect(metrics.todayTotal).toBe(2);
    expect(metrics.todayCompleted).toBe(1);
    expect(metrics.reviewsCount).toBe(1);
    expect(metrics.issuesCount).toBe(1);
    expect(metrics.completedCount).toBe(1);
  });

  it('categorizeIntoPipeline should sort items into correct columns', () => {
    const items: any[] = [
      { id: '1', reason: 'review_requested', triage: { bucket: 'action_required' }, ci_status: 'pending' },
      { id: '2', reason: 'ci_activity', ci_status: 'failure', triage: { bucket: 'action_required' } },
      { id: '3', type: 'PullRequest', state: 'open', ci_status: 'success', triage: { bucket: 'participating' } },
      { id: '4', reason: 'mention', triage: { bucket: 'mentions' }, ci_status: 'pending' },
    ];

    const pipeline = categorizeIntoPipeline(items);
    expect(pipeline.ci_failing.map((i) => i.id)).toEqual(['2']);
    expect(pipeline.review_required.map((i) => i.id)).toEqual(['1']);
    expect(pipeline.ready_to_merge.map((i) => i.id)).toEqual(['3']);
    expect(pipeline.waiting.map((i) => i.id)).toEqual(['4']);
  });

  it('computeVisibilityMetrics should calculate blockers, CI failures, and ready counts', () => {
    const items: any[] = [
      { id: '1', reason: 'review_requested', triage: { bucket: 'action_required' }, ci_status: 'pending', updated_at: new Date().toISOString() },
      { id: '2', reason: 'mention', ci_status: 'failure', triage: { bucket: 'mentions' }, updated_at: new Date(Date.now() - 4 * 86400000).toISOString() },
      { id: '3', type: 'PullRequest', state: 'open', ci_status: 'success', triage: { bucket: 'participating' }, updated_at: new Date().toISOString() },
    ];

    const metrics = computeVisibilityMetrics(items);
    expect(metrics.blockersCount).toBe(1);
    expect(metrics.ciFailingCount).toBe(1);
    expect(metrics.readyToMergeCount).toBe(1);
    expect(metrics.staleCount).toBe(1);
  });
});
