package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

func TestAuthManager(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "auth_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open failed: %v", err)
	}
	defer database.Close()

	mgr := NewManager(database)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "Bearer valid-pat-token" {
			w.Header().Set("X-OAuth-Scopes", "notifications, repo, read:org")
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"login": "testuser", "name": "Test User", "avatar_url": "https://avatar.test"}`))
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"message": "Bad credentials"}`))
	}))
	defer ts.Close()

	mgr.client = ts.Client()

	ctx := context.Background()

	// Direct validation with empty token
	status, err := mgr.ValidateToken(ctx, "")
	if err != nil || status.Authenticated {
		t.Errorf("expected empty token to fail, got status: %+v, err: %v", status, err)
	}

	// Test settings persistence
	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	settings.AuthMode = "pat"
	settings.PATToken = "some-pat"
	if err := database.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	token, mode, err := mgr.GetToken(ctx)
	if err != nil {
		t.Fatalf("GetToken failed: %v", err)
	}
	if mode != "pat" || token != "some-pat" {
		t.Errorf("expected pat mode and 'some-pat', got %s / %s", mode, token)
	}

	// Disconnect reverts
	_, _ = mgr.Disconnect(ctx)
	updatedSettings, _ := database.GetSettings()
	if updatedSettings.AuthMode != "gh_cli" || updatedSettings.PATToken != "" {
		t.Errorf("expected disconnect to reset settings, got: %+v", updatedSettings)
	}
}
