# GitHelp

> Lightweight, local-first, keyboard-driven GitHub notification triage and launch hub.

GitHelp solves the cognitive overload of GitHub's native notification inbox by categorizing notifications into actionable, Linear-style buckets (**Action Required**, **Waiting on Others**, **Mentions**, **Assigned**, **Participating**, **Snoozed**, and **Done**).

It ships as a **single standalone executable** with an embedded SQLite database and a responsive, high-density React (Vite + Tailwind CSS) user interface.

---

## Key Features

- **Linear-Style Smart Triage**:
  - **Action Required**: PR reviews requested from you, direct mentions (`@username`), open assigned issues, broken CI checks, and review changes requested on your PRs.
  - **Waiting on Others**: PRs authored by you that are open and waiting on reviewers.
  - **Mentions**: Direct and team mentions.
  - **Assigned**: Issues and PRs assigned to you.
  - **Participating**: Subscribed threads, comments, and discussions.
  - **Snoozed**: Items snoozed until 1h, 3h, tomorrow morning 9am, next Monday 9am, or custom time.
  - **Done / Archived**: Instant Inbox Zero workflow.
- **Keyboard-First Launcher**:
  - `j` / `k` (or `↓` / `↑`): Move selection cursor
  - `o` / `Enter`: Open selected item in browser
  - `e`: Mark as Done / Archive
  - `z`: Snooze modal (`1`: 1h, `2`: 3h, `3`: Tomorrow, `4`: Next Monday)
  - `c`: Copy `git checkout <branch>` (for PRs) or browser link to clipboard
  - `u`: Toggle Read / Unread
  - `p`: Pin / Unpin to top
  - `/`: Focus search input
  - `r`: Trigger immediate GitHub sync
  - `?`: Show keyboard shortcuts cheat sheet
- **Zero-Config Authentication**:
  - Automatically detects and uses your local GitHub CLI credentials (`gh auth token`).
  - Fallback to Personal Access Token (PAT) with in-app validation.
- **Local Persistence & Real-Time Sync**:
  - Embedded SQLite with WAL mode for fast concurrency and persistence across reboots.
  - Real-time Server-Sent Events (SSE) stream for instant UI updates.
  - Background poller with configurable intervals (15s – 300s).
  - Web Audio chime sound alerts and Web Notification API desktop alerts.

---

## Quick Start

### 1. Requirements
- macOS or Linux
- GitHub CLI (`gh`) logged in (`gh auth login`) OR a GitHub Personal Access Token (PAT).

### 2. Build from Source
```bash
# Clone the repository
git clone https://github.com/spencerjireh/githelp.git
cd githelp

# Build standalone binary
make build

# Run GitHelp
./bin/githelp
```
Open **http://127.0.0.1:8080** in your browser.

### 3. Development Mode
To run backend and frontend concurrently with hot-reloading:
```bash
make dev
```
- Frontend Dev Server: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8080`

---

## Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `j` / `↓` | Move selection down |
| `k` / `↑` | Move selection up |
| `o` / `Enter` | Open in browser |
| `e` | Mark as Done / Archive |
| `z` | Snooze notification |
| `c` | Copy `git checkout <branch>` or link |
| `u` | Mark as Read / Unread |
| `p` | Pin / Unpin to top |
| `/` | Focus search bar |
| `r` | Trigger GitHub sync |
| `?` | Show keyboard shortcuts modal |
| `Esc` | Close modal / unfocus search |

---

## Build & Test Tooling

GitHelp supports both **Make** and hermetic **Bazel** (via Bzlmod and `@rules_go`):

### Make
```bash
make build          # Build embedded standalone binary
make test           # Run all unit, integration, and E2E browser tests
make test-backend   # Run Go tests with -race detector
make test-frontend  # Run Vitest unit/component tests
make test-e2e       # Run Playwright E2E browser tests
make lint           # Run Go vet and TypeScript linting
```

### Bazel
The repository includes a standalone `./bazel` launcher wrapper that automatically manages Bazelisk without requiring pre-installed system packages:
```bash
./bazel build //...        # Hermetically build all backend and frontend targets
./bazel test //...         # Run all Go, Vitest, and Playwright test targets
./bazel run //:gazelle     # Automatically synchronize Go dependencies with BUILD files
./bazel run //:githelp     # Compile and launch GitHelp standalone binary
```

---

## Architecture & Technology Stack

- **Build System**: Bazel 7.x (Bzlmod, rules_go, Gazelle) and Make.
- **Backend**: Go 1.24+ standard library `net/http` router, `modernc.org/sqlite` (pure Go SQLite driver, zero CGO).
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React icons, `date-fns`.
- **Distribution**: Single binary with embedded frontend (`//go:embed all:dist`).

---

## License

MIT License.
