/**
 * Renders the brief as markdown for pasting into a coding agent.
 *
 * Two properties matter more than prettiness:
 *
 *   Faithful - the export is what is on screen. It honours the active filter
 *   and the collapse state, and says so when it is showing you a subset,
 *   because an agent handed a silently truncated list will confidently work
 *   on the wrong thing.
 *
 *   Self-contained - every item carries its link and, where one exists, the
 *   command to check it out. An agent should not have to ask a follow-up
 *   question to start work.
 *
 * The signal and action strings come from the server verbatim, so the export
 * and the screen can never disagree about what needs doing.
 */

import type { BriefView } from './brief';
import type { Brief, BriefItem } from '../types/brief';

/** Formats a timestamp as minute-precision UTC. Seconds are noise here. */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function renderItem(item: BriefItem): string {
  const lines = [
    `- [#${item.number}](${item.url}) ${item.title}`,
    `  - Signal: ${item.signal}`,
    `  - Action: ${item.action}`,
  ];
  if (item.checkout) lines.push(`  - Checkout: \`${item.checkout}\``);
  if (item.local) lines.push(`  - Local: ${item.local}`);
  return lines.join('\n');
}

export interface ExportOptions {
  brief: Brief;
  view: BriefView;
  /** The active filter, so the export can disclose that it is a subset. */
  filter?: string;
}

export function toMarkdown({ brief, view, filter }: ExportOptions): string {
  const trimmed = filter?.trim() ?? '';
  const blocks: string[] = [];

  blocks.push(`# ${brief.repo}`);

  const preamble = [
    `Generated ${stamp(brief.generated_at)} for ${brief.viewer}.`,
    `${brief.counts.total} ${brief.counts.total === 1 ? 'item' : 'items'}, ${brief.counts.blocking} blocking.`,
  ];
  if (trimmed) {
    preamble.push(`Filtered by "${trimmed}", ${view.matched} matching.`);
  }
  blocks.push(preamble.join(' '));

  if (view.groups.length === 0) {
    blocks.push(trimmed ? 'No items match the filter.' : 'Nothing is waiting on you.');
    return `${blocks.join('\n\n')}\n`;
  }

  for (const group of view.groups) {
    blocks.push(`## ${group.label}`);

    const items = group.rows
      .filter((row) => row.kind === 'item')
      .map((row) => renderItem(row.item));
    if (items.length > 0) blocks.push(items.join('\n'));

    if (group.summary) blocks.push(group.summary);

    // A collapsed lane is a lie by omission unless the export admits it.
    const hidden = group.rows.find((row) => row.kind === 'more');
    if (hidden) {
      blocks.push(`${hidden.count} more not shown. Expand in GitHelp to include them.`);
    }
  }

  return `${blocks.join('\n\n')}\n`;
}
