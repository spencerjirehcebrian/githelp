package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
)

// newTestHandler builds a server against a scratch database.
func newTestHandler(t *testing.T) (http.Handler, *db.DB) {
	t.Helper()

	database, err := db.Open(filepath.Join(t.TempDir(), "api_test.db"))
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	authMgr := auth.NewManager(database)
	server := NewServer(ServerConfig{
		Host:    "127.0.0.1",
		Port:    8080,
		DB:      database,
		AuthMgr: authMgr,
		Client:  github.NewClient(authMgr, database),
	})

	return server.Handler(), database
}

func do(t *testing.T, handler http.Handler, method, path string, body []byte) *httptest.ResponseRecorder {
	t.Helper()

	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader(body)
	}

	req := httptest.NewRequest(method, path, reader)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

func TestPreflightAndSecurityHeaders(t *testing.T) {
	handler, _ := newTestHandler(t)

	req := httptest.NewRequest("OPTIONS", "/api/status", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS preflight, got %d", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Access-Control-Allow-Origin = %q, want the request origin", got)
	}
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("X-Content-Type-Options header is missing")
	}
	if rr.Header().Get("X-Frame-Options") != "SAMEORIGIN" {
		t.Error("X-Frame-Options header is missing")
	}
}

func TestGetStatusReportsAuthAndTime(t *testing.T) {
	handler, _ := newTestHandler(t)

	rr := do(t, handler, "GET", "/api/status", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/status = %d, want 200: %s", rr.Code, rr.Body.String())
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode status: %v", err)
	}
	for _, key := range []string{"auth", "server_time"} {
		if _, ok := payload[key]; !ok {
			t.Errorf("status response is missing %q", key)
		}
	}
	// The counts the inbox needed are gone along with the inbox.
	if _, ok := payload["bucket_counts"]; ok {
		t.Error("status response still carries bucket_counts")
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	handler, _ := newTestHandler(t)

	rr := do(t, handler, "GET", "/api/settings", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/settings = %d, want 200", rr.Code)
	}

	payload, _ := json.Marshal(db.AppSettings{
		AuthMode:     "gh_cli",
		TrackedRepos: []string{"acme/widgets", "acme/gadgets"},
	})
	if rr := do(t, handler, "PUT", "/api/settings", payload); rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/settings = %d, want 200: %s", rr.Code, rr.Body.String())
	}

	rr = do(t, handler, "GET", "/api/settings", nil)
	var saved db.AppSettings
	if err := json.NewDecoder(rr.Body).Decode(&saved); err != nil {
		t.Fatalf("failed to decode settings: %v", err)
	}
	if len(saved.TrackedRepos) != 2 || saved.TrackedRepos[0] != "acme/widgets" {
		t.Errorf("tracked repos = %v, want the two that were saved", saved.TrackedRepos)
	}
}

// A masked token must not be written back over the real one, otherwise
// reading settings and saving them unchanged would destroy your credentials.
func TestSettingsUpdateKeepsMaskedToken(t *testing.T) {
	handler, database := newTestHandler(t)

	if err := database.SaveSettings(&db.AppSettings{
		AuthMode:     "pat",
		PATToken:     "ghp_secret_value",
		TrackedRepos: []string{"acme/widgets"},
	}); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	rr := do(t, handler, "GET", "/api/settings", nil)
	var masked db.AppSettings
	if err := json.NewDecoder(rr.Body).Decode(&masked); err != nil {
		t.Fatalf("failed to decode settings: %v", err)
	}
	if masked.PATToken == "ghp_secret_value" {
		t.Fatal("the full token was sent to the client")
	}
	if !strings.Contains(masked.PATToken, "...") {
		t.Fatalf("token = %q, want it masked", masked.PATToken)
	}

	payload, _ := json.Marshal(masked)
	if rr := do(t, handler, "PUT", "/api/settings", payload); rr.Code != http.StatusOK {
		t.Fatalf("PUT /api/settings = %d, want 200", rr.Code)
	}

	stored, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if stored.PATToken != "ghp_secret_value" {
		t.Errorf("stored token = %q, want the original", stored.PATToken)
	}
}

func TestMalformedPayloadIsRejected(t *testing.T) {
	handler, _ := newTestHandler(t)

	req := httptest.NewRequest("PUT", "/api/settings", strings.NewReader("not json"))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("PUT with invalid JSON = %d, want 400", rr.Code)
	}
}

// The inbox routes are gone. A stale client hitting them should get a clean
// 404 rather than a partially working endpoint.
func TestRetiredRoutesAreGone(t *testing.T) {
	handler, _ := newTestHandler(t)

	retired := []struct {
		method string
		path   string
	}{
		{"GET", "/api/notifications"},
		{"POST", "/api/notifications/sync"},
		{"POST", "/api/notifications/bulk"},
		{"GET", "/api/counts"},
		{"GET", "/api/repos"},
		{"GET", "/api/standup"},
		{"GET", "/api/backlog"},
		{"GET", "/api/worktrees"},
		{"GET", "/api/events"},
	}

	for _, route := range retired {
		rr := do(t, handler, route.method, route.path, nil)
		// The static handler is registered for GET only, so an unknown POST
		// is rejected by method rather than by path. Either way nothing is
		// serving it.
		if rr.Code != http.StatusNotFound && rr.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s %s = %d, want 404 or 405", route.method, route.path, rr.Code)
		}
	}

}
