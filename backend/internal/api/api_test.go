package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
)

func TestAPIRoutesComprehensive(t *testing.T) {
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

	// 1. Security & CORS Headers Test
	req, _ := http.NewRequest("OPTIONS", "/api/status", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS preflight, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Errorf("missing or invalid CORS origin header: %s", rr.Header().Get("Access-Control-Allow-Origin"))
	}
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" || rr.Header().Get("X-Frame-Options") != "SAMEORIGIN" {
		t.Errorf("missing security headers: %+v", rr.Header())
	}

	// 2. GET /api/status
	req, _ = http.NewRequest("GET", "/api/status", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/status, got %d: %s", rr.Code, rr.Body.String())
	}

	// 3. Seed notification item
	now := time.Now().UTC()
	n := &db.Notification{
		ID:              "n-100",
		Repository:      "owner/test-repo",
		Title:           "Test PR for API integration",
		Type:            "PullRequest",
		Reason:          "review_requested",
		State:           "open",
		Author:          "alice",
		Branch:          "feature/test",
		Number:          100,
		Unread:          true,
		GitHubUpdatedAt: now,
	}
	_ = database.UpsertNotification(n)
	_ = database.UpsertTriageState(&db.TriageState{
		NotificationID: "n-100",
		Bucket:         "action_required",
		Status:         "inbox",
		Pinned:         false,
		UpdatedAt:      now,
	})

	// 4. GET /api/notifications with filtering
	req, _ = http.NewRequest("GET", "/api/notifications?bucket=action_required&q=API", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/notifications, got %d", rr.Code)
	}
	var notifs []*db.EnrichedNotification
	if err := json.NewDecoder(rr.Body).Decode(&notifs); err != nil || len(notifs) != 1 {
		t.Fatalf("expected 1 notification decoded, got %d (err: %v)", len(notifs), err)
	}

	// 5. PATCH /api/notifications/{id}/state (snooze)
	snoozeUntil := now.Add(2 * time.Hour).Format(time.RFC3339)
	pinTrue := true
	unreadFalse := false
	note := "High priority review"
	statePayload, _ := json.Marshal(map[string]interface{}{
		"status":        "snoozed",
		"snoozed_until": snoozeUntil,
		"pinned":        pinTrue,
		"notes":         note,
		"unread":        unreadFalse,
	})

	req, _ = http.NewRequest("PATCH", "/api/notifications/n-100/state", bytes.NewReader(statePayload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PATCH state, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify updated state in database
	snoozedList, _ := database.ListEnrichedNotifications("", "", "snoozed", "")
	if len(snoozedList) != 1 || !snoozedList[0].Triage.Pinned || snoozedList[0].Triage.Notes != note {
		t.Fatalf("expected 1 snoozed and pinned item, got: %+v", snoozedList)
	}

	// 6. POST /api/notifications/bulk
	bulkPayload, _ := json.Marshal(map[string]interface{}{
		"ids":    []string{"n-100"},
		"status": "done",
	})
	req, _ = http.NewRequest("POST", "/api/notifications/bulk", bytes.NewReader(bulkPayload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for bulk update, got %d", rr.Code)
	}

	// 7. Malformed JSON payload tests
	badReq, _ := http.NewRequest("PATCH", "/api/notifications/n-100/state", strings.NewReader("invalid-json"))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, badReq)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for malformed JSON, got %d", rr.Code)
	}

	// 8. Settings GET and PUT
	settingsReq, _ := http.NewRequest("GET", "/api/settings", nil)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, settingsReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/settings, got %d", rr.Code)
	}

	updatePayload, _ := json.Marshal(db.AppSettings{
		AuthMode:                   "gh_cli",
		PollIntervalSec:            45,
		EnableBrowserNotifications: true,
		EnableSound:                true,
		IgnoredRepos:               []string{"noisy/repo"},
		Theme:                      "light",
	})
	putReq, _ := http.NewRequest("PUT", "/api/settings", bytes.NewReader(updatePayload))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, putReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for PUT /api/settings, got %d: %s", rr.Code, rr.Body.String())
	}

	// 9. Repos and Counts endpoints
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
