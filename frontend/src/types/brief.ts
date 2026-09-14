/**
 * Types mirroring the payload from GET /api/brief.
 *
 * The server sends the complete ranked set in one response. Everything the
 * interface does afterwards - filtering, grouping, exporting - operates on
 * this object in memory, with no further requests.
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
  /** The last person other than you to speak, absent when that was you. */
  ball?: string;
  /** The project board column, absent when the item is not on a board. */
  project_status?: string;
  /** Why this item surfaced, stated as fact. */
  signal: string;
  /** The next step, empty when there is none. */
  action: string;
  checkout?: string;
  local?: string;
}

export interface BriefCounts {
  total: number;
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
