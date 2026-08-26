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

INSERT INTO notifications (id, github_id, repository, title, type, reason, url, html_url, state, ci_status, author, branch, number, unread, github_updated_at, raw_data)
VALUES
  ('e2e-1', '1', 'spencerjireh/githelp', 'Add biometric login support', 'PullRequest', 'review_requested', 'https://api.github.com', 'https://github.com/spencerjireh/githelp/pull/101', 'open', 'success', 'alice', 'feature/biometrics', 101, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), '{
    "body": "Adds WebAuthn and Passkey biometric authentication support for web and mobile.\n\nKey Changes:\n- Integrated biometric challenge registration\n- Added fallback to regular credentials\n- Unit test coverage at 100%",
    "additions": 284,
    "deletions": 42,
    "changed_files": 3,
    "comments_count": 3,
    "labels": [{"name": "security", "color": "d73a4a"}, {"name": "enhancement", "color": "a2eeef"}],
    "reviewers": [{"login": "spencerjirehcebrian"}],
    "assignees": [{"login": "alice"}],
    "files": [
      {"filename": "src/auth/biometrics.ts", "status": "added", "additions": 140, "deletions": 0, "patch": "@@ -0,0 +1,5 @@\n+export async function authenticateBiometric() {\n+  return navigator.credentials.get({ ... });\n+}"},
      {"filename": "src/components/LoginModal.tsx", "status": "modified", "additions": 68, "deletions": 12, "patch": "@@ -45,3 +45,4 @@\n+<button onClick={handleBiometricLogin}>Biometric Auth</button>"},
      {"filename": "backend/internal/auth/webauthn.go", "status": "added", "additions": 76, "deletions": 30, "patch": "@@ -0,0 +1,5 @@\n+func VerifyChallenge() error {\n+  return nil\n+}"}
    ],
    "ci_details": [
      {"name": "Build & Lint", "status": "success", "description": "Passed in 34s"},
      {"name": "Unit Tests", "status": "success", "description": "32/32 tests passed"},
      {"name": "E2E Playwright", "status": "success", "description": "All browser workflows verified"}
    ]
  }'),
  ('e2e-2', '2', 'spencerjireh/githelp', 'Fix memory leak in worker', 'Issue', 'mention', 'https://api.github.com', 'https://github.com/spencerjireh/githelp/issues/88', 'open', '', 'bob', '', 88, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 minutes'), '{
    "body": "Worker goroutines are retaining database connection handles indefinitely when jobs timeout, leading to connection exhaustion after heavy load.",
    "comments_count": 5,
    "labels": [{"name": "bug", "color": "d73a4a"}, {"name": "backend", "color": "0075ca"}],
    "assignees": [{"login": "bob"}]
  }'),
  ('e2e-3', '3', 'facebook/react', 'Update API documentation', 'PullRequest', 'author', 'https://api.github.com', 'https://github.com/facebook/react/pull/202', 'open', 'success', 'spencerjirehcebrian', 'docs-update', 202, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-10 minutes'), '{
    "body": "Updates OpenAPI 3.0 specifications and adds comprehensive developer documentation for sync and settings endpoints.",
    "additions": 115,
    "deletions": 18,
    "changed_files": 2,
    "comments_count": 1,
    "labels": [{"name": "documentation", "color": "0075ca"}],
    "files": [
      {"filename": "docs/openapi.yaml", "status": "modified", "additions": 80, "deletions": 10},
      {"filename": "README.md", "status": "modified", "additions": 35, "deletions": 8}
    ],
    "ci_details": [
      {"name": "Docs Validator", "status": "success", "description": "Markdown and OpenAPI schema validated"}
    ]
  }'),
  ('e2e-4', '4', 'golang/go', 'Investigate database deadlock', 'Issue', 'assigned', 'https://api.github.com', 'https://github.com/golang/go/issues/303', 'open', '', 'charlie', '', 303, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-15 minutes'), '{
    "body": "Deadlock reported during simultaneous batch mark done and SSE event broadcast under high concurrency.\n\nNeed to verify WAL mode locking order.",
    "comments_count": 8,
    "labels": [{"name": "database", "color": "fbca04"}, {"name": "investigation", "color": "e99695"}]
  }');

INSERT INTO triage (notification_id, bucket, status, pinned, updated_at)
VALUES
  ('e2e-1', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-2', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-3', 'waiting_on_others', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('e2e-4', 'action_required', 'inbox', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

PRAGMA wal_checkpoint(FULL);
SQL
