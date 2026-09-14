/**
 * GitHelp.
 *
 * One page: a ranked brief of what to do next in one repository, generated
 * on demand. There is no inbox, no board, no triage state, and nothing to
 * mark as done - the brief is regenerated rather than maintained, so it
 * cannot drift out of agreement with GitHub.
 *
 * The whole page is driven by a single fetch. Filtering, grouping,
 * collapsing, and exporting are memoised derivations of that one payload.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Brief from './components/Brief';
import Header from './components/Header';
import HelpSheet from './components/HelpSheet';
import SettingsSheet from './components/SettingsSheet';
import { useBrief } from './hooks/useBrief';
import { useBriefKeys } from './hooks/useBriefKeys';
import { buildView } from './lib/brief';
import { copyText } from './lib/clipboard';
import { toMarkdown } from './lib/export';
import type { BriefItem, Lane } from './types/brief';

/** How long a confirmation stays on screen. */
const STATUS_MS = 2200;

export default function App() {
  const [repo, setRepo] = useState<string | undefined>(undefined);
  const { brief, isLoading, isRefreshing, error, refresh } = useBrief(repo);

  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<Lane>>(() => new Set());
  const [sheet, setSheet] = useState<'help' | 'settings' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const filterRef = useRef<HTMLInputElement>(null);

  const view = useMemo(
    () => buildView({ brief, filter, expanded }),
    [brief, filter, expanded]
  );

  // The row list shrinks when the filter narrows and grows when a lane is
  // expanded, so the cursor has to be pulled back into range afterwards.
  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(0, view.rows.length - 1)));
  }, [view.rows.length]);

  // Keep the cursor on screen without giving every row a ref.
  useEffect(() => {
    document
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, view.rows.length]);

  const announce = useCallback((message: string) => {
    setStatus(message);
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), STATUS_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const openItem = useCallback((item: BriefItem) => {
    window.open(item.url, '_blank', 'noopener,noreferrer');
  }, []);

  const expandLane = useCallback((lane: Lane) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.add(lane);
      return next;
    });
  }, []);

  const activate = useCallback(() => {
    const row = view.rows[selected];
    if (!row) return;
    if (row.kind === 'more') {
      expandLane(row.lane);
      return;
    }
    openItem(row.item);
  }, [expandLane, openItem, selected, view.rows]);

  const copyCheckout = useCallback(async () => {
    const row = view.rows[selected];
    if (!row || row.kind !== 'item') return;

    const command = row.item.checkout;
    if (!command) {
      announce('No branch to check out');
      return;
    }

    announce((await copyText(command)) ? 'Copied checkout command' : 'Copy failed');
  }, [announce, selected, view.rows]);

  const exportBrief = useCallback(async () => {
    if (!brief) return;
    const markdown = toMarkdown({ brief, view, filter });
    announce((await copyText(markdown)) ? 'Copied brief as markdown' : 'Copy failed');
  }, [announce, brief, filter, view]);

  // A sheet owns the screen while it is open. Letting the list keys through
  // would scroll and act on rows the user cannot see.
  const busy = sheet !== null;

  useBriefKeys({
    onDown: () => {
      if (busy) return;
      setSelected((current) => Math.min(current + 1, Math.max(0, view.rows.length - 1)));
    },
    onUp: () => {
      if (busy) return;
      setSelected((current) => Math.max(current - 1, 0));
    },
    onActivate: () => {
      if (!busy) activate();
    },
    onCopyCheckout: () => {
      if (!busy) void copyCheckout();
    },
    onExport: () => {
      if (!busy) void exportBrief();
    },
    onRefresh: () => {
      if (!busy) refresh();
    },
    onFilter: () => {
      if (busy) return;
      // The key handler is a native listener, so this update would otherwise
      // be batched and committed after the next keystroke has already been
      // delivered. Anything typed in that window reaches the global handler
      // instead of the input, and typing "viewer" performs a refresh.
      flushSync(() => setFiltering(true));
      filterRef.current?.focus();
    },
    onEscape: () => {
      if (sheet) {
        setSheet(null);
        return;
      }
      if (filter || filtering) {
        setFilter('');
        setFiltering(false);
        filterRef.current?.blur();
      }
    },
    onHelp: () => setSheet((current) => (current === 'help' ? null : 'help')),
  });

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-brief px-6 py-12">
        <Header
          brief={brief}
          isRefreshing={isRefreshing}
          filteredCount={filter.trim() ? view.matched : null}
          onRefresh={refresh}
          onExport={() => void exportBrief()}
          onOpenSettings={() => setSheet('settings')}
        />

        {filtering && (
          <div className="mb-6 flex items-baseline gap-2 pl-3">
            <span className="font-mono text-meta text-faint">/</span>
            <input
              ref={filterRef}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                // Enter is not intercepted globally while typing, so the
                // filter opts into it here: search, then press Enter to open
                // the top match without reaching for the mouse.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  activate();
                }
              }}
              placeholder="Filter"
              aria-label="Filter the brief"
              className="w-full bg-transparent text-body text-text placeholder:text-faint focus:outline-none focus-visible:ring-0"
            />
          </div>
        )}

        {error && (
          <p className="mb-6 pl-3 text-body text-accent">
            {error}{' '}
            <span className="text-faint">Press r to try again.</span>
          </p>
        )}

        {isLoading && !brief && !error && (
          <p className="pl-3 text-body text-faint">Reading GitHub</p>
        )}

        {brief && (
          <Brief
            view={view}
            selectedIndex={selected}
            filter={filter}
            onSelect={setSelected}
            onOpen={openItem}
            onExpand={expandLane}
          />
        )}

        <footer className="mt-12 pl-3 text-meta text-faint">
          Press <span className="font-mono">?</span> for keys
        </footer>
      </main>

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2"
      >
        {status && (
          <p className="animate-rise rounded border border-line bg-surface px-3 py-1.5 text-meta text-muted">
            {status}
          </p>
        )}
      </div>

      {sheet === 'help' && <HelpSheet onClose={() => setSheet(null)} />}
      {sheet === 'settings' && (
        <SettingsSheet
          activeRepo={repo ?? brief?.repo ?? ''}
          onSelectRepo={setRepo}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
