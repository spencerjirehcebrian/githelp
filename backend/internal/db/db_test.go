package db

import (
	"database/sql"
	"path/filepath"
	"sync"
	"testing"
)

func openTemp(t *testing.T) (*DB, string) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "githelp_test.db")
	database, err := Open(path)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return database, path
}

func TestDefaultSettings(t *testing.T) {
	database, _ := openTemp(t)

	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings.AuthMode != "gh_cli" {
		t.Errorf("AuthMode = %q, want gh_cli", settings.AuthMode)
	}
	if len(settings.TrackedRepos) != 1 || settings.TrackedRepos[0] != defaultTrackedRepo {
		t.Errorf("TrackedRepos = %v, want the default single repo", settings.TrackedRepos)
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	database, _ := openTemp(t)

	if err := database.SaveSettings(&AppSettings{
		AuthMode:     "pat",
		PATToken:     "ghp_token",
		TrackedRepos: []string{"acme/widgets", "acme/gadgets"},
	}); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings.AuthMode != "pat" || settings.PATToken != "ghp_token" {
		t.Errorf("auth round trip failed: %+v", settings)
	}
	if len(settings.TrackedRepos) != 2 {
		t.Errorf("TrackedRepos = %v, want two entries", settings.TrackedRepos)
	}
}

// An empty repository list leaves the brief with nowhere to point, so it must
// never be a resting state.
func TestEmptyTrackedReposFallsBackToTheDefault(t *testing.T) {
	database, _ := openTemp(t)

	if err := database.SaveSettings(&AppSettings{AuthMode: "gh_cli", TrackedRepos: nil}); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if len(settings.TrackedRepos) != 1 || settings.TrackedRepos[0] != defaultTrackedRepo {
		t.Errorf("TrackedRepos = %v, want the default", settings.TrackedRepos)
	}
}

func TestSettingsSurviveReopen(t *testing.T) {
	database, path := openTemp(t)

	if err := database.SaveSettings(&AppSettings{
		AuthMode:     "gh_cli",
		TrackedRepos: []string{"acme/widgets"},
	}); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}
	if err := database.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen failed: %v", err)
	}
	defer reopened.Close()

	settings, err := reopened.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if len(settings.TrackedRepos) != 1 || settings.TrackedRepos[0] != "acme/widgets" {
		t.Errorf("TrackedRepos = %v, want the saved value", settings.TrackedRepos)
	}
}

// Opening an older database must drop the mirror of GitHub it was keeping,
// otherwise every notification ever synced stays on disk forever.
func TestOpenDropsTheLegacyTables(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")

	legacy, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("sql.Open failed: %v", err)
	}
	if _, err := legacy.Exec(`
		CREATE TABLE notifications (id TEXT PRIMARY KEY, title TEXT);
		CREATE TABLE triage (notification_id TEXT PRIMARY KEY);
		CREATE TABLE standups (id TEXT PRIMARY KEY);
		CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		INSERT INTO notifications (id, title) VALUES ('n-1', 'stale');
		INSERT INTO settings (key, value) VALUES ('theme', 'dark');
		INSERT INTO settings (key, value) VALUES ('poll_interval_sec', '60');
		INSERT INTO settings (key, value) VALUES ('tracked_repos', '["acme/widgets"]');
	`); err != nil {
		t.Fatalf("failed to seed the legacy database: %v", err)
	}
	if err := legacy.Close(); err != nil {
		t.Fatalf("close failed: %v", err)
	}

	database, err := Open(path)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer database.Close()

	for _, table := range []string{"notifications", "triage", "standups"} {
		var name string
		err := database.db.QueryRow(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
		).Scan(&name)
		if err != sql.ErrNoRows {
			t.Errorf("table %q still exists after migration", table)
		}
	}

	for _, key := range []string{"theme", "poll_interval_sec"} {
		var value string
		err := database.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
		if err != sql.ErrNoRows {
			t.Errorf("retired setting %q survived migration", key)
		}
	}

	// The settings worth keeping must survive.
	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if len(settings.TrackedRepos) != 1 || settings.TrackedRepos[0] != "acme/widgets" {
		t.Errorf("TrackedRepos = %v, want the value from the old database", settings.TrackedRepos)
	}
}

func TestConcurrentSettingsAccess(t *testing.T) {
	database, _ := openTemp(t)

	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if i%2 == 0 {
				_ = database.SaveSettings(&AppSettings{
					AuthMode:     "gh_cli",
					TrackedRepos: []string{"acme/widgets"},
				})
				return
			}
			if _, err := database.GetSettings(); err != nil {
				t.Errorf("concurrent GetSettings failed: %v", err)
			}
		}(i)
	}
	wg.Wait()
}
