package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
)

type mockBroadcaster struct {
	mu     sync.Mutex
	events []string
}

func (m *mockBroadcaster) Broadcast(event string, data interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, event)
}

func TestClientAndPollerComprehensive(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "gh_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	authMgr := auth.NewManager(database)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/user" {
			w.Write([]byte(`{"login": "testuser", "name": "Test User", "avatar_url": "https://avatar.test"}`))
			return
		}
		if r.URL.Path == "/notifications" {
			w.Write([]byte(`[
				{
					"id": "1001",
					"unread": true,
					"reason": "review_requested",
					"updated_at": "2026-08-25T10:00:00Z",
					"subject": {
						"title": "Add feature X",
						"url": "` + "http://" + r.Host + `/repos/test/repo/pulls/42",
						"type": "PullRequest"
					},
					"repository": {
						"id": 1,
						"name": "repo",
						"full_name": "test/repo",
						"html_url": "https://github.com/test/repo",
						"owner": {
							"login": "test",
							"avatar_url": "https://avatar.test/org"
						}
					}
				},
				{
					"id": "1002",
					"unread": false,
					"reason": "mention",
					"updated_at": "2026-08-25T09:30:00Z",
					"subject": {
						"title": "Issue with ignored repo",
						"url": "` + "http://" + r.Host + `/repos/ignored/repo/issues/100",
						"type": "Issue"
					},
					"repository": {
						"id": 2,
						"name": "repo",
						"full_name": "ignored/repo",
						"html_url": "https://github.com/ignored/repo",
						"owner": {
							"login": "ignored",
							"avatar_url": "https://avatar.test/ignored"
						}
					}
				}
			]`))
			return
		}
		if r.URL.Path == "/repos/test/repo/pulls/42" {
			w.Write([]byte(`{
				"number": 42,
				"state": "open",
				"draft": false,
				"merged": false,
				"html_url": "https://github.com/test/repo/pull/42",
				"title": "Add feature X",
				"user": {
					"login": "bob",
					"avatar_url": "https://avatar.test/bob"
				},
				"head": {
					"ref": "feature-x",
					"sha": "abc12345"
				}
			}`))
			return
		}
		if r.URL.Path == "/repos/test/repo/commits/abc12345/status" {
			w.Write([]byte(`{"state": "success"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	authMgr.SetBaseURL(ts.URL)
	authMgr.SetHTTPClient(ts.Client())

	// Save PAT and set ignored repos
	settings, _ := database.GetSettings()
	settings.AuthMode = "pat"
	settings.PATToken = "valid-pat"
	settings.IgnoredRepos = []string{"ignored/repo"}
	_ = database.SaveSettings(settings)

	client := NewClient(authMgr, database)
	client.baseURL = ts.URL
	client.httpClient = ts.Client()

	broadcaster := &mockBroadcaster{}
	poller := NewPoller(client, database, broadcaster)

	ctx := context.Background()
	count, err := client.Sync(ctx)
	if err != nil {
		t.Fatalf("client.Sync failed: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 synced notification, got %d", count)
	}

	items, err := database.ListEnrichedNotifications("", "", "", "")
	if err != nil {
		t.Fatalf("ListEnrichedNotifications failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 enriched item, got %d", len(items))
	}
	if items[0].Branch != "feature-x" || items[0].Number != 42 || items[0].CIStatus != "success" {
		t.Errorf("unexpected enriched item: %+v", items[0])
	}

	poller.TriggerSync()
	time.Sleep(50 * time.Millisecond)
	poller.Stop()
}

func TestGraphQLSyncStatePreservationAndErrors(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "gql_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	authMgr := auth.NewManager(database)
	client := NewClient(authMgr, database)

	// 1. Seed existing authored PR with customized triage state
	prID := "pr-theteamatx-x-benjamin-repo-3130"
	_ = database.UpsertNotification(&db.Notification{
		ID:              prID,
		Repository:      "theteamatx/x-benjamin-repo",
		Title:           "feat: warning dialog for itemset",
		Type:            "PullRequest",
		Reason:          "author",
		State:           "open",
		Number:          3130,
		GitHubUpdatedAt: time.Now().UTC(),
	})
	_ = database.UpsertTriageState(&db.TriageState{
		NotificationID: prID,
		Bucket:         "action_required",
		Status:         "done",
		Pinned:         true,
		Notes:          "manual review notes preserved",
		UpdatedAt:      time.Now().UTC(),
	})

	var shouldReturnError bool
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if shouldReturnError {
			w.Write([]byte(`{"errors": [{"message": "API rate limit exceeded"}]}`))
			return
		}
		// Return valid GraphQL response with PR 3130
		w.Write([]byte(`{
			"data": {
				"authored": {
					"nodes": [
						{
							"id": "PR_123",
							"number": 3130,
							"title": "feat: warning dialog for itemset",
							"url": "https://github.com/theteamatx/x-benjamin-repo/pull/3130",
							"state": "OPEN",
							"isDraft": false,
							"headRefName": "feature/warn",
							"updatedAt": "2026-09-07T12:00:00Z",
							"reviewDecision": "APPROVED",
							"author": {"login": "testuser", "avatarUrl": ""},
							"latestReviews": {"nodes": []},
							"reviewRequests": {"nodes": []},
							"commits": {"nodes": []},
							"comments": {"nodes": []}
						}
					]
				},
				"reviewRequested": {"nodes": []},
				"assigned": {"nodes": []},
				"merged": {"nodes": []},
				"unassigned": {"nodes": []}
			}
		}`))
	}))
	defer ts.Close()

	client.httpClient = ts.Client()
	client.graphqlURL = ts.URL

	ctx := context.Background()

	// 2. Test state preservation across successful sync
	count, err := client.SyncRepositoryState(ctx, "token-123", "testuser", "theteamatx/x-benjamin-repo", nil)
	if err != nil {
		t.Fatalf("SyncRepositoryState failed: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 synced item, got %d", count)
	}

	tsCheck, err := database.GetTriageState(prID)
	if err != nil || tsCheck == nil {
		t.Fatalf("GetTriageState failed: %v", err)
	}
	if tsCheck.Status != "done" {
		t.Errorf("expected status 'done' preserved, got '%s'", tsCheck.Status)
	}
	if !tsCheck.Pinned {
		t.Errorf("expected Pinned = true preserved, got false")
	}
	if tsCheck.Notes != "manual review notes preserved" {
		t.Errorf("expected Notes preserved, got '%s'", tsCheck.Notes)
	}

	// 3. Test GraphQL error handling & protection against accidental backlog pruning
	claimableID := "claimable-theteamatx-x-benjamin-repo-999"
	_ = database.UpsertNotification(&db.Notification{
		ID:              claimableID,
		Repository:      "theteamatx/x-benjamin-repo",
		Title:           "Claimable issue 999",
		Type:            "Issue",
		Reason:          "claimable",
		State:           "open",
		Number:          999,
		GitHubUpdatedAt: time.Now().UTC(),
	})

	shouldReturnError = true
	_, err = client.SyncRepositoryState(ctx, "token-123", "testuser", "theteamatx/x-benjamin-repo", nil)
	if err == nil {
		t.Fatalf("expected error from GraphQL with error payload, got nil")
	}
	if !strings.Contains(err.Error(), "API rate limit exceeded") {
		t.Errorf("expected rate limit error message, got: %v", err)
	}

	// Verify claimable issue #999 was NOT pruned due to GraphQL error
	claimables, err := database.ListClaimableIssues("theteamatx/x-benjamin-repo")
	if err != nil {
		t.Fatalf("ListClaimableIssues failed: %v", err)
	}
	if len(claimables) != 1 || claimables[0].Number != 999 {
		t.Errorf("expected claimable issue 999 preserved across error, got %+v", claimables)
	}
}
