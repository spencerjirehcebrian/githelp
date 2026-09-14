/**
 * The brief itself: lanes and rows, all of them.
 *
 * Lanes are separated by whitespace and a quiet eyebrow rather than rules or
 * cards. The page should read as a document you scan top to bottom, because
 * that is the order the work should be done in.
 */

import { memo } from 'react';
import BriefRow from './BriefRow';
import { rowKey, type BriefView } from '../lib/brief';
import type { BriefItem } from '../types/brief';

export interface BriefProps {
  view: BriefView;
  /** Index into view.rows, or -1 when nothing is selected. */
  selectedIndex: number;
  filter: string;
  onSelect: (index: number) => void;
  onOpen: (item: BriefItem) => void;
}

function Brief({ view, selectedIndex, filter, onSelect, onOpen }: BriefProps) {
  if (view.groups.length === 0) {
    return <EmptyState filtered={filter.trim().length > 0} available={view.available} />;
  }

  // Rows are numbered across the whole page, not per lane, so the keyboard
  // cursor can cross lane boundaries without the lanes knowing about it.
  let cursor = 0;

  return (
    <div role="listbox" aria-label="Brief" className="space-y-8">
      {view.groups.map((group) => {
        const start = cursor;
        cursor += group.rows.length;

        return (
          <section key={group.lane}>
            <h2 className="mb-2 flex items-baseline gap-2 pl-3 text-eyebrow font-medium uppercase text-faint">
              {group.label}
              <span className="tabular font-normal normal-case">{group.rows.length}</span>
            </h2>

            <div className="space-y-px">
              {group.rows.map((row, offset) => (
                <BriefRow
                  key={rowKey(row)}
                  item={row.item}
                  selected={selectedIndex === start + offset}
                  onSelect={() => onSelect(start + offset)}
                  onOpen={() => onOpen(row.item)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EmptyState({ filtered, available }: { filtered: boolean; available: number }) {
  if (filtered) {
    return (
      <p className="pl-3 text-body text-muted">
        No matches.{' '}
        <span className="text-faint tabular">
          {available} {available === 1 ? 'item' : 'items'} in the brief. Press Esc to clear.
        </span>
      </p>
    );
  }

  return (
    <div className="pl-3">
      <p className="text-body text-text">Nothing is waiting on you.</p>
      <p className="mt-1 text-meta text-faint">
        No reviews requested, no stalled work, nothing to claim. Press r to check again.
      </p>
    </div>
  );
}

export default memo(Brief);
