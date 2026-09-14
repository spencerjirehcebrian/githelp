# GitHelp

A ranked daily brief of your GitHub work, generated on demand, in one page.

![GitHelp](docs/screenshots/brief-light.png)

GitHelp answers one question: what should I do next in this repository. It queries GitHub, ranks everything you are involved in, and prints a short document. Each item gets three lines: what it is, why it is in front of you, and the single next step.

It is not an inbox. There is nothing to triage, snooze, pin, or mark as done, because the brief is regenerated rather than maintained and so cannot drift out of agreement with GitHub.

---

## Lanes

Work is sorted into four bands, rendered in the order you should work through them.

| Lane | What is in it |
| :--- | :--- |
| Unblock others | Somebody is actively waiting on you |
| Land work in flight | Your own work that is close to done |
| Needs a decision | Stalled work to revive or kill |
| Pick up next | Unassigned work you could claim |

Two rules keep the page short enough to read in one pass. Items whose only instruction is to wait are folded into a single line per lane (`2 PRs waiting on reviewers: #203, #204`). The claimable lane is capped at three, with the rest behind an expand row, because browsing available work should not out-compete your blockers for space.

Ranking is a deterministic Go function with no I/O and no model behind it. Given the same items and the same clock it always produces the same order, which means the reasoning is testable and the output is reproducible.

---

## Export

`y` copies the brief as markdown, ready to paste into a coding agent. Every item carries its link and, where one exists, the command to check it out, so the agent does not have to ask a follow-up question before starting.

The export is what is on screen. It respects the active filter and the collapse state, and says so when it is showing a subset, because an agent handed a silently truncated list will confidently work on the wrong thing.

---

## One request

The page issues a single `GET /api/brief` on load. Filtering, grouping, collapsing, and exporting are all local operations on that one payload, so typing in the filter box costs nothing.

Only two things go back to the network: pressing `r`, and switching repository. This is covered by an end-to-end test that counts requests.

---

## Keys

| Key | Action |
| :--- | :--- |
| `j` / `k` | Move down and up |
| `Enter` | Open on GitHub, or expand a collapsed lane |
| `c` | Copy the checkout command |
| `y` | Copy the brief as markdown |
| `r` | Regenerate from GitHub |
| `/` | Filter |
| `Esc` | Clear the filter, or close |
| `?` | Key reference |

| Filtering (`/`) | Key reference (`?`) |
| :---: | :---: |
| ![Filtering](docs/screenshots/filter-dark.png) | ![Keys](docs/screenshots/keys-dark.png) |

The interface follows your operating system for light and dark. There is no toggle.

---

## Quick start

```bash
make run
```

Open http://127.0.0.1:8080. Authentication uses your existing `gh` CLI credentials, or a personal access token set in the settings sheet.

Development mode runs Vite with hot reload on http://localhost:5173 against the backend on port 8080.

```bash
make dev
```

---

## Build and test

```bash
make build          # Standalone binary at ./bin/githelp
make test           # Go, Vitest, and Playwright
make lint           # go vet and tsc --noEmit
```

```bash
./bazel build //...
./bazel test //...
```

---

## Architecture

The server holds no copy of GitHub. It fetches, ranks, and answers.

```
auth.Manager.GetToken
  -> github.Client.FetchBriefInputs   one GraphQL request, six searches
  -> rank.Rank                        pure, clock-injected, no I/O
  -> GET /api/brief                   30s cache, ETag
```

- Backend: Go, `net/http`, `modernc.org/sqlite` in WAL mode. SQLite stores one table: your settings.
- Frontend: React 19, TypeScript, Tailwind.
- Distribution: a single executable with the assets embedded.

---

## License

[MIT](LICENSE)
