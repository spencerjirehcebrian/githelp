/**
 * A brief shaped like a real one, served to the browser instead of GitHub.
 *
 * Using a fixture rather than live data makes these tests deterministic and
 * lets them run without credentials, while still exercising the real server,
 * the real bundle, and the real keyboard handling.
 */

export interface BriefItemFixture {
  lane: string;
  score: number;
  type: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  state: string;
  age_days: number;
  last_activity: string;
  signal: string;
  action: string;
  ball?: string;
  project_status?: string;
  checkout?: string;
}

const REPO = 'acme/widgets';

function item(overrides: Partial<BriefItemFixture> & { number: number }): BriefItemFixture {
  return {
    lane: 'pick_up_next',
    score: 10,
    type: 'pull_request',
    title: `Item ${overrides.number}`,
    url: `https://github.com/${REPO}/pull/${overrides.number}`,
    repo: REPO,
    state: 'OPEN',
    age_days: 3,
    last_activity: '2026-09-13T00:00:00Z',
    signal: 'something happened',
    action: 'do something',
    ...overrides,
  };
}

export const BRIEF_ITEMS: BriefItemFixture[] = [
  item({
    number: 101,
    lane: 'unblock_others',
    score: 95,
    title: 'Add retry to the uploader',
    signal: 'grace requested your review today',
    action: 'Review it',
    checkout: 'gh pr checkout 101',
  }),
  item({
    number: 102,
    lane: 'unblock_others',
    score: 88,
    title: 'Split the ingest worker',
    signal: 'hopper commented 3d ago and has not had a reply',
    action: 'Reply to hopper',
    ball: 'hopper',
    checkout: 'gh pr checkout 102',
  }),
  item({
    number: 202,
    lane: 'land_in_flight',
    score: 70,
    title: 'Drop the legacy exporter',
    signal: 'approved by grace, branch is behind main',
    action: 'Update branch, then merge',
    checkout: 'gh pr checkout 202',
  }),
  item({
    number: 203,
    lane: 'land_in_flight',
    score: 41,
    title: 'Tidy the config loader',
    signal: 'waiting on grace to review',
    action: '',
  }),
  item({
    number: 204,
    lane: 'land_in_flight',
    score: 40,
    title: 'Bump the pinned toolchain',
    signal: 'waiting on grace to review',
    action: '',
  }),
  item({
    number: 301,
    lane: 'needs_decision',
    score: 30,
    type: 'issue',
    title: 'Flaky integration suite',
    signal: 'assigned to you 18d ago with no PR opened, board status Todo',
    action: 'Scope it',
    project_status: 'Todo',
  }),
  ...[401, 402, 403, 404, 405].map((number, index) =>
    item({
      number,
      type: 'issue',
      score: 20 - index,
      title: `Claimable ${number}`,
      signal: 'open and unassigned for 4d',
      action: '',
    })
  ),
];

export function briefPayload(items = BRIEF_ITEMS) {
  return {
    repo: REPO,
    viewer: 'ada',
    generated_at: new Date().toISOString(),
    items,
    counts: { total: items.length },
  };
}
