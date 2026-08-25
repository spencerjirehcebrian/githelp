# GitHelp - Specification Document (spec.md)

## 1. Executive Summary

GitHelp is a lightweight, local-first, keyboard-driven GitHub notification triage and launch hub. It solves the cognitive overload of GitHub's native notification system by categorizing notifications into actionable, Linear-style buckets ("Action Required", "Waiting on Others", "Mentions", "Assigned", "Done", "Snoozed").

It runs as a single local application consisting of a fast Go backend with an embedded SQLite database and a responsive React (Vite) frontend. It supports instant authentication via the GitHub CLI (`gh auth token`) with Personal Access Token (PAT) fallback.

---

## 2. Market Research & Problem Analysis

### 2.1 The Problem
- **GitHub Notifications Noise**: Watching repositories or teams generates hundreds of notifications where high-priority items (direct mentions, review requests) are mixed with trivial thread subscriptions.
- **Context Switching**: Developers spend excessive time opening tabs, figuring out what requires their immediate input, and manually tracking PR review states.
- **Lack of Inbox Zero Workflows**: GitHub's native interface makes snoozing, archiving, and prioritizing difficult across multiple repositories and organizations.

### 2.2 Existing Market Alternatives & Gaps
| Product | Pros | Limitations / Gaps |
| :--- | :--- | :--- |
| **GitHub Native Inbox** | Integrated, official | Cluttered, poor triage grouping, slow keyboard navigation |
| **Gitify** | Menu bar tray, lightweight | Electron-based, basic notification list, lacks rich bucket triage and snooze rules |
| **Octobox** | Powerful inbox zero workflow | Heavy Ruby/Rails stack, complex local setup/hosting |
| **Graphite Inbox** | Excellent PR triage | Proprietary, PR-centric (weak on issues/discussions/general mentions) |
| **DevHub** | Multi-column streams | Discontinued/infrequent updates, visual clutter |

### 2.3 GitHelp Value Proposition
- **Ultra-Fast & Lightweight**: Go binary + SQLite + React Vite. Minimal memory footprint and instant startup.
- **Zero Config Setup**: Automatically uses existing `gh` CLI credentials; fallback to PAT input in settings.
- **Linear-style Smart Triage**: High-priority buckets separating "Action Required" from background notifications.
- **Keyboard-First Launcher**: Navigate with `j`/`k`, open with `Enter`/`o`, mark done with `e`, snooze with `z`, copy checkout/link with `c`.
- **Local Persistence & Snooze**: Full offline triage state stored in SQLite, syncing bidirectionally or preserving local-only snooze timers.

---

## 3. System Architecture

```
+-------------------------------------------------------------+
|                     React Frontend (Vite)                   |
|  - Tailwind CSS UI with Dark/Light Theme                    |
|  - Keyboard shortcuts engine (j/k/e/z/o/c/r/?)              |
|  - Triage buckets: Action Required, Waiting, Mentions, etc. |
|  - Filter sidebar (Org/Repo, Reason, State, Search)         |
|  - Browser Web Notification dispatcher                      |
+------------------------------^------------------------------+
                               | REST API & Server-Sent Events (SSE)
+------------------------------v------------------------------+
|                       Go Backend Server                     |
|  - Port: 8080 (Configurable via env / flags)                |
|  - GitHub API Client (REST & GraphQL)                       |
|  - Poller Worker (Configurable interval: 30s - 300s)        |
|  - Auth Manager: `gh auth token` / Local Secure Token Store |
|  - SSE Event Broadcaster for real-time updates              |
+------------------------------^------------------------------+
                               | SQLite Driver (modernc.org/sqlite)
+------------------------------v------------------------------+
|                     SQLite Database (Local)                 |
|  - Notifications table (id, github_id, repo, reason, etc.)  |
|  - Triage table (status: inbox/done/snoozed, snoozed_until) |
|  - Settings table (poll_interval, sound_alerts, token)      |
+-------------------------------------------------------------+
```

---

## 4. Data Models

### 4.1 Notification Item
- `id`: string (GitHub notification thread ID)
- `github_id`: string
- `repository`: string (`owner/name`)
- `title`: string
- `type`: string (`PullRequest`, `Issue`, `Commit`, `Discussion`, `Release`)
- `reason`: string (`review_requested`, `mention`, `assigned`, `author`, `comment`, `subscribed`, `state_change`)
- `url`: string (API URL)
- `html_url`: string (Browser target URL)
- `state`: string (`open`, `closed`, `merged`, `draft`)
- `ci_status`: string (`success`, `failure`, `pending`, `neutral`, `null`)
- `author`: string (GitHub username)
- `author_avatar`: string (Avatar URL)
- `unread`: boolean
- `updated_at`: timestamp (GitHub timestamp)
- `last_read_at`: timestamp (nullable)

### 4.2 Triage State
- `notification_id`: string (Foreign key)
- `bucket`: string (`action_required`, `waiting_on_others`, `mentions`, `assigned`, `participating`)
- `status`: string (`inbox`, `done`, `snoozed`)
- `snoozed_until`: timestamp (nullable)
- `pinned`: boolean (default false)
- `notes`: string (optional personal note)
- `updated_at`: timestamp

### 4.3 App Settings
- `auth_mode`: string (`gh_cli`, `pat`)
- `pat_token`: string (encrypted or local config)
- `poll_interval_sec`: integer (default: 60)
- `enable_browser_notifications`: boolean (default: true)
- `enable_sound`: boolean (default: false)
- `ignored_repos`: string array (JSON)
- `theme`: string (`dark`, `light`, `system`)

---

## 5. Functional Requirements

### 5.1 Authentication
1. **GitHub CLI Auto-Detection**:
   - Check if `gh` is installed (`gh --version`) and authenticated (`gh auth token`).
   - If available, automatically use the token with zero user configuration.
2. **Personal Access Token (PAT) Fallback**:
   - Setting modal to input a GitHub PAT (scopes required: `notifications`, `repo`, `read:org`, `read:user`).
   - Token validation endpoint to test permissions before saving.

### 5.2 Notification Ingestion & Enrichment
1. **Background Poller**:
   - Periodically queries `GET https://api.github.com/notifications`.
   - Fetches enriched metadata via GraphQL batching (PR review state, CI check run status, issue state, author avatar).
   - Emits SSE events when new high-priority items arrive.
2. **Bucket Categorization Engine**:
   - **Action Required**:
     - Pull requests where review is requested from the user.
     - Notifications where user is directly `@mentioned`.
     - Issues/PRs assigned to the user that are currently open.
     - PRs authored by user with requested changes or CI check failures.
   - **Waiting on Others**:
     - PRs authored by user that are open and waiting on requested reviewers.
   - **Mentions**:
     - All direct and team mentions.
   - **Assigned**:
     - All assigned open issues and pull requests.
   - **Participating / Subscribed**:
     - Comments on subscribed threads or discussions without direct action required.
   - **Done / Archived**:
     - Items marked done by the user (Inbox Zero).
   - **Snoozed**:
     - Items snoozed until a future time (1 hour, tomorrow morning 9am, next Monday, or until next activity).

### 5.3 User Interface & Interactions
1. **Fast Launcher / Link Hub View**:
   - High-density card layout showing:
     - Repo badge (`owner/repo`)
     - Type & State icon (PR Open/Merged/Closed/Draft, Issue Open/Closed)
     - Reason tag (`Review requested`, `@mention`, `Assigned`)
     - Title with direct click to GitHub
     - CI status badge (Green check, Red cross, Amber clock)
     - Author name and relative time (`2m ago`, `3h ago`)
2. **Sidebar Filters**:
   - Buckets count badge (`Action Required (4)`, `Waiting (2)`, `Mentions (1)`, `Done (18)`)
   - Organization and Repository filters with quick counts
   - Reason filters (`Review Requested`, `Mentioned`, `Assigned`, `Author`)
3. **Search & Quick Filter**:
   - Instant fuzzy search on title, repo name, author, and reason.
4. **Keyboard Shortcuts**:
   - `j` / `Down Arrow`: Move selection down
   - `k` / `Up Arrow`: Move selection up
   - `o` / `Enter`: Open selected notification in browser
   - `e`: Mark as Done / Archive (removes from inbox)
   - `z`: Snooze modal / quick snooze (1h, tomorrow, next week)
   - `c`: Copy link or `git checkout <branch>` to clipboard
   - `u`: Mark as Read / Unread
   - `p`: Pin / Unpin notification to top
   - `/`: Focus search input
   - `r`: Trigger immediate refresh
   - `?`: Show keyboard shortcuts cheat sheet
5. **Desktop Notifications**:
   - Web Notification API integration with audio cue option when new "Action Required" items arrive.

---

## 6. API Endpoints (Go Backend)

### Auth & Status
- `GET /api/status` - Returns auth status, current user profile, and connection health.
- `POST /api/auth/pat` - Saves and validates a custom PAT token.
- `POST /api/auth/disconnect` - Clears manual token and reverts to `gh` CLI detection.

### Notifications & Triage
- `GET /api/notifications` - Returns triage items (supports query params: `bucket`, `repo`, `status`, `q`).
- `POST /api/notifications/sync` - Triggers immediate GitHub sync.
- `PATCH /api/notifications/:id/state` - Updates status (`done`, `inbox`, `snoozed`, `pinned`, `snoozed_until`).
- `POST /api/notifications/bulk` - Batch mark as done or snooze.

### System & Real-Time
- `GET /api/events` - Server-Sent Events (SSE) stream for instant UI updates.
- `GET /api/settings` - Fetches user preferences.
- `PUT /api/settings` - Updates preferences (poll interval, notifications, ignored repos).

---

## 7. Project Structure & Technology Choices

```
/Users/spencerjireh/git/githelp/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── auth/          # gh CLI detection & token management
│   │   ├── github/        # GitHub REST & GraphQL client + poller
│   │   ├── db/            # SQLite migrations & queries
│   │   ├── triage/        # Smart bucket categorization rules
│   │   └── api/           # HTTP handlers & SSE broadcaster
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/    # NotificationCard, Sidebar, FilterBar, ShortCutHelp, SettingsModal
│   │   ├── hooks/         # useKeyboardNavigation, useNotifications, useSSE
│   │   ├── types/         # TypeScript interfaces
│   │   ├── lib/           # API client, time formatters, clipboard helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
├── Makefile               # Build and run commands for dev & release
├── README.md
└── spec.md
```

### Technology Decisions:
1. **Backend**: Go (Go 1.22+) using standard library `net/http` or lightweight router (`chi`), `modernc.org/sqlite` (pure Go SQLite, zero CGO dependency for effortless cross-platform builds).
2. **Frontend**: React 18 / 19 with Vite, TypeScript, Tailwind CSS, Lucide React icons, and `date-fns` for relative dates.
3. **Database**: SQLite with WAL (Write-Ahead Logging) enabled for concurrency and reliability.
4. **Single-command Execution**: `make dev` runs backend and frontend concurrently; `make build` embeds the compiled frontend into the Go binary (`go:embed`) so the entire app can run as a single standalone executable.

---

## 8. Implementation Milestones

- **Milestone 1: Backend Core & Auth**
  - Initialize Go project and SQLite schema.
  - Implement GitHub CLI token detector + PAT fallback.
  - Implement GitHub Notifications REST API sync & GraphQL enrichment.
- **Milestone 2: Triage Engine & Local State**
  - Implement bucket categorization rules ("Action Required", "Waiting", etc.).
  - Implement local snooze & done state persistence.
  - Implement background polling worker & SSE stream.
- **Milestone 3: React Frontend & Launcher UI**
  - Initialize Vite React project with Tailwind CSS.
  - Build smart bucket list, filter sidebar, and notification cards.
  - Build keyboard shortcuts handler (`j/k/e/z/o/c/r`).
- **Milestone 4: Polish, Single Binary Embedding & Testing**
  - Embed Vite build into Go binary (`go:embed dist`).
  - Add browser notification support and settings modal.
  - End-to-end testing and documentation.
