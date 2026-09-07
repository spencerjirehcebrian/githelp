package standup

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

func TestStandupGenerator(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "standup_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	now := time.Now().UTC()

	// 1. Seed merged PR
	_ = database.UpsertNotification(&db.Notification{
		ID:              "pr-merged-1",
		Repository:      "theteamatx/x-benjamin-repo",
		Title:           "feat: update gsutil to gcloud storage in rig runtime",
		Type:            "PullRequest",
		Reason:          "author",
		State:           "merged",
		Number:          3252,
		GitHubUpdatedAt: now.Add(-2 * time.Hour),
	})

	// 2. Seed in-flight PR with reviews
	_ = database.UpsertNotification(&db.Notification{
		ID:               "pr-flight-1",
		Repository:       "theteamatx/x-benjamin-repo",
		Title:            "feat(viewer): replace itemset continue run logic with warning dialog",
		Type:             "PullRequest",
		Reason:           "author",
		State:            "open",
		Number:           3130,
		Approvers:        []string{"antoniorafaelu-dev"},
		PendingReviewers: []string{"kgreatwood-abc"},
		BallInCourt:      "reviewer",
		GitHubUpdatedAt:  now.Add(-1 * time.Hour),
	})
	_ = database.UpsertTriageState(&db.TriageState{
		NotificationID: "pr-flight-1",
		Bucket:         "action_required",
		Status:         "inbox",
		Pinned:         true,
		UpdatedAt:      now,
	})

	// 3. Seed incoming review-requested PR from coworker
	_ = database.UpsertNotification(&db.Notification{
		ID:              "pr-review-req-1",
		Repository:      "theteamatx/x-benjamin-repo",
		Title:           "feat!: upgrade pipeline engine",
		Type:            "PullRequest",
		Reason:          "review_requested",
		State:           "open",
		Author:          "coworker",
		Number:          3300,
		GitHubUpdatedAt: now.Add(-30 * time.Minute),
	})
	_ = database.UpsertTriageState(&db.TriageState{
		NotificationID: "pr-review-req-1",
		Bucket:         "action_required",
		Status:         "inbox",
		Pinned:         false,
		UpdatedAt:      now,
	})

	gen := NewGenerator(database)
	todayStr := now.Format("2006-01-02")
	resp, err := gen.GenerateStandup(todayStr, "theteamatx/x-benjamin-repo")
	if err != nil {
		t.Fatalf("GenerateStandup failed: %v", err)
	}

	if !strings.Contains(resp.FormattedText, "3252(merged) - update gsutil to gcloud storage in rig runtime") {
		t.Errorf("expected Merged section to contain 3252, got:\n%s", resp.FormattedText)
	}
	if !strings.Contains(resp.FormattedText, "3130(for review) - replace itemset continue run logic with warning dialog") {
		t.Errorf("expected For Review section to contain cleaned 3130, got:\n%s", resp.FormattedText)
	}
	if !strings.Contains(resp.FormattedText, "waiting on kgreatwood-abc") {
		t.Errorf("expected For Review to note waiting on Keith, got:\n%s", resp.FormattedText)
	}
	// Review-requested PR from coworker should NOT be in For Review
	if strings.Contains(resp.FormattedText, "3300(for review)") {
		t.Errorf("expected review-requested PR 3300 NOT to be in For Review, got:\n%s", resp.FormattedText)
	}
	// Review-requested PR from coworker SHOULD be in Todo as a review task
	if !strings.Contains(resp.FormattedText, "3300 - review PR for @coworker: upgrade pipeline engine") {
		t.Errorf("expected Todo to contain review task for 3300, got:\n%s", resp.FormattedText)
	}
	if !strings.Contains(resp.FormattedText, "Todo\n3130") {
		t.Errorf("expected Todo section to contain 3130, got:\n%s", resp.FormattedText)
	}

	// 4. Test saving custom standup
	custom := "Merged\n3252(merged) - custom\n\nFor Review\nNone\n\nDone\nNone\n\nTodo\nNone"
	_ = database.SaveStandup(todayStr, custom)

	savedResp, err := gen.GenerateStandup(todayStr, "theteamatx/x-benjamin-repo")
	if err != nil || !savedResp.IsSaved || savedResp.FormattedText != custom {
		t.Errorf("expected saved custom standup, got %+v", savedResp)
	}
}

func TestCleanSubject(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"feat: simple feature", "simple feature"},
		{"feat!: breaking feature", "breaking feature"},
		{"fix(auth)!: breaking fix", "breaking fix"},
		{"chore(deps): bump library", "bump library"},
		{"custom title without prefix", "custom title without prefix"},
	}

	for _, c := range cases {
		actual := cleanSubject(c.input)
		if actual != c.expected {
			t.Errorf("cleanSubject(%q) = %q, expected %q", c.input, actual, c.expected)
		}
	}
}
