/**
 * A small brief shaped like a real one: every lane populated, one passive
 * item, and enough claimable work to trigger the collapse.
 */

import type { Brief, BriefItem, Lane } from '../types/brief';

export function item(overrides: Partial<BriefItem> & { number: number }): BriefItem {
  return {
    lane: 'pick_up_next',
    score: 50,
    type: 'pull_request',
    title: `Item ${overrides.number}`,
    url: `https://github.com/acme/widgets/pull/${overrides.number}`,
    repo: 'acme/widgets',
    state: 'OPEN',
    age_days: 3,
    last_activity: '2026-09-10T00:00:00Z',
    signal: 'something happened',
    action: 'do something',
    ...overrides,
  };
}

export function brief(items: BriefItem[]): Brief {
  return {
    repo: 'acme/widgets',
    viewer: 'ada',
    generated_at: '2026-09-14T06:00:00Z',
    items,
    counts: {
      total: items.length,
      blocking: items.filter((i) => i.lane === 'unblock_others').length,
    },
  };
}

export function sampleBrief(): Brief {
  return brief([
    item({
      number: 101,
      lane: 'unblock_others',
      score: 90,
      title: 'Add retry to the uploader',
      signal: 'grace requested your review today',
      action: 'Review and leave a decision',
      checkout: 'gh pr checkout 101',
      author: 'grace',
      branch: 'grace/retry',
    }),
    item({
      number: 202,
      lane: 'land_in_flight',
      score: 70,
      title: 'Drop the legacy exporter',
      signal: 'approved by grace, branch is behind main',
      action: 'Rebase, verify CI, then merge',
      checkout: 'gh pr checkout 202',
    }),
    item({
      number: 203,
      lane: 'land_in_flight',
      score: 40,
      title: 'Tidy the config loader',
      signal: 'waiting on review since yesterday',
      action: 'Nothing to do yet, nudge if it stalls',
      passive: true,
    }),
    item({
      number: 204,
      lane: 'land_in_flight',
      score: 39,
      title: 'Bump the pinned toolchain',
      signal: 'waiting on review since yesterday',
      action: 'Nothing to do yet, nudge if it stalls',
      passive: true,
    }),
    item({
      number: 301,
      lane: 'needs_decision',
      score: 30,
      type: 'issue',
      title: 'Flaky integration suite',
      signal: 'assigned to you 18d ago with no PR opened',
      action: 'Scope it, or hand it off',
    }),
    ...claimable(),
  ]);
}

function claimable(): BriefItem[] {
  return [401, 402, 403, 404, 405].map((number, index) =>
    item({
      number,
      lane: 'pick_up_next' as Lane,
      type: 'issue',
      score: 20 - index,
      title: `Claimable ${number}`,
      signal: 'open and unassigned for 4d',
      action: 'Claim it if it fits your current work',
    })
  );
}
