package standup

import (
	"fmt"
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

// Generator produces Rad-formatted daily standup reports.
type Generator struct {
	database *db.DB
}

// NewGenerator creates a new Standup Generator.
func NewGenerator(database *db.DB) *Generator {
	return &Generator{database: database}
}

// GenerateStandup drafts the daily standup for the target date (YYYY-MM-DD).
func (g *Generator) GenerateStandup(targetDate string, primaryRepo string) (*db.StandupResponse, error) {
	if targetDate == "" {
		targetDate = time.Now().UTC().Format("2006-01-02")
	}

	// 1. Check if a customized standup was already saved for today
	saved, err := g.database.GetStandup(targetDate)
	if err == nil && saved != nil && strings.TrimSpace(saved.Content) != "" {
		return &db.StandupResponse{
			Date:          targetDate,
			FormattedText: saved.Content,
			IsSaved:       true,
		}, nil
	}

	// 2. Query data components
	since := time.Now().UTC().Add(-48 * time.Hour)
	mergedList, _ := g.database.ListRecentlyMergedPRs(primaryRepo, since)
	yesterdayTasks, _ := g.database.ListYesterdayCompletedTasks()
	activeList, _ := g.database.ListEnrichedNotifications("", primaryRepo, "inbox", "")

	var mergedLines []string
	var forReviewLines []string
	var doneLines []string
	var todoLines []string

	seenDone := make(map[int]bool)
	seenTodo := make(map[int]bool)

	// Section 1: Merged
	for _, pr := range mergedList {
		num := pr.Number
		cleanTitle := cleanSubject(pr.Title)
		line := fmt.Sprintf("%d(merged) - %s", num, cleanTitle)
		mergedLines = append(mergedLines, line)

		if num > 0 && !seenDone[num] {
			doneLines = append(doneLines, fmt.Sprintf("%d - %s, addressed reviews, and merged", num, cleanTitle))
			seenDone[num] = true
		}
	}

	// Section 2: For Review & Section 4: Todo
	for _, item := range activeList {
		if item.Type == "PullRequest" && (item.State == "open" || item.State == "draft") {
			cleanTitle := cleanSubject(item.Title)
			if item.Reason == "author" {
				waitingOn := ""
				if len(item.PendingReviewers) > 0 {
					waitingOn = fmt.Sprintf("waiting on %s", strings.Join(item.PendingReviewers, ", "))
				} else if len(item.Approvers) > 0 {
					waitingOn = fmt.Sprintf("approved by %s", strings.Join(item.Approvers, ", "))
				}

				reviewLine := fmt.Sprintf("%d(for review) - %s", item.Number, cleanTitle)
				if waitingOn != "" {
					reviewLine = fmt.Sprintf("%s (%s)", reviewLine, waitingOn)
				}
				forReviewLines = append(forReviewLines, reviewLine)

				// Add to Todo if in today focus or action required
				if (item.Triage.Pinned || item.Triage.Bucket == "action_required" || item.BallInCourt == "you") && !seenTodo[item.Number] {
					todoLines = append(todoLines, fmt.Sprintf("%d - coordinate review and follow up for %s", item.Number, cleanTitle))
					seenTodo[item.Number] = true
				}
			} else if item.Reason == "review_requested" {
				if !seenTodo[item.Number] {
					authorStr := ""
					if item.Author != "" {
						authorStr = fmt.Sprintf(" for @%s", item.Author)
					}
					todoLines = append(todoLines, fmt.Sprintf("%d - review PR%s: %s", item.Number, authorStr, cleanTitle))
					seenTodo[item.Number] = true
				}
			}
		}
	}

	// Section 3: Done (Yesterday completed tasks in GitHelp)
	for _, task := range yesterdayTasks {
		if task.Number > 0 && !seenDone[task.Number] {
			cleanTitle := cleanSubject(task.Title)
			doneLines = append(doneLines, fmt.Sprintf("%d - completed %s", task.Number, cleanTitle))
			seenDone[task.Number] = true
		}
	}

	// Fallback placeholders if empty
	if len(mergedLines) == 0 {
		mergedLines = append(mergedLines, "None")
	}
	if len(forReviewLines) == 0 {
		forReviewLines = append(forReviewLines, "None")
	}
	if len(doneLines) == 0 {
		doneLines = append(doneLines, "Continue in-flight tasks")
	}
	if len(todoLines) == 0 {
		todoLines = append(todoLines, "Review pending items and continue sprint tasks")
	}

	// Format into clean Rad Standup text
	var sb strings.Builder
	sb.WriteString("Merged\n")
	for _, l := range mergedLines {
		sb.WriteString(l + "\n")
	}
	sb.WriteString("\nFor Review\n")
	for _, l := range forReviewLines {
		sb.WriteString(l + "\n")
	}
	sb.WriteString("\nDone\n")
	for _, l := range doneLines {
		sb.WriteString(l + "\n")
	}
	sb.WriteString("\nTodo\n")
	for _, l := range todoLines {
		sb.WriteString(l + "\n")
	}

	return &db.StandupResponse{
		Date:          targetDate,
		FormattedText: strings.TrimSpace(sb.String()),
		IsSaved:       false,
		Merged:        mergedLines,
		ForReview:     forReviewLines,
		Done:          doneLines,
		Todo:          todoLines,
	}, nil
}

func cleanSubject(title string) string {
	title = strings.TrimSpace(title)
	if colonIdx := strings.Index(title, ":"); colonIdx != -1 {
		prefix := strings.ToLower(strings.TrimSpace(title[:colonIdx]))
		prefix = strings.TrimSuffix(prefix, "!")
		for _, base := range []string{"feat", "fix", "chore", "docs", "refactor", "perf", "test"} {
			if prefix == base || (strings.HasPrefix(prefix, base+"(") && strings.HasSuffix(prefix, ")")) {
				return strings.TrimSpace(title[colonIdx+1:])
			}
		}
	}
	return title
}
