/**
 * The entire interaction model.
 *
 * Eight keys, one global listener, no chords. Mouse support exists but is
 * incidental: the brief is a keyboard document.
 *
 * Two rules keep this from fighting the browser or the filter box:
 *
 *   - Modified keypresses are never intercepted, so Cmd-R still reloads.
 *   - While typing in a field, only Escape and Enter are handled, because
 *     everything else is text.
 */

import { useEffect, useRef } from 'react';

export interface BriefKeyActions {
  onDown: () => void;
  onUp: () => void;
  onActivate: () => void;
  onCopyCheckout: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onFilter: () => void;
  onEscape: () => void;
  onHelp: () => void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

export function useBriefKeys(actions: BriefKeyActions): void {
  // The handlers close over state that changes on nearly every render.
  // Reading them through a ref keeps the listener registered exactly once
  // while still calling the current versions.
  const current = useRef(actions);
  current.current = actions;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const typing = isEditable(event.target);
      const on = current.current;

      // Escape is the universal way out, so it is handled even mid-word.
      if (event.key === 'Escape') {
        event.preventDefault();
        on.onEscape();
        return;
      }

      // Everything below is a command rather than text. Enter is included:
      // a form inside a sheet has its own submit behaviour and intercepting
      // it here would leave the key silently dead.
      if (typing) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        on.onActivate();
        return;
      }

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          on.onDown();
          break;
        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          on.onUp();
          break;
        case 'c':
          event.preventDefault();
          on.onCopyCheckout();
          break;
        case 'y':
          event.preventDefault();
          on.onExport();
          break;
        case 'r':
          event.preventDefault();
          on.onRefresh();
          break;
        case '/':
          event.preventDefault();
          on.onFilter();
          break;
        case '?':
          event.preventDefault();
          on.onHelp();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
