/**
 * Settings, in the sense of the two things that can actually be wrong:
 * you are not signed in, or you are looking at the wrong repository.
 *
 * Everything else the old settings screen offered - poll intervals, sounds,
 * browser notifications, themes, editors - described behaviour this app no
 * longer has. A brief is generated when you ask for it and follows the OS
 * for colour, so there is nothing left to configure.
 */

import { useCallback, useEffect, useState } from 'react';
import Sheet from './Sheet';
import { getSettings, getStatus, updateSettings } from '../lib/api';
import type { AuthStatus } from '../types';

export interface SettingsSheetProps {
  activeRepo: string;
  onSelectRepo: (repo: string) => void;
  onClose: () => void;
}

export default function SettingsSheet({
  activeRepo,
  onSelectRepo,
  onClose,
}: SettingsSheetProps) {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [repos, setRepos] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Loaded when the sheet opens rather than kept in sync, because nothing
    // here changes without the user doing it.
    void (async () => {
      try {
        const [status, settings] = await Promise.all([getStatus(), getSettings()]);
        if (!active) return;
        setAuth(status.auth);
        setRepos(settings.tracked_repos ?? []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: string[]) => {
    setRepos(next);
    try {
      await updateSettings({ tracked_repos: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, []);

  const addRepo = useCallback(() => {
    const value = draft.trim();
    // owner/name is the only form the GitHub search accepts, so reject
    // anything else here rather than failing later with a vague 502.
    if (!/^[\w.-]+\/[\w.-]+$/.test(value)) {
      setError('Use the owner/name form');
      return;
    }
    if (repos.includes(value)) {
      setDraft('');
      return;
    }
    setError(null);
    setDraft('');
    void persist([...repos, value]);
  }, [draft, persist, repos]);

  return (
    <Sheet title="Settings" onClose={onClose}>
      <section className="mb-5">
        <h3 className="mb-1.5 text-meta text-muted">GitHub</h3>
        <p className="text-meta text-faint">
          {loading && 'Checking'}
          {!loading && auth?.authenticated && (
            <>
              Signed in as <span className="text-muted">{auth.username}</span> via{' '}
              {auth.auth_mode === 'gh_cli' ? 'the gh CLI' : 'a personal access token'}
            </>
          )}
          {!loading && !auth?.authenticated && (
            <>Not signed in. Run <span className="font-mono text-muted">gh auth login</span>.</>
          )}
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-meta text-muted">Repository</h3>

        <ul className="space-y-px">
          {repos.map((repo) => (
            <li key={repo} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectRepo(repo);
                  onClose();
                }}
                className={[
                  'flex-1 truncate rounded px-2 py-1 text-left text-meta transition-colors duration-150 ease-out',
                  repo === activeRepo
                    ? 'bg-surface text-text'
                    : 'text-faint hover:bg-surface hover:text-muted',
                ].join(' ')}
              >
                {repo}
              </button>
              {repos.length > 1 && (
                <button
                  type="button"
                  aria-label={`Stop tracking ${repo}`}
                  onClick={() => void persist(repos.filter((item) => item !== repo))}
                  className="rounded px-1.5 py-1 text-meta text-faint opacity-0 transition-opacity duration-150 ease-out hover:text-muted group-hover:opacity-100"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addRepo();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="owner/name"
            aria-label="Add a repository"
            className="min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 font-mono text-meta text-text placeholder:text-faint focus:border-accent/60 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded px-2 py-1 text-meta text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text"
          >
            Add
          </button>
        </form>
      </section>

      {error && <p className="mt-4 text-meta text-accent">{error}</p>}
    </Sheet>
  );
}
