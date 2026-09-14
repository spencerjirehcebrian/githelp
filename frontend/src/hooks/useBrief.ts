/**
 * Loads the brief. Once.
 *
 * The predecessor refetched on every filter keystroke and every dropdown
 * change, so the interface spent most of its time waiting on the network to
 * re-derive something it already had. This hook fetches on mount, and after
 * that only when the user changes repository or explicitly asks for a
 * refresh.
 *
 * It also distinguishes two kinds of loading, because they deserve different
 * treatment on screen:
 *
 *   isLoading    - there is nothing to show yet. One line of text.
 *   isRefreshing - there is something to show and it is merely old. The list
 *                  stays put and only the timestamp admits to being stale.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrief } from '../lib/api';
import type { Brief } from '../types/brief';

export interface UseBriefResult {
  brief: Brief | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBrief(repo?: string): UseBriefResult {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  // Monotonic request id. Only the newest response is allowed to write state,
  // so a slow refresh cannot overwrite a newer repo's brief.
  const latest = useRef(0);

  // Set while a request is open, so leaning on the refresh key cannot open a
  // dozen of them.
  const inFlight = useRef(false);

  const load = useCallback(
    async (force: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const id = ++latest.current;
      if (force) setIsRefreshing(true);

      try {
        const next = await getBrief({ repo, refresh: force });
        if (!mounted.current || id !== latest.current) return;
        setBrief(next);
        setError(null);
      } catch (err) {
        if (!mounted.current || id !== latest.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load brief');
      } finally {
        inFlight.current = false;
        if (mounted.current && id === latest.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [repo]
  );

  useEffect(() => {
    mounted.current = true;
    void load(false);
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { brief, isLoading, isRefreshing, error, refresh };
}
