package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

func TestAuthManagerComprehensive(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "auth_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	mgr := NewManager(database)

	// Mock GitHub server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "Bearer valid-pat-token" {
			w.Header().Set("X-OAuth-Scopes", "notifications, repo, read:org")
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"login": "testuser", "name": "Test User", "avatar_url": "https://avatar.test"}`))
			return
		}
		if authHeader == "Bearer rate-limited-token" {
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"message": "API rate limit exceeded"}`))
			return
		}
		if authHeader == "Bearer server-error-token" {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message": "Internal error"}`))
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"message": "Bad credentials"}`))
	}))
	defer ts.Close()

	mgr.SetBaseURL(ts.URL)
	mgr.SetHTTPClient(ts.Client())

	ctx := context.Background()

	// 1. Empty token validation
	status, err := mgr.ValidateToken(ctx, "")
	if err != nil || status.Authenticated {
		t.Errorf("expected empty token to fail validation, got status: %+v", status)
	}

	// 2. Rate limited token validation
	status, err = mgr.ValidateToken(ctx, "rate-limited-token")
	if err != nil || status.Authenticated {
		t.Errorf("expected rate-limited token to not be authenticated, got status: %+v", status)
	}

	// 3. Valid PAT configuration and validation
	status, err = mgr.SetPAT(ctx, "valid-pat-token")
	if err != nil || !status.Authenticated || status.Username != "testuser" {
		t.Fatalf("SetPAT failed: status=%+v, err=%v", status, err)
	}
	if status.Scopes != "notifications, repo, read:org" {
		t.Errorf("expected scopes 'notifications, repo, read:org', got '%s'", status.Scopes)
	}

	// Check saved settings
	settings, _ := database.GetSettings()
	if settings.AuthMode != "pat" || settings.PATToken != "valid-pat-token" {
		t.Errorf("unexpected settings after SetPAT: %+v", settings)
	}

	// 4. GetStatus with cached active token
	status, err = mgr.GetStatus(ctx)
	if err != nil || !status.Authenticated || status.AuthMode != "pat" {
		t.Errorf("GetStatus failed: %+v, err=%v", status, err)
	}

	// 5. Disconnect and revert to gh CLI mode
	status, err = mgr.Disconnect(ctx)
	if status.AuthMode != "gh_cli" {
		t.Errorf("expected auth_mode gh_cli after disconnect, got %s", status.AuthMode)
	}

	updatedSettings, _ := database.GetSettings()
	if updatedSettings.AuthMode != "gh_cli" || updatedSettings.PATToken != "" {
		t.Errorf("expected PAT token cleared, got: %+v", updatedSettings)
	}
}
