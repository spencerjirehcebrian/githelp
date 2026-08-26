import { describe, it, expect } from 'vitest';
import { cn, formatTimeAgo, copyToClipboard, parsePRMetadata, generateGitCommands } from './utils';

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
  });
});
