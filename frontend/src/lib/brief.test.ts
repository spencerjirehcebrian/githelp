import { describe, expect, it } from 'vitest';
import { buildView, matchesFilter, rowKey, summarizePassive } from './brief';
import { brief, item, sampleBrief } from '../test/brief-fixture';
import type { Lane } from '../types/brief';

const NONE: ReadonlySet<Lane> = new Set();

describe('matchesFilter', () => {
  const subject = item({
    number: 4242,
    title: 'Add retry to the uploader',
    signal: 'grace requested your review',
    action: 'Review and leave a decision',
    author: 'grace',
    branch: 'grace/retry',
  });

  it('matches an empty filter', () => {
    expect(matchesFilter(subject, '')).toBe(true);
  });

  it.each([
    ['title', 'uploader'],
    ['number', '4242'],
    ['number with hash', '#4242'],
    ['signal', 'requested'],
    ['action', 'decision'],
    ['author', 'grace'],
    ['branch', 'grace/retry'],
  ])('matches on %s', (_label, needle) => {
    expect(matchesFilter(subject, needle)).toBe(true);
  });

  it('rejects a term that appears nowhere', () => {
    expect(matchesFilter(subject, 'kubernetes')).toBe(false);
  });
});

describe('summarizePassive', () => {
  it('returns null when there is nothing to fold', () => {
    expect(summarizePassive([])).toBeNull();
  });

  it('names the items it stands in for', () => {
    const summary = summarizePassive([item({ number: 11 }), item({ number: 12 })]);
    expect(summary).toBe('2 PRs waiting on reviewers: #11, #12');
  });

  it('uses the singular for one item', () => {
    expect(summarizePassive([item({ number: 11 })])).toBe(
      '1 PR waiting on reviewers: #11'
    );
  });

  it('says items when the types are mixed', () => {
    const summary = summarizePassive([
      item({ number: 11 }),
      item({ number: 12, type: 'issue' }),
    ]);
    expect(summary).toContain('2 items waiting on reviewers');
  });

  it('stops naming numbers past the limit', () => {
    const many = Array.from({ length: 11 }, (_, index) => item({ number: index + 1 }));
    expect(summarizePassive(many)).toBe(
      '11 PRs waiting on reviewers: #1, #2, #3, #4, #5, #6, #7, #8 and 3 more'
    );
  });
});

describe('buildView', () => {
  it('produces an empty view without a brief', () => {
    const view = buildView({ brief: null, filter: '', expanded: NONE });
    expect(view).toEqual({ groups: [], rows: [], matched: 0, available: 0 });
  });

  it('renders lanes in priority order, not payload order', () => {
    const shuffled = brief([
      item({ number: 1, lane: 'pick_up_next' }),
      item({ number: 2, lane: 'unblock_others' }),
      item({ number: 3, lane: 'needs_decision' }),
      item({ number: 4, lane: 'land_in_flight' }),
    ]);

    const view = buildView({ brief: shuffled, filter: '', expanded: NONE });
    expect(view.groups.map((group) => group.lane)).toEqual([
      'unblock_others',
      'land_in_flight',
      'needs_decision',
      'pick_up_next',
    ]);
  });

  it('omits lanes with nothing in them', () => {
    const only = brief([item({ number: 1, lane: 'unblock_others' })]);
    const view = buildView({ brief: only, filter: '', expanded: NONE });
    expect(view.groups).toHaveLength(1);
  });

  it('pulls passive items out of their lane and into a summary', () => {
    const view = buildView({ brief: sampleBrief(), filter: '', expanded: NONE });
    const lane = view.groups.find((group) => group.lane === 'land_in_flight');

    expect(lane?.rows).toHaveLength(1);
    expect(lane?.summary).toBe('2 PRs waiting on reviewers: #203, #204');
    // The count still reflects every item in the lane, collapsed or not.
    expect(lane?.total).toBe(3);
  });

  it('caps the claimable lane and offers the remainder', () => {
    const view = buildView({ brief: sampleBrief(), filter: '', expanded: NONE });
    const lane = view.groups.find((group) => group.lane === 'pick_up_next');

    expect(lane?.rows).toHaveLength(4);
    expect(lane?.rows.at(-1)).toEqual({ kind: 'more', lane: 'pick_up_next', count: 2 });
  });

  it('shows every claimable item once the lane is expanded', () => {
    const view = buildView({
      brief: sampleBrief(),
      filter: '',
      expanded: new Set<Lane>(['pick_up_next']),
    });
    const lane = view.groups.find((group) => group.lane === 'pick_up_next');

    expect(lane?.rows).toHaveLength(5);
    expect(lane?.rows.some((row) => row.kind === 'more')).toBe(false);
  });

  it('ignores the cap while filtering, because matches were asked for', () => {
    const view = buildView({ brief: sampleBrief(), filter: 'claimable', expanded: NONE });
    const lane = view.groups.find((group) => group.lane === 'pick_up_next');

    expect(lane?.rows).toHaveLength(5);
    expect(view.matched).toBe(5);
  });

  it('reports the unfiltered size so the empty state can say so', () => {
    const view = buildView({ brief: sampleBrief(), filter: 'nothing here', expanded: NONE });
    expect(view.groups).toHaveLength(0);
    expect(view.matched).toBe(0);
    expect(view.available).toBe(10);
  });

  it('flattens rows across lanes in render order', () => {
    const view = buildView({ brief: sampleBrief(), filter: '', expanded: NONE });
    const numbers = view.rows.map((row) => (row.kind === 'item' ? row.item.number : 'more'));

    expect(numbers).toEqual([101, 202, 301, 401, 402, 403, 'more']);
  });

  it('keys rows uniquely across types', () => {
    const keys = [
      rowKey({ kind: 'item', lane: 'needs_decision', item: item({ number: 7 }) }),
      rowKey({
        kind: 'item',
        lane: 'needs_decision',
        item: item({ number: 7, type: 'issue' }),
      }),
      rowKey({ kind: 'more', lane: 'pick_up_next', count: 2 }),
    ];
    expect(new Set(keys).size).toBe(3);
  });
});
