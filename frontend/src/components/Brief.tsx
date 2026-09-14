/**
 * The brief itself: lanes, rows, and the lines that stand in for the rows
 * not worth showing.
 *
 * Lanes are separated by whitespace and a quiet eyebrow rather than rules or
 * cards. The page should read as a document you scan top to bottom, because
 * that is the order the work should be done in.
 */

import { memo } from 'react';
import BriefRow from './BriefRow';
import { rowKey, type BriefView, type LaneGroup, type Row } from '../lib/brief';
import type { BriefItem } from '../types/brief';

export interface BriefProps {
  view: BriefView;
  /** Index into view.rows, or -1 when nothing is selected. */
  selectedIndex: number;
  filter: string;
  onSelect: (index: number) => void;
  onOpen: (item: BriefItem) => void;
  onExpand: (lane: LaneGroup['lane']) => void;
}

function Brief({ view, selectedIndex, filter, onSelect, onOpen, onExpand }: BriefProps) {
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
            <h2 className="mb-2 pl-3 text-eyebrow font-medium uppercase text-faint">
              {group.label}
            </h2>

            <div className="space-y-px">
              {group.rows.map((row, offset) => (
                <RowView
                  key={rowKey(row)}
                  row={row}
                  index={start + offset}
                  selected={selectedIndex === start + offset}
                  onSelect={onSelect}
                  onOpen={onOpen}
                  onExpand={onExpand}
                />
              ))}
            </div>

            {group.summary && (
              <p className="mt-2 pl-3 text-meta text-faint tabular">{group.summary}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface RowViewProps {
  row: Row;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
  onOpen: (item: BriefItem) => void;
  onExpand: (lane: LaneGroup['lane']) => void;
}

function RowView({ row, index, selected, onSelect, onOpen, onExpand }: RowViewProps) {
  if (row.kind === 'more') {
    return (
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => {
          onSelect(index);
          onExpand(row.lane);
        }}
        className={[
          'block w-full border-l-2 py-1.5 pl-3 pr-2 text-left text-meta transition-colors duration-150 ease-out',
          selected
            ? 'border-accent bg-surface text-muted'
            : 'border-transparent text-faint hover:bg-surface/60 hover:text-muted',
        ].join(' ')}
      >
        <span className="tabular">{row.count} more</span>
      </button>
    );
  }

  return (
    <BriefRow
      item={row.item}
      selected={selected}
      onSelect={() => onSelect(index)}
      onOpen={() => onOpen(row.item)}
    />
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
