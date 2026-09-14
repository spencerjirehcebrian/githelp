/**
 * Turns a fetched brief into what is actually on screen.
 *
 * Everything here is pure and synchronous so it can run inside a useMemo. The
 * server sends the full ranked set exactly once; filtering and collapsing are
 * local operations on that array, which is why typing in the filter box makes
 * no requests.
 *
 * Two collapse rules keep the page short enough to read in one pass:
 *
 *   1. Passive items - work whose only instruction is to wait - are pulled out
 *      of their lane and folded into a single summary line.
 *   2. Pick up next is capped, because claimable work is browsing rather than
 *      doing and should not out-compete your blockers for vertical space.
 */

import {
  LANES,
  PICK_UP_NEXT_VISIBLE,
  type Brief,
  type BriefItem,
  type Lane,
} from '../types/brief';

/**
 * A navigable line. Rows are what `j` and `k` move between, so anything the
 * cursor can land on is one of these and anything it cannot is not.
 */
export type Row =
  | { kind: 'item'; lane: Lane; item: BriefItem }
  | { kind: 'more'; lane: Lane; count: number };

export interface LaneGroup {
  lane: Lane;
  label: string;
  rows: Row[];
  /** One line standing in for every passive item in this lane. */
  summary: string | null;
  /** Items in this lane after filtering, including collapsed ones. */
  total: number;
}

export interface BriefView {
  groups: LaneGroup[];
  /** Every row in render order. The keyboard cursor indexes into this. */
  rows: Row[];
  /** Items surviving the filter, before any collapsing. */
  matched: number;
  /** Items in the brief, ignoring the filter. */
  available: number;
}

export interface BuildViewOptions {
  brief: Brief | null;
  filter: string;
  /** Lanes the user has expanded past their collapse cap. */
  expanded: ReadonlySet<Lane>;
}

/** How many issue numbers a summary line names before it gives up. */
const SUMMARY_NUMBER_LIMIT = 8;

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
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * Collapses a lane's passive items into one line.
 *
 * Returns null when there is nothing to summarize, which keeps the caller
 * free of empty-string checks.
 */
export function summarizePassive(items: BriefItem[]): string | null {
  if (items.length === 0) return null;

  const numbers = items.map((item) => `#${item.number}`);
  const shown = numbers.slice(0, SUMMARY_NUMBER_LIMIT);
  const hidden = numbers.length - shown.length;
  const tail = hidden > 0 ? `${shown.join(', ')} and ${hidden} more` : shown.join(', ');

  return `${items.length} ${nounFor(items)} waiting on reviewers: ${tail}`;
}

/** Picks the plural noun that honestly describes a set of items. */
function nounFor(items: BriefItem[]): string {
  const plural = items.length !== 1;
  const allPRs = items.every((item) => item.type === 'pull_request');
  const allIssues = items.every((item) => item.type === 'issue');

  if (allPRs) return plural ? 'PRs' : 'PR';
  if (allIssues) return plural ? 'issues' : 'issue';
  return plural ? 'items' : 'item';
}

/** The cap on a lane, or null when the lane is never collapsed. */
function visibleLimit(lane: Lane): number | null {
  return lane === 'pick_up_next' ? PICK_UP_NEXT_VISIBLE : null;
}

/**
 * Builds the rendered view from a brief.
 *
 * Lane order comes from LANES rather than from the payload, so the render
 * order is a client decision and the server stays free to reorder scores.
 */
export function buildView({ brief, filter, expanded }: BuildViewOptions): BriefView {
  const empty: BriefView = { groups: [], rows: [], matched: 0, available: 0 };
  if (!brief) return empty;

  const needle = filter.trim().toLowerCase();
  const matching = brief.items.filter((item) => matchesFilter(item, needle));

  const groups: LaneGroup[] = [];
  const rows: Row[] = [];

  for (const { id, label } of LANES) {
    const inLane = matching.filter((item) => item.lane === id);
    if (inLane.length === 0) continue;

    const active = inLane.filter((item) => !item.passive);
    const passive = inLane.filter((item) => item.passive);

    // A filter is an explicit request to see matches, so honour it over the
    // cap. Collapsing results the user just searched for would be perverse.
    const limit = needle || expanded.has(id) ? null : visibleLimit(id);
    const visible = limit === null ? active : active.slice(0, limit);
    const hidden = active.length - visible.length;

    const laneRows: Row[] = visible.map((item) => ({
      kind: 'item' as const,
      lane: id,
      item,
    }));
    if (hidden > 0) {
      laneRows.push({ kind: 'more', lane: id, count: hidden });
    }

    groups.push({
      lane: id,
      label,
      rows: laneRows,
      summary: summarizePassive(passive),
      total: inLane.length,
    });
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
  return row.kind === 'item'
    ? `${row.item.repo}#${row.item.type}#${row.item.number}`
    : `more:${row.lane}`;
}
