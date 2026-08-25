# GitHelp

Local-first, keyboard-driven GitHub notification triage and launch hub.

GitHelp categorizes GitHub notifications into actionable buckets (**Action Required**, **Waiting on Others**, **Mentions**, **Assigned**, **Participating**, **Snoozed**, **Done**) and ships as a single self-contained binary with embedded SQLite and a React frontend.

---

## Quick Start

### Build and Run Standalone
```bash
make build
./bin/githelp
```
Open **http://127.0.0.1:8080**. GitHelp automatically detects your `gh` CLI credentials (or configured PAT).

### Development Mode
```bash
make dev
```
- Frontend: `http://localhost:5173` (Vite HMR)
- Backend: `http://127.0.0.1:8080`

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `j` / `k` | Navigate items down / up |
| `o` / `Enter` | Open in browser |
| `e` | Mark as Done (Archive) |
| `z` | Snooze (`1`: 1h, `2`: 3h, `3`: tomorrow, `4`: next Monday) |
| `c` | Copy `git checkout <branch>` or URL |
| `u` | Toggle Read / Unread |
| `p` | Pin / Unpin item |
| `/` | Focus search bar |
| `r` | Sync notifications with GitHub |
| `?` | Keyboard shortcuts reference |
| `Esc` | Close modal / clear search |

---

## Build & Test

### Make
```bash
make build          # Build standalone binary (./bin/githelp)
make test           # Run backend, frontend, and Playwright E2E tests
make lint           # Go vet & TypeScript check
```

### Bazel
```bash
./bazel build //... # Hermetic workspace build
./bazel test //...  # Run all test targets
./bazel run //:githelp # Build and launch server
```

---

## Architecture

- **Backend**: Go (`net/http`, pure Go `modernc.org/sqlite` with WAL mode).
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Distribution**: Single executable with embedded assets (`//go:embed all:dist`).

---

## License

MIT
