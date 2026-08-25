package db

import (
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestDBComprehensive(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_githelp.db")

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer database.Close()

	// 1. Settings CRUD and default verification
	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings.AuthMode != "gh_cli" || settings.PollIntervalSec != 60 || settings.Theme != "dark" {
		t.Errorf("unexpected default settings: %+v", settings)
	}

	settings.Theme = "light"
	settings.PollIntervalSec = 120
	settings.IgnoredRepos = []string{"org/repo-a", "org/repo-b"}
	if err := database.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	updatedSettings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if updatedSettings.Theme != "light" || updatedSettings.PollIntervalSec != 120 || len(updatedSettings.IgnoredRepos) != 2 {
		t.Errorf("unexpected updated settings: %+v", updatedSettings)
	}

	// 2. Insert test notifications with special characters in titles and repos
	now := time.Now().UTC()
	items := []*Notification{
		{
			ID:              "n-1",
			GitHubID:        "gh-1",
			Repository:      "owner/test-repo",
			Title:           "Fix issue with 'quotes' and %wildcard% chars",
			Type:            "PullRequest",
			Reason:          "review_requested",
			URL:             "https://api.github.com/repos/owner/test-repo/pulls/10",
			HTMLURL:         "https://github.com/owner/test-repo/pull/10",
			State:           "open",
			CIStatus:        "success",
			Author:          "alice",
			Branch:          "fix/quotes",
			Number:          10,
			Unread:          true,
			GitHubUpdatedAt: now,
		},
		{
			ID:              "n-2",
			GitHubID:        "gh-2",
			Repository:      "owner/other-repo",
			Title:           "Documentation update for v2",
			Type:            "Issue",
			Reason:          "mention",
			URL:             "https://api.github.com/repos/owner/other-repo/issues/5",
			HTMLURL:         "https://github.com/owner/other-repo/issues/5",
			State:           "open",
			Author:          "bob",
			Number:          5,
			Unread:          false,
			GitHubUpdatedAt: now.Add(-10 * time.Minute),
		},
		{
			ID:              "n-3",
			GitHubID:        "gh-3",
			Repository:      "org/alpha-repo",
			Title:           "Refactor database layer",
			Type:            "PullRequest",
			Reason:          "author",
			URL:             "https://api.github.com/repos/org/alpha-repo/pulls/20",
			HTMLURL:         "https://github.com/org/alpha-repo/pull/20",
			State:           "open",
			CIStatus:        "failure",
			Author:          "carol",
			Branch:          "refactor-db",
			Number:          20,
			Unread:          true,
			GitHubUpdatedAt: now.Add(-20 * time.Minute),
		},
	}

	for _, item := range items {
		if err := database.UpsertNotification(item); err != nil {
			t.Fatalf("UpsertNotification(%s) failed: %v", item.ID, err)
		}
	}

	// Insert Triage states
	_ = database.UpsertTriageState(&TriageState{NotificationID: "n-1", Bucket: "action_required", Status: "inbox", Pinned: false, UpdatedAt: now})
	_ = database.UpsertTriageState(&TriageState{NotificationID: "n-2", Bucket: "mentions", Status: "inbox", Pinned: true, UpdatedAt: now})
	_ = database.UpsertTriageState(&TriageState{NotificationID: "n-3", Bucket: "action_required", Status: "inbox", Pinned: false, UpdatedAt: now})

	// 3. Test Filtering (by bucket, repo, query)
	actionRequiredList, err := database.ListEnrichedNotifications("action_required", "", "inbox", "")
	if err != nil || len(actionRequiredList) != 2 {
		t.Fatalf("expected 2 action_required items, got %d (err: %v)", len(actionRequiredList), err)
	}

	repoList, err := database.ListEnrichedNotifications("", "owner/other-repo", "inbox", "")
	if err != nil || len(repoList) != 1 || repoList[0].ID != "n-2" {
		t.Fatalf("expected 1 item for owner/other-repo, got %d", len(repoList))
	}

	queryList, err := database.ListEnrichedNotifications("", "", "inbox", "quotes")
	if err != nil || len(queryList) != 1 || queryList[0].ID != "n-1" {
		t.Fatalf("expected 1 item for query 'quotes', got %d", len(queryList))
	}

	// 4. Test Pin sorting (Pinned item n-2 should be at the top)
	allInbox, err := database.ListEnrichedNotifications("", "", "inbox", "")
	if err != nil || len(allInbox) != 3 {
		t.Fatalf("expected 3 inbox items, got %d", len(allInbox))
	}
	if allInbox[0].ID != "n-2" || !allInbox[0].Triage.Pinned {
		t.Errorf("expected pinned item n-2 first in list, got %s", allInbox[0].ID)
	}

	// 5. Test Batch Update
	if err := database.BatchUpdateTriageStatus([]string{"n-1", "n-3"}, "done", nil); err != nil {
		t.Fatalf("BatchUpdateTriageStatus failed: %v", err)
	}

	doneCounts, _ := database.GetBucketCounts()
	if doneCounts["done"] != 2 || doneCounts["inbox_total"] != 1 {
		t.Errorf("unexpected counts after batch done: %+v", doneCounts)
	}

	// 6. Test Snooze & Reactivation
	pastTime := now.Add(-10 * time.Minute)
	if err := database.UpdateTriageStatus("n-2", "snoozed", &pastTime, nil, nil); err != nil {
		t.Fatalf("UpdateTriageStatus to snoozed failed: %v", err)
	}

	reactivated, err := database.ReactivateSnoozedNotifications()
	if err != nil || len(reactivated) != 1 || reactivated[0] != "n-2" {
		t.Fatalf("expected n-2 reactivated, got %v (err: %v)", reactivated, err)
	}

	// 7. Test Unread toggle
	if err := database.SetUnreadStatus("n-1", false); err != nil {
		t.Fatalf("SetUnreadStatus failed: %v", err)
	}
	notifs, _ := database.ListEnrichedNotifications("", "", "", "quotes")
	if len(notifs) > 0 && notifs[0].Unread {
		t.Errorf("expected unread false after update")
	}

	// 8. Test Concurrency (10 concurrent readers and writers)
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(2)
		workerID := i
		go func() {
			defer wg.Done()
			_ = database.UpsertNotification(&Notification{
				ID:              fmt.Sprintf("concurrent-%d", workerID),
				Repository:      "owner/test-repo",
				Title:           fmt.Sprintf("Concurrent PR %d", workerID),
				Type:            "PullRequest",
				Reason:          "review_requested",
				GitHubUpdatedAt: time.Now().UTC(),
			})
		}()
		go func() {
			defer wg.Done()
			_, _ = database.ListEnrichedNotifications("", "", "inbox", "")
			_, _ = database.GetBucketCounts()
		}()
	}
	wg.Wait()
}
