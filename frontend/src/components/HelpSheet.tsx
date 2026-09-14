/**
 * The key reference.
 *
 * Every shortcut the app has is on this list. If a key is not here it does
 * not exist, which is the point: the whole interface is eight keys.
 */

import Sheet from './Sheet';

const KEYS: ReadonlyArray<[string, string]> = [
  ['j / k', 'Move down and up'],
  ['Enter', 'Open on GitHub, or expand a collapsed lane'],
  ['c', 'Copy the checkout command'],
  ['y', 'Copy the brief as markdown'],
  ['r', 'Regenerate from GitHub'],
  ['/', 'Filter'],
  ['Esc', 'Clear the filter, or close'],
  ['?', 'This list'],
];

export default function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Keys" onClose={onClose}>
      <dl className="space-y-2">
        {KEYS.map(([key, description]) => (
          <div key={key} className="flex items-baseline gap-4">
            <dt className="w-20 shrink-0 font-mono text-meta text-muted">{key}</dt>
            <dd className="text-meta text-faint">{description}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
