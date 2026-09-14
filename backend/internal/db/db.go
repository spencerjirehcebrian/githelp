// Package db stores the only thing GitHelp needs to remember: which
// repositories you track and how you authenticate.
//
// It used to mirror GitHub into local tables of notifications and triage
// state, which meant the interface could disagree with GitHub and had to be
// reconciled. The brief is generated from a live query every time, so there
// is nothing left to cache and nothing left to go stale.
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
	mu sync.RWMutex
}

func Open(dbPath string) (*DB, error) {
	// WAL mode and a busy timeout keep concurrent reads safe.
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON&_synchronous=NORMAL", dbPath)
	sqliteDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	sqliteDB.SetMaxOpenConns(10)
	sqliteDB.SetMaxIdleConns(5)
	sqliteDB.SetConnMaxLifetime(time.Hour)

	dbInstance := &DB{db: sqliteDB}
	if err := dbInstance.initSchema(); err != nil {
		sqliteDB.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return dbInstance, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

// defaultTrackedRepo is used until the user picks one in settings.
const defaultTrackedRepo = "theteamatx/x-benjamin-repo"

func (d *DB) initSchema() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if _, err := d.db.Exec(`
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`); err != nil {
		return err
	}

	// Drop the mirror of GitHub that earlier versions maintained. Leaving it
	// behind would keep a stale copy of every notification on disk forever.
	for _, stmt := range []string{
		`DROP TABLE IF EXISTS triage`,
		`DROP TABLE IF EXISTS notifications`,
		`DROP TABLE IF EXISTS standups`,
	} {
		if _, err := d.db.Exec(stmt); err != nil {
			return err
		}
	}

	// Settings that no longer correspond to any behaviour.
	for _, key := range []string{
		"poll_interval_sec",
		"enable_browser_notifications",
		"enable_sound",
		"ignored_repos",
		"theme",
		"preferred_editor",
	} {
		if _, err := d.db.Exec(`DELETE FROM settings WHERE key = ?`, key); err != nil {
			return err
		}
	}

	defaults := map[string]string{
		"auth_mode":     "gh_cli",
		"tracked_repos": fmt.Sprintf(`[%q]`, defaultTrackedRepo),
	}
	for k, v := range defaults {
		if _, err := d.db.Exec(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, k, v); err != nil {
			return err
		}
	}

	return nil
}

// GetSettings retrieves application settings.
func (d *DB) GetSettings() (*AppSettings, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, fmt.Errorf("failed to query settings: %w", err)
	}
	defer rows.Close()

	values := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		values[k] = v
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	s := &AppSettings{
		AuthMode: values["auth_mode"],
		PATToken: values["pat_token"],
	}
	if s.AuthMode == "" {
		s.AuthMode = "gh_cli"
	}

	if raw := values["tracked_repos"]; raw != "" {
		var repos []string
		if err := json.Unmarshal([]byte(raw), &repos); err == nil {
			s.TrackedRepos = repos
		}
	}
	// The brief needs somewhere to point, so an empty list is not a valid
	// resting state.
	if len(s.TrackedRepos) == 0 {
		s.TrackedRepos = []string{defaultTrackedRepo}
	}

	return s, nil
}

// SaveSettings writes user settings.
func (d *DB) SaveSettings(s *AppSettings) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tracked, err := json.Marshal(s.TrackedRepos)
	if err != nil {
		tracked = []byte("[]")
	}

	values := map[string]string{
		"auth_mode":     s.AuthMode,
		"pat_token":     s.PATToken,
		"tracked_repos": string(tracked),
	}

	for k, v := range values {
		if _, err := tx.Exec(
			`INSERT INTO settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			k, v,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}
