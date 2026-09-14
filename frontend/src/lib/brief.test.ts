import { describe, expect, it } from 'vitest';
import { buildView, matchesFilter, rowKey } from './brief';
import { brief, item, sampleBrief } from '../test/brief-fixture';

describe('matchesFilter', () => {
  const subject = item({
    number: 4242,
    title: 'Add retry to the uploader',
    signal: 'grace requested your review',
    action: 'Review it',
    author: 'grace',
    branch: 'grace/retry',
    ball: 'hopper',
    project_status: 'In Review',
  });

  it('matches an empty filter', () => {
    expect(matchesFilter(subject, '')).toBe(true);
  });

  it.each([
    ['title', 'uploader'],
    ['number', '4242'],
    ['number with hash', '#4242'],
    ['signal', 'requested'],
    ['action', 'review it'],
    ['author', 'grace'],
    ['branch', 'grace/retry'],
    ['ball', 'hopper'],
    ['board status', 'in review'],
  ])('matches on %s', (_label, needle) => {
    expect(matchesFilter(subject, needle)).toBe(true);
  });

  it('rejects a term that appears nowhere', () => {
    expect(matchesFilter(subject, 'kubernetes')).toBe(false);
  });
});

describe('buildView', () => {
  it('produces an empty view without a brief', () => {
    const view = buildView({ brief: null, filter: '' });
    expect(view).toEqual({ groups: [], rows: [], matched: 0, available: 0 });
  });

  it('renders lanes in priority order, not payload order', () => {
    const shuffled = brief([
      item({ number: 1, lane: 'pick_up_next' }),
      item({ number: 2, lane: 'unblock_others' }),
      item({ number: 3, lane: 'needs_decision' }),
      item({ number: 4, lane: 'land_in_flight' }),
    ]);

    const view = buildView({ brief: shuffled, filter: '' });
    expect(view.groups.map((group) => group.lane)).toEqual([
      'unblock_others',
      'land_in_flight',
      'needs_decision',
      'pick_up_next',
    ]);
  });

  it('omits lanes with nothing in them', () => {
    const only = brief([item({ number: 1, lane: 'unblock_others' })]);
    const view = buildView({ brief: only, filter: '' });
    expect(view.groups).toHaveLength(1);
  });

  it('gives every item a row, including those with no next step', () => {
    const view = buildView({ brief: sampleBrief(), filter: '' });
    const lane = view.groups.find((group) => group.lane === 'land_in_flight');

    expect(lane?.rows.map((row) => row.item.number)).toEqual([202, 203, 204]);
  });

  it('never caps a lane', () => {
    const view = buildView({ brief: sampleBrief(), filter: '' });
    const lane = view.groups.find((group) => group.lane === 'pick_up_next');

    expect(lane?.rows).toHaveLength(5);
  });

  it('shows only matches while filtering', () => {
    const view = buildView({ brief: sampleBrief(), filter: 'claimable' });
    const lane = view.groups.find((group) => group.lane === 'pick_up_next');

    expect(lane?.rows).toHaveLength(5);
    expect(view.matched).toBe(5);
    expect(view.groups).toHaveLength(1);
  });

  it('reports the unfiltered size so the empty state can say so', () => {
    const view = buildView({ brief: sampleBrief(), filter: 'nothing here' });
    expect(view.groups).toHaveLength(0);
    expect(view.matched).toBe(0);
    expect(view.available).toBe(11);
  });

  it('flattens rows across lanes in render order', () => {
    const view = buildView({ brief: sampleBrief(), filter: '' });
    const numbers = view.rows.map((row) => row.item.number);

    expect(numbers).toEqual([101, 102, 202, 203, 204, 301, 401, 402, 403, 404, 405]);
  });

  it('keys rows uniquely across types', () => {
    const keys = [
      rowKey({ lane: 'needs_decision', item: item({ number: 7 }) }),
      rowKey({ lane: 'needs_decision', item: item({ number: 7, type: 'issue' }) }),
    ];
    expect(new Set(keys).size).toBe(2);
  });
});
