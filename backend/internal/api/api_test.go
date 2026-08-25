package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
)

func TestAPIRoutes(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "api_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	authMgr := auth.NewManager(database)
	client := github.NewClient(authMgr, database)
	broadcaster := NewSSEBroadcaster()
	poller := github.NewPoller(client, database, broadcaster)

	server := NewServer(ServerConfig{
		Host:        "127.0.0.1",
		Port:        8080,
		DB:          database,
		AuthMgr:     authMgr,
		Client:      client,
		Poller:      poller,
		Broadcaster: broadcaster,
	})

	handler := server.Handler()

	// 1. Test GET /api/status
	req, _ := http.NewRequest("GET", "/api/status", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/status, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. Insert dummy notification & triage
	now := time.Now().UTC()
	n := &db.Notification{
		ID:              "n-100",
		Repository:      "owner/test-repo",
		Title:           "Test PR",
		Type:            "PullRequest",
		Reason:          "review_requested",
		State:           "open",
		Author:          "alice",
		GitHubUpdatedAt: now,
	}
	_ = database.UpsertNotification(n)
	_ = database.UpsertTriageState(&db.TriageState{
		NotificationID: "n-100",
		Bucket:         "action_required",
		Status:         "inbox",
		UpdatedAt:      now,
	})

	// 3. Test GET /api/notifications
	req, _ = http.NewRequest("GET", "/api/notifications?bucket=action_required", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/notifications, got %d", rr.Code)
	}
	var notifs []*db.EnrichedNotification
	if err := json.NewDecoder(rr.Body).Decode(&notifs); err != nil || len(notifs) != 1 {
		t.Fatalf("expected 1 notification decoded, got %d (err: %v)", len(notifs), err)
	}

	// 4. Test PATCH /api/notifications/n-100/state (mark done)
	payload := []byte(`{"status":"done"}`)
	req, _ = http.NewRequest("PATCH", "/api/notifications/n-100/state", bytes.NewReader(payload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PATCH state, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify status is now done
	req, _ = http.NewRequest("GET", "/api/notifications?status=done", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/notifications?status=done, got %d", rr.Code)
	}
	notifs = nil
	_ = json.NewDecoder(rr.Body).Decode(&notifs)
	if len(notifs) != 1 || notifs[0].Triage.Status != "done" {
		t.Fatalf("expected 1 done notification, got %d", len(notifs))
	}

	// 5. Test Settings GET and PUT
	settingsReq, _ := http.NewRequest("GET", "/api/settings", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, settingsReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/settings, got %d", rr.Code)
	}

	updatePayload := []byte(`{"theme":"light","poll_interval_sec":120,"enable_browser_notifications":true,"enable_sound":true,"ignored_repos":["ignored/repo"]}`)
	putReq, _ := http.NewRequest("PUT", "/api/settings", bytes.NewReader(updatePayload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, putReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for PUT /api/settings, got %d: %s", rr.Code, rr.Body.String())
	}

	// 6. Test GET /api/counts and /api/repos
	countsReq, _ := http.NewRequest("GET", "/api/counts", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, countsReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/counts, got %d", rr.Code)
	}

	reposReq, _ := http.NewRequest("GET", "/api/repos", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, reposReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/repos, got %d", rr.Code)
	}
}
