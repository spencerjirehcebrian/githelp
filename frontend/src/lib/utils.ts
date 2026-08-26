import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type {
  EnrichedNotification,
  PRMetadata,
  TaskSectionId,
  TaskBurndownMetrics,
  PipelineColumnId,
  VisibilityMetrics,
} from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    const distance = formatDistanceToNowStrict(date);
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

export function parsePRMetadata(rawData?: string): PRMetadata | null {
  if (!rawData || !rawData.trim()) return null;
  try {
    const parsed = JSON.parse(rawData);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    if (rawData.length > 5) {
      return { body: rawData };
    }
  }
  return null;
}

export function generateGitCommands(item: EnrichedNotification) {
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

export function categorizeIntoTaskSections(
  notifications: EnrichedNotification[]
): Record<TaskSectionId, EnrichedNotification[]> {
  const result: Record<TaskSectionId, EnrichedNotification[]> = {
    today: [],
    reviews: [],
    authored: [],
    issues: [],
    completed: [],
  };

  for (const item of notifications) {
    const isDone = item.triage?.status === 'done';
    const isPinned = item.triage?.pinned === true;

    if (isDone) {
      result.completed.push(item);
      continue;
    }

    if (isPinned) {
      result.today.push(item);
      continue;
    }

    if (item.type === 'Issue') {
      result.issues.push(item);
      continue;
    }

    const isAuthor =
      item.reason === 'author' ||
      item.triage?.bucket === 'participating';

    const isReview =
      item.reason === 'review_requested' ||
      (item.triage?.bucket === 'action_required' && !isAuthor);

    if (isReview) {
      result.reviews.push(item);
    } else if (isAuthor || item.type === 'PullRequest') {
      result.authored.push(item);
    } else {
      result.issues.push(item);
    }
  }

  return result;
}

export function computeTaskBurndownMetrics(
  notifications: EnrichedNotification[]
): TaskBurndownMetrics {
  let todayTotal = 0;
  let todayCompleted = 0;
  let reviewsCount = 0;
  let authoredCount = 0;
  let issuesCount = 0;
  let completedCount = 0;

  for (const item of notifications) {
    const isDone = item.triage?.status === 'done';
    const isPinned = item.triage?.pinned === true;

    if (isDone) {
      completedCount++;
      if (isPinned) {
        todayCompleted++;
        todayTotal++;
      }
      continue;
    }

    if (isPinned) {
      todayTotal++;
    }

    if (item.type === 'Issue') {
      issuesCount++;
      continue;
    }

    const isAuthor =
      item.reason === 'author' ||
      item.triage?.bucket === 'participating';

    const isReview =
      item.reason === 'review_requested' ||
      (item.triage?.bucket === 'action_required' && !isAuthor);

    if (isReview) {
      reviewsCount++;
    } else if (isAuthor || item.type === 'PullRequest') {
      authoredCount++;
    } else {
      issuesCount++;
    }
  }

  return {
    todayTotal,
    todayCompleted,
    reviewsCount,
    authoredCount,
    issuesCount,
    completedCount,
  };
}

export function categorizeIntoPipeline(
  notifications: EnrichedNotification[]
): Record<PipelineColumnId, EnrichedNotification[]> {
  const result: Record<PipelineColumnId, EnrichedNotification[]> = {
    review_required: [],
    ci_failing: [],
    ready_to_merge: [],
    waiting: [],
  };

  for (const item of notifications) {
    const isCiFailed =
      item.ci_status === 'failure' ||
      item.ci_status === 'error' ||
      item.reason === 'ci_activity';
    const isReviewReq =
      item.reason === 'review_requested' || item.triage?.bucket === 'action_required';
    const isReady =
      item.type === 'PullRequest' &&
      item.state === 'open' &&
      item.ci_status === 'success';

    if (isCiFailed) {
      result.ci_failing.push(item);
    } else if (isReviewReq) {
      result.review_required.push(item);
    } else if (isReady) {
      result.ready_to_merge.push(item);
    } else {
      result.waiting.push(item);
    }
  }

  return result;
}

export function computeVisibilityMetrics(
  notifications: EnrichedNotification[]
): VisibilityMetrics {
  let blockersCount = 0;
  let ciFailingCount = 0;
  let readyToMergeCount = 0;
  let staleCount = 0;

  const threeDaysAgoMs = Date.now() - 3 * 24 * 60 * 60 * 1000;

  for (const item of notifications) {
    if (item.reason === 'review_requested' || item.triage?.bucket === 'action_required') {
      blockersCount++;
    }
    if (
      item.ci_status === 'failure' ||
      item.ci_status === 'error' ||
      item.reason === 'ci_activity'
    ) {
      ciFailingCount++;
    }
    if (
      item.type === 'PullRequest' &&
      item.ci_status === 'success' &&
      item.state === 'open'
    ) {
      readyToMergeCount++;
    }
    if (item.updated_at) {
      try {
        const itemTime = parseISO(item.updated_at).getTime();
        if (itemTime < threeDaysAgoMs) {
          staleCount++;
        }
      } catch {
        // ignore parse error
      }
    }
  }

  return {
    blockersCount,
    ciFailingCount,
    readyToMergeCount,
    staleCount,
  };
}
