/**
 * Types mirroring the payload from GET /api/brief.
 *
 * The server sends the complete ranked set in one response. Everything the
 * interface does afterwards - filtering, grouping, collapsing, exporting -
 * operates on this object in memory, with no further requests.
 */

export type Lane =
  | 'unblock_others'
  | 'land_in_flight'
  | 'needs_decision'
  | 'pick_up_next';

export type ItemType = 'pull_request' | 'issue';

export interface BriefItem {
  lane: Lane;
  score: number;
  type: ItemType;
  number: number;
  title: string;
  url: string;
  repo: string;
  branch?: string;
  author?: string;
  state: string;
  review_decision?: string;
  mergeable?: string;
  ci?: string;
  age_days: number;
  last_activity: string;
  /** Why this item surfaced, stated as fact. */
  signal: string;
  /** The single next step, stated as an imperative. */
  action: string;
  checkout?: string;
  local?: string;
  /** True when there is nothing to do yet. Folded into a summary line. */
  passive?: boolean;
}

export interface BriefCounts {
  total: number;
  blocking: number;
}

export interface Brief {
  repo: string;
  viewer: string;
  generated_at: string;
  items: BriefItem[];
  counts: BriefCounts;
}

/** Lane display order and headings. Order here is render order. */
export const LANES: ReadonlyArray<{ id: Lane; label: string }> = [
  { id: 'unblock_others', label: 'Unblock others' },
  { id: 'land_in_flight', label: 'Land work in flight' },
  { id: 'needs_decision', label: 'Needs a decision' },
  { id: 'pick_up_next', label: 'Pick up next' },
];

/**
 * How many claimable items to show before collapsing.
 *
 * Claimable work made up roughly 60% of a real brief. It is browsing, not
 * doing, so it should not out-compete your blockers for vertical space.
 */
export const PICK_UP_NEXT_VISIBLE = 3;
