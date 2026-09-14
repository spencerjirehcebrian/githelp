/**
 * One item, two or three lines.
 *
 *   identity - what it is, so you recognise it
 *   signal   - why it is in front of you, stated as fact
 *   action   - the next step, stated as an imperative, when there is one
 *
 * The action line carries the only colour in the interface. Everything else
 * is greyscale, so colour reliably means "this is the thing to do" rather
 * than merely decorating a row.
 *
 * Items with no next step get no third line. A brief typically carries a
 * dozen or more of them, and a repeated "nothing to do here" says nothing
 * the signal has not already said.
 */

import { memo } from 'react';
import type { BriefItem } from '../types/brief';

export interface BriefRowProps {
  item: BriefItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function BriefRow({ item, selected, onSelect, onOpen }: BriefRowProps) {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={[
        // The selection marker is a left border rather than a filled block,
        // so the cursor is obvious without the row shouting.
        'cursor-default border-l-2 py-2 pl-3 pr-2 transition-colors duration-150 ease-out',
        selected
          ? 'border-accent bg-surface'
          : 'border-transparent hover:border-line hover:bg-surface/60',
      ].join(' ')}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-meta text-faint tabular">
          #{item.number}
        </span>
        <span className="truncate text-body text-text">{item.title}</span>
      </div>

      <p className="mt-0.5 text-meta text-muted">{item.signal}</p>
      {item.action && <p className="mt-0.5 text-meta text-accent">{item.action}</p>}
    </div>
  );
}

export default memo(BriefRow);
