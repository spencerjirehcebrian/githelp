#!/bin/bash
DB_PATH="${1:-/tmp/e2e_githelp.db}"

sqlite3 "$DB_PATH" << 'SQL'
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  github_id TEXT,
  repository TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  url TEXT,
  html_url TEXT,
  state TEXT,
  ci_status TEXT,
  author TEXT,
  author_avatar TEXT,
  branch TEXT,
  number INTEGER DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 1,
  github_updated_at DATETIME NOT NULL,
  last_read_at DATETIME,
  raw_data TEXT
);

CREATE TABLE IF NOT EXISTS triage (
  notification_id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inbox',
  snoozed_until DATETIME,
  pinned INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('auth_mode', 'gh_cli'),
  ('poll_interval_sec', '60'),
  ('enable_browser_notifications', 'true'),
  ('enable_sound', 'false'),
  ('ignored_repos', '[]'),
  ('theme', 'dark');

DELETE FROM notifications;
DELETE FROM triage;

INSERT INTO notifications (id, github_id, repository, title, type, reason, url, html_url, state, ci_status, author, branch, number, unread, github_updated_at)
VALUES
  ('e2e-1', '1', 'theteamatx/x-benjamin-repo', 'Add biometric login support', 'PullRequest', 'review_requested', 'https://api.github.com', 'https://github.com/theteamatx/x-benjamin-repo/pull/101', 'open', 'success', 'alice', 'feature/biometrics', 101, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-2', '2', 'theteamatx/x-benjamin-repo', 'Fix memory leak in worker', 'Issue', 'mention', 'https://api.github.com', 'https://github.com/theteamatx/x-benjamin-repo/issues/88', 'open', '', 'bob', '', 88, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 minutes')),
  ('e2e-3', '3', 'facebook/react', 'Update API documentation', 'PullRequest', 'author', 'https://api.github.com', 'https://github.com/facebook/react/pull/202', 'open', 'success', 'spencerjirehcebrian', 'docs-update', 202, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-10 minutes')),
  ('e2e-4', '4', 'golang/go', 'Investigate database deadlock', 'Issue', 'assigned', 'https://api.github.com', 'https://github.com/golang/go/issues/303', 'open', '', 'charlie', '', 303, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-15 minutes'));

INSERT INTO triage (notification_id, bucket, status, pinned, updated_at)
VALUES
  ('e2e-1', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-2', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-3', 'waiting_on_others', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-4', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

PRAGMA wal_checkpoint(FULL);
SQL
