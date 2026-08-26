import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    const distance = formatDistanceToNowStrict(date);
    // Shorten format: "5 minutes" -> "5m", "2 hours" -> "2h", "1 day" -> "1d"
    return distance
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y') + ' ago';
  } catch {
    return '';
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text to clipboard', err);
    return false;
  }
}

export function parsePRMetadata(rawData?: string): import('../types').PRMetadata | null {
  if (!rawData || !rawData.trim()) return null;
  try {
    const parsed = JSON.parse(rawData);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // If not JSON, return body text directly if non-empty
    if (rawData.length > 5) {
      return { body: rawData };
    }
  }
  return null;
}

export function generateGitCommands(item: import('../types').EnrichedNotification) {
  const branch = item.branch || (item.number ? `pr-${item.number}` : 'main');
  const num = item.number || 0;
  const repo = item.repository || '';

  return {
    gitCheckout: `git checkout ${branch}`,
    gitCheckoutNew: `git checkout -b ${branch} origin/${branch}`,
    ghPrCheckout: num ? `gh pr checkout ${num}` : `git checkout ${branch}`,
    ghPrDiff: num ? `gh pr diff ${num}` : `git diff origin/main...${branch}`,
    ghPrView: num ? `gh pr view ${num}` : `gh issue view ${num}`,
    ghPrApprove: num ? `gh pr review ${num} --approve -b "LGTM!"` : '',
    ghPrMerge: num ? `gh pr merge ${num} --squash --delete-branch` : '',
    gitCherryPick: `git cherry-pick <commit-sha>`,
    gitApplyPatch: num ? `gh pr diff ${num} | git apply -v` : '',
    openCursor: `cursor://file/${repo}`,
    openVSCode: `vscode://file/${repo}`,
  };
}

