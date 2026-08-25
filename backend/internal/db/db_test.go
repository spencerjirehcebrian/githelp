package db

import (
	"path/filepath"
	"testing"
	"time"
)

func TestDBBasics(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_githelp.db")

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer database.Close()

	// 1. Settings check
	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings.AuthMode != "gh_cli" {
		t.Errorf("expected default auth_mode 'gh_cli', got '%s'", settings.AuthMode)
	}

	settings.Theme = "light"
	settings.PollIntervalSec = 90
	if err := database.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	updatedSettings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings after save failed: %v", err)
	}
	if updatedSettings.Theme != "light" || updatedSettings.PollIntervalSec != 90 {
		t.Errorf("unexpected settings values: %+v", updatedSettings)
	}

	// 2. Notification Upsert
	now := time.Now().UTC()
	n1 := &Notification{
		ID:              "n1",
		GitHubID:        "gh1",
		Repository:      "owner/repo",
		Title:           "Fix critical bug",
		Type:            "PullRequest",
		Reason:          "review_requested",
		URL:             "https://api.github.com/repos/owner/repo/pulls/1",
		HTMLURL:         "https://github.com/owner/repo/pull/1",
		State:           "open",
		CIStatus:        "success",
		Author:          "alice",
		AuthorAvatar:    "https://avatar.com/alice",
		Branch:          "fix-bug",
		Number:          1,
		Unread:          true,
		GitHubUpdatedAt: now,
	}

	if err := database.UpsertNotification(n1); err != nil {
		t.Fatalf("UpsertNotification failed: %v", err)
	}

	// 3. Triage Upsert
	t1 := &TriageState{
		NotificationID: "n1",
		Bucket:         "action_required",
		Status:         "inbox",
		Pinned:         false,
		UpdatedAt:      now,
	}
	if err := database.UpsertTriageState(t1); err != nil {
		t.Fatalf("UpsertTriageState failed: %v", err)
	}

	// 4. List and Counts
	list, err := database.ListEnrichedNotifications("", "", "", "")
	if err != nil {
		t.Fatalf("ListEnrichedNotifications failed: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 item, got %d", len(list))
	}
	if list[0].Triage.Bucket != "action_required" {
		t.Errorf("expected bucket action_required, got %s", list[0].Triage.Bucket)
	}

	counts, err := database.GetBucketCounts()
	if err != nil {
		t.Fatalf("GetBucketCounts failed: %v", err)
	}
	if counts["action_required"] != 1 || counts["inbox_total"] != 1 {
		t.Errorf("unexpected bucket counts: %+v", counts)
	}

	// 5. Snooze and reactivate
	past := now.Add(-5 * time.Minute)
	if err := database.UpdateTriageStatus("n1", "snoozed", &past, nil, nil); err != nil {
		t.Fatalf("UpdateTriageStatus to snoozed failed: %v", err)
	}

	reactivated, err := database.ReactivateSnoozedNotifications()
	if err != nil {
		t.Fatalf("ReactivateSnoozedNotifications failed: %v", err)
	}
	if len(reactivated) != 1 || reactivated[0] != "n1" {
		t.Errorf("expected n1 reactivated, got %v", reactivated)
	}

	// Check status is inbox again
	listAfterReactivate, err := database.ListEnrichedNotifications("", "", "inbox", "")
	if err != nil {
		t.Fatalf("ListEnrichedNotifications failed: %v", err)
	}
	if len(listAfterReactivate) != 1 {
		t.Fatalf("expected 1 inbox item after reactivation, got %d", len(listAfterReactivate))
	}
}
