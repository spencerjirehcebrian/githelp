/**
 * Turns a fetched brief into what is actually on screen.
 *
 * Everything here is pure and synchronous so it can run inside a useMemo. The
 * server sends the full ranked set exactly once; filtering is a local
 * operation on that array, which is why typing in the filter box makes no
 * requests.
 *
 * Every item in the brief gets a row. The page used to cap the claimable lane
 * and fold anything you could not act on into a summary line, which meant the
 * page quietly decided what was worth your attention. Deciding is the user's
 * job. The only thing that removes a row is an explicit filter.
 */

import { LANES, type Brief, type BriefItem, type Lane } from '../types/brief';

/**
 * A navigable line. Rows are what `j` and `k` move between, so anything the
 * cursor can land on is one of these and anything it cannot is not.
 */
export interface Row {
  lane: Lane;
  item: BriefItem;
}

export interface LaneGroup {
  lane: Lane;
  label: string;
  rows: Row[];
}

export interface BriefView {
  groups: LaneGroup[];
  /** Every row in render order. The keyboard cursor indexes into this. */
  rows: Row[];
  /** Items surviving the filter. */
  matched: number;
  /** Items in the brief, ignoring the filter. */
  available: number;
}

export interface BuildViewOptions {
  brief: Brief | null;
  filter: string;
}

/**
 * Matches an item against the filter.
 *
 * The searchable surface is everything visible on the row plus the branch,
 * so that what you can read you can also find. Scoring metadata is excluded:
 * filtering by score is not a thing anyone wants to do.
 */
export function matchesFilter(item: BriefItem, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    item.title,
    `#${item.number}`,
    String(item.number),
    item.signal,
    item.action,
    item.author ?? '',
    item.branch ?? '',
    item.ball ?? '',
    item.project_status ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Builds the rendered view from a brief.
 *
 * Lane order comes from LANES rather than from the payload, so the render
 * order is a client decision and the server stays free to reorder scores.
 */
export function buildView({ brief, filter }: BuildViewOptions): BriefView {
  const empty: BriefView = { groups: [], rows: [], matched: 0, available: 0 };
  if (!brief) return empty;

  const needle = filter.trim().toLowerCase();
  const matching = brief.items.filter((item) => matchesFilter(item, needle));

  const groups: LaneGroup[] = [];
  const rows: Row[] = [];

  for (const { id, label } of LANES) {
    const laneRows = matching
      .filter((item) => item.lane === id)
      .map((item) => ({ lane: id, item }));
    if (laneRows.length === 0) continue;

    groups.push({ lane: id, label, rows: laneRows });
    rows.push(...laneRows);
  }

  return {
    groups,
    rows,
    matched: matching.length,
    available: brief.items.length,
  };
}

/** Stable React key for a row. */
export function rowKey(row: Row): string {
  return `${row.item.repo}#${row.item.type}#${row.item.number}`;
}
