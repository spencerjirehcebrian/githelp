package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
	mu sync.RWMutex
}

func Open(dbPath string) (*DB, error) {
	// Enable WAL mode and busy timeout for concurrent safety
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON&_synchronous=NORMAL", dbPath)
	sqliteDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// SQLite single-writer or small connection pool
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

func (d *DB) initSchema() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	schema := `
	CREATE TABLE IF NOT EXISTS notifications (
		id TEXT PRIMARY KEY,
		github_id TEXT,
		repository TEXT NOT NULL,
		title TEXT NOT NULL,
		type TEXT NOT NULL,
		reason TEXT NOT NULL,
		url TEXT,
		html_url TEXT,
		state TEXT,
		ci_status TEXT,
		author TEXT,
		author_avatar TEXT,
		branch TEXT,
		number INTEGER DEFAULT 0,
		unread INTEGER NOT NULL DEFAULT 1,
		github_updated_at DATETIME NOT NULL,
		last_read_at DATETIME,
		raw_data TEXT,
		approvers TEXT DEFAULT '[]',
		pending_reviewers TEXT DEFAULT '[]',
		changes_requested_by TEXT DEFAULT '[]',
		ball_in_court TEXT DEFAULT 'none',
		latest_comment_author TEXT DEFAULT '',
		latest_comment_body TEXT DEFAULT '',
		local_worktree_path TEXT DEFAULT ''
	);

	CREATE INDEX IF NOT EXISTS idx_notifications_repo ON notifications(repository);
	CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(unread);
	CREATE INDEX IF NOT EXISTS idx_notifications_updated ON notifications(github_updated_at);

	CREATE TABLE IF NOT EXISTS triage (
		notification_id TEXT PRIMARY KEY,
		bucket TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'inbox',
		snoozed_until DATETIME,
		pinned INTEGER NOT NULL DEFAULT 0,
		notes TEXT DEFAULT '',
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_triage_bucket_status ON triage(bucket, status);
	CREATE INDEX IF NOT EXISTS idx_triage_snoozed_until ON triage(snoozed_until);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS standups (
		id TEXT PRIMARY KEY,
		date TEXT NOT NULL UNIQUE,
		content TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_standups_date ON standups(date);
	`

	_, err := d.db.Exec(schema)
	if err != nil {
		return err
	}

	// Run migrations for existing databases
	migrationCols := []string{
		"ALTER TABLE notifications ADD COLUMN approvers TEXT DEFAULT '[]'",
		"ALTER TABLE notifications ADD COLUMN pending_reviewers TEXT DEFAULT '[]'",
		"ALTER TABLE notifications ADD COLUMN changes_requested_by TEXT DEFAULT '[]'",
		"ALTER TABLE notifications ADD COLUMN ball_in_court TEXT DEFAULT 'none'",
		"ALTER TABLE notifications ADD COLUMN latest_comment_author TEXT DEFAULT ''",
		"ALTER TABLE notifications ADD COLUMN latest_comment_body TEXT DEFAULT ''",
		"ALTER TABLE notifications ADD COLUMN local_worktree_path TEXT DEFAULT ''",
	}
	for _, colSQL := range migrationCols {
		_, _ = d.db.Exec(colSQL)
	}

	// Set default settings if not present
	defaults := map[string]string{
		"auth_mode":                    "gh_cli",
		"poll_interval_sec":            "60",
		"enable_browser_notifications": "true",
		"enable_sound":                 "false",
		"ignored_repos":                "[]",
		"tracked_repos":                `["theteamatx/x-benjamin-repo"]`,
		"theme":                        "dark",
	}

	for k, v := range defaults {
		_, err = d.db.Exec(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, k, v)
		if err != nil {
			return err
		}
	}

	return nil
}

// GetSettings retrieves application settings from the database.
func (d *DB) GetSettings() (*AppSettings, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, fmt.Errorf("failed to query settings: %w", err)
	}
	defer rows.Close()

	settingsMap := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		settingsMap[k] = v
	}

	s := &AppSettings{
		AuthMode:                   settingsMap["auth_mode"],
		PATToken:                   settingsMap["pat_token"],
		PollIntervalSec:            60,
		EnableBrowserNotifications: settingsMap["enable_browser_notifications"] == "true",
		EnableSound:                settingsMap["enable_sound"] == "true",
		Theme:                      settingsMap["theme"],
	}

	if s.AuthMode == "" {
		s.AuthMode = "gh_cli"
	}
	if s.Theme == "" {
		s.Theme = "dark"
	}
	if pollStr, ok := settingsMap["poll_interval_sec"]; ok {
		var poll int
		if _, err := fmt.Sscanf(pollStr, "%d", &poll); err == nil && poll >= 15 {
			s.PollIntervalSec = poll
		}
	}
	if reposJSON, ok := settingsMap["ignored_repos"]; ok && reposJSON != "" {
		var repos []string
		if err := json.Unmarshal([]byte(reposJSON), &repos); err == nil {
			s.IgnoredRepos = repos
		}
	}
	if s.IgnoredRepos == nil {
		s.IgnoredRepos = []string{}
	}

	if trackedJSON, ok := settingsMap["tracked_repos"]; ok && trackedJSON != "" {
		var repos []string
		if err := json.Unmarshal([]byte(trackedJSON), &repos); err == nil {
			s.TrackedRepos = repos
		}
	}
	if s.TrackedRepos == nil {
		s.TrackedRepos = []string{"theteamatx/x-benjamin-repo"}
	}

	return s, nil
}

// SaveSettings updates user settings in the database.
func (d *DB) SaveSettings(s *AppSettings) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	reposJSON, err := json.Marshal(s.IgnoredRepos)
	if err != nil {
		reposJSON = []byte("[]")
	}

	trackedJSON, err := json.Marshal(s.TrackedRepos)
	if err != nil {
		trackedJSON = []byte("[]")
	}

	kvs := map[string]string{
		"auth_mode":                    s.AuthMode,
		"pat_token":                    s.PATToken,
		"poll_interval_sec":            fmt.Sprintf("%d", s.PollIntervalSec),
		"enable_browser_notifications": fmt.Sprintf("%t", s.EnableBrowserNotifications),
		"enable_sound":                 fmt.Sprintf("%t", s.EnableSound),
		"ignored_repos":                string(reposJSON),
		"tracked_repos":                string(trackedJSON),
		"theme":                        s.Theme,
	}

	for k, v := range kvs {
		_, err := tx.Exec(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, k, v)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// UpsertNotification saves a notification item.
func (d *DB) UpsertNotification(n *Notification) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	var lastReadAtStr interface{}
	if n.LastReadAt != nil {
		lastReadAtStr = n.LastReadAt.Format(time.RFC3339)
	}

	unreadInt := 0
	if n.Unread {
		unreadInt = 1
	}

	approversJSON, _ := json.Marshal(n.Approvers)
	if len(n.Approvers) == 0 {
		approversJSON = []byte("[]")
	}

	pendingJSON, _ := json.Marshal(n.PendingReviewers)
	if len(n.PendingReviewers) == 0 {
		pendingJSON = []byte("[]")
	}

	changesJSON, _ := json.Marshal(n.ChangesRequestedBy)
	if len(n.ChangesRequestedBy) == 0 {
		changesJSON = []byte("[]")
	}

	ballInCourt := n.BallInCourt
	if ballInCourt == "" {
		ballInCourt = "none"
	}

	query := `
	INSERT INTO notifications (
		id, github_id, repository, title, type, reason, url, html_url,
		state, ci_status, author, author_avatar, branch, number, unread,
		github_updated_at, last_read_at, raw_data,
		approvers, pending_reviewers, changes_requested_by, ball_in_court,
		latest_comment_author, latest_comment_body, local_worktree_path
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		github_id = excluded.github_id,
		repository = excluded.repository,
		title = excluded.title,
		type = excluded.type,
		reason = excluded.reason,
		url = excluded.url,
		html_url = CASE WHEN excluded.html_url != '' THEN excluded.html_url ELSE notifications.html_url END,
		state = CASE WHEN excluded.state != '' THEN excluded.state ELSE notifications.state END,
		ci_status = CASE WHEN excluded.ci_status != '' THEN excluded.ci_status ELSE notifications.ci_status END,
		author = CASE WHEN excluded.author != '' THEN excluded.author ELSE notifications.author END,
		author_avatar = CASE WHEN excluded.author_avatar != '' THEN excluded.author_avatar ELSE notifications.author_avatar END,
		branch = CASE WHEN excluded.branch != '' THEN excluded.branch ELSE notifications.branch END,
		number = CASE WHEN excluded.number > 0 THEN excluded.number ELSE notifications.number END,
		unread = excluded.unread,
		github_updated_at = excluded.github_updated_at,
		last_read_at = excluded.last_read_at,
		raw_data = CASE WHEN excluded.raw_data != '' THEN excluded.raw_data ELSE notifications.raw_data END,
		approvers = excluded.approvers,
		pending_reviewers = excluded.pending_reviewers,
		changes_requested_by = excluded.changes_requested_by,
		ball_in_court = excluded.ball_in_court,
		latest_comment_author = CASE WHEN excluded.latest_comment_author != '' THEN excluded.latest_comment_author ELSE notifications.latest_comment_author END,
		latest_comment_body = CASE WHEN excluded.latest_comment_body != '' THEN excluded.latest_comment_body ELSE notifications.latest_comment_body END,
		local_worktree_path = CASE WHEN excluded.local_worktree_path != '' THEN excluded.local_worktree_path ELSE notifications.local_worktree_path END
	`

	_, err := d.db.Exec(query,
		n.ID, n.GitHubID, n.Repository, n.Title, n.Type, n.Reason, n.URL, n.HTMLURL,
		n.State, n.CIStatus, n.Author, n.AuthorAvatar, n.Branch, n.Number, unreadInt,
		n.GitHubUpdatedAt.Format(time.RFC3339), lastReadAtStr, n.RawData,
		string(approversJSON), string(pendingJSON), string(changesJSON), ballInCourt,
		n.LatestCommentAuthor, n.LatestCommentBody, n.LocalWorktreePath,
	)
	return err
}

// UpsertTriageState saves triage state if not already set or updates bucket.
func (d *DB) UpsertTriageState(t *TriageState) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	var snoozedUntilStr interface{}
	if t.SnoozedUntil != nil {
		snoozedUntilStr = t.SnoozedUntil.Format(time.RFC3339)
	}

	pinnedInt := 0
	if t.Pinned {
		pinnedInt = 1
	}

	query := `
	INSERT INTO triage (
		notification_id, bucket, status, snoozed_until, pinned, notes, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(notification_id) DO UPDATE SET
		bucket = excluded.bucket,
		status = CASE WHEN excluded.bucket = 'done' OR excluded.status = 'done' THEN 'done' ELSE triage.status END,
		updated_at = excluded.updated_at
	`

	_, err := d.db.Exec(query,
		t.NotificationID, t.Bucket, t.Status, snoozedUntilStr, pinnedInt, t.Notes, t.UpdatedAt.Format(time.RFC3339),
	)
	return err
}

// GetTriageState retrieves the triage state for a single notification ID.
func (d *DB) GetTriageState(notificationID string) (*TriageState, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var t TriageState
	var snoozedUntilStr sql.NullString
	var pinnedInt int
	var updatedStr string

	err := d.db.QueryRow(`
		SELECT notification_id, bucket, status, snoozed_until, pinned, notes, updated_at
		FROM triage
		WHERE notification_id = ?
	`, notificationID).Scan(
		&t.NotificationID, &t.Bucket, &t.Status, &snoozedUntilStr, &pinnedInt, &t.Notes, &updatedStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	t.Pinned = pinnedInt == 1
	if snoozedUntilStr.Valid && snoozedUntilStr.String != "" {
		if pt, err := time.Parse(time.RFC3339, snoozedUntilStr.String); err == nil {
			t.SnoozedUntil = &pt
		}
	}
	if ut, err := time.Parse(time.RFC3339, updatedStr); err == nil {
		t.UpdatedAt = ut
	}

	return &t, nil
}

// UpdateTriageStatus updates the user's action status (inbox, done, snoozed, pinned, notes).
func (d *DB) UpdateTriageStatus(id string, status string, snoozedUntil *time.Time, pinned *bool, notes *string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	var snoozedUntilStr interface{}
	if snoozedUntil != nil {
		snoozedUntilStr = snoozedUntil.Format(time.RFC3339)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	var currentPinned int
	var currentNotes string
	var currentStatus string
	var currentBucket string

	err := d.db.QueryRow(`SELECT bucket, status, pinned, notes FROM triage WHERE notification_id = ?`, id).Scan(&currentBucket, &currentStatus, &currentPinned, &currentNotes)
	if err != nil {
		// If triage doesn't exist yet, insert with defaults
		if err == sql.ErrNoRows {
			currentBucket = "participating"
			currentStatus = "inbox"
		} else {
			return err
		}
	}

	if status != "" {
		currentStatus = status
	}
	if pinned != nil {
		if *pinned {
			currentPinned = 1
		} else {
			currentPinned = 0
		}
	}
	if notes != nil {
		currentNotes = *notes
	}

	query := `
	INSERT INTO triage (notification_id, bucket, status, snoozed_until, pinned, notes, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(notification_id) DO UPDATE SET
		status = excluded.status,
		snoozed_until = excluded.snoozed_until,
		pinned = excluded.pinned,
		notes = excluded.notes,
		updated_at = excluded.updated_at
	`

	_, err = d.db.Exec(query, id, currentBucket, currentStatus, snoozedUntilStr, currentPinned, currentNotes, now)
	return err
}

// BatchUpdateTriageStatus bulk updates triage status for multiple notification IDs.
func (d *DB) BatchUpdateTriageStatus(ids []string, status string, snoozedUntil *time.Time) error {
	if len(ids) == 0 {
		return nil
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	var snoozedUntilStr interface{}
	if snoozedUntil != nil {
		snoozedUntilStr = snoozedUntil.Format(time.RFC3339)
	}

	stmt, err := tx.Prepare(`
		UPDATE triage SET status = ?, snoozed_until = ?, updated_at = ? WHERE notification_id = ?
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, id := range ids {
		_, err := stmt.Exec(status, snoozedUntilStr, now, id)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ReactivateSnoozedNotifications returns items whose snooze deadline has expired to 'inbox'.
func (d *DB) ReactivateSnoozedNotifications() ([]string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)

	rows, err := d.db.Query(`
		SELECT notification_id FROM triage
		WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?
	`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expiredIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		expiredIDs = append(expiredIDs, id)
	}

	if len(expiredIDs) > 0 {
		_, err = d.db.Exec(`
			UPDATE triage
			SET status = 'inbox', snoozed_until = NULL, updated_at = ?
			WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?
		`, now, now)
		if err != nil {
			return nil, err
		}
	}

	return expiredIDs, nil
}

// ListEnrichedNotifications retrieves notifications with triage state, filtering by bucket, repo, status, and search query.
func (d *DB) ListEnrichedNotifications(bucket, repo, status, query string) ([]*EnrichedNotification, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var conditions []string
	var args []interface{}

	if status != "" {
		conditions = append(conditions, "t.status = ?")
		args = append(args, status)
	}

	if bucket != "" {
		conditions = append(conditions, "t.bucket = ?")
		args = append(args, bucket)
	}

	if repo != "" {
		conditions = append(conditions, "n.repository = ?")
		args = append(args, repo)
	}

	if query != "" {
		qPattern := "%" + query + "%"
		conditions = append(conditions, "(n.title LIKE ? OR n.repository LIKE ? OR n.author LIKE ? OR n.reason LIKE ? OR t.notes LIKE ?)")
		args = append(args, qPattern, qPattern, qPattern, qPattern, qPattern)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	sqlQuery := fmt.Sprintf(`
		SELECT
			n.id,
			COALESCE(n.github_id, ''),
			n.repository,
			n.title,
			n.type,
			n.reason,
			COALESCE(n.url, ''),
			COALESCE(n.html_url, ''),
			COALESCE(n.state, ''),
			COALESCE(n.ci_status, ''),
			COALESCE(n.author, ''),
			COALESCE(n.author_avatar, ''),
			COALESCE(n.branch, ''),
			COALESCE(n.number, 0),
			COALESCE(n.unread, 1),
			COALESCE(n.github_updated_at, ''),
			n.last_read_at,
			COALESCE(n.raw_data, ''),
			COALESCE(n.approvers, '[]'),
			COALESCE(n.pending_reviewers, '[]'),
			COALESCE(n.changes_requested_by, '[]'),
			COALESCE(n.ball_in_court, 'none'),
			COALESCE(n.latest_comment_author, ''),
			COALESCE(n.latest_comment_body, ''),
			COALESCE(n.local_worktree_path, ''),
			COALESCE(t.bucket, 'participating'),
			COALESCE(t.status, 'inbox'),
			t.snoozed_until,
			COALESCE(t.pinned, 0),
			COALESCE(t.notes, ''),
			t.updated_at
		FROM notifications n
		LEFT JOIN triage t ON n.id = t.notification_id
		%s
		ORDER BY t.pinned DESC, n.github_updated_at DESC
	`, whereClause)

	rows, err := d.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query enriched notifications: %w", err)
	}
	defer rows.Close()

	return d.scanEnrichedRows(rows)
}

func (d *DB) scanEnrichedRows(rows *sql.Rows) ([]*EnrichedNotification, error) {
	var results []*EnrichedNotification
	for rows.Next() {
		var item EnrichedNotification
		var unreadInt int
		var pinnedInt int
		var lastReadStr sql.NullString
		var snoozedUntilStr sql.NullString
		var githubUpdatedStr string
		var triageUpdatedStr sql.NullString
		var bucketStr sql.NullString
		var statusStr sql.NullString
		var notesStr sql.NullString
		var approversStr, pendingStr, changesStr string

		err := rows.Scan(
			&item.ID, &item.GitHubID, &item.Repository, &item.Title, &item.Type, &item.Reason,
			&item.URL, &item.HTMLURL, &item.State, &item.CIStatus, &item.Author, &item.AuthorAvatar,
			&item.Branch, &item.Number, &unreadInt, &githubUpdatedStr, &lastReadStr, &item.RawData,
			&approversStr, &pendingStr, &changesStr, &item.BallInCourt,
			&item.LatestCommentAuthor, &item.LatestCommentBody, &item.LocalWorktreePath,
			&bucketStr, &statusStr, &snoozedUntilStr, &pinnedInt, &notesStr, &triageUpdatedStr,
		)
		if err != nil {
			return nil, fmt.Errorf("scan error: %w", err)
		}

		item.Unread = unreadInt == 1
		item.Triage.NotificationID = item.ID
		item.Triage.Pinned = pinnedInt == 1
		item.Triage.Bucket = bucketStr.String
		if item.Triage.Bucket == "" {
			item.Triage.Bucket = "participating"
		}
		item.Triage.Status = statusStr.String
		if item.Triage.Status == "" {
			item.Triage.Status = "inbox"
		}
		item.Triage.Notes = notesStr.String

		_ = json.Unmarshal([]byte(approversStr), &item.Approvers)
		_ = json.Unmarshal([]byte(pendingStr), &item.PendingReviewers)
		_ = json.Unmarshal([]byte(changesStr), &item.ChangesRequestedBy)

		if t, err := time.Parse(time.RFC3339, githubUpdatedStr); err == nil {
			item.GitHubUpdatedAt = t
		}
		if lastReadStr.Valid {
			if t, err := time.Parse(time.RFC3339, lastReadStr.String); err == nil {
				item.LastReadAt = &t
			}
		}
		if snoozedUntilStr.Valid {
			if t, err := time.Parse(time.RFC3339, snoozedUntilStr.String); err == nil {
				item.Triage.SnoozedUntil = &t
			}
		}
		if triageUpdatedStr.Valid {
			if t, err := time.Parse(time.RFC3339, triageUpdatedStr.String); err == nil {
				item.Triage.UpdatedAt = t
			}
		}

		results = append(results, &item)
	}

	return results, nil
}

// SaveStandup creates or updates a standup record for a specific date (YYYY-MM-DD).
func (d *DB) SaveStandup(date string, content string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	id := "standup-" + date
	now := time.Now().UTC()
	query := `
	INSERT INTO standups (id, date, content, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?)
	ON CONFLICT(date) DO UPDATE SET
		content = excluded.content,
		updated_at = excluded.updated_at
	`
	_, err := d.db.Exec(query, id, date, content, now, now)
	return err
}

// GetStandup retrieves the standup entry for a given date (YYYY-MM-DD).
func (d *DB) GetStandup(date string) (*StandupEntry, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var s StandupEntry
	var createdStr, updatedStr string
	err := d.db.QueryRow(`SELECT id, date, content, created_at, updated_at FROM standups WHERE date = ?`, date).
		Scan(&s.ID, &s.Date, &s.Content, &createdStr, &updatedStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	s.CreatedAt, _ = time.Parse(time.RFC3339, createdStr)
	s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedStr)
	return &s, nil
}

// ListRecentlyMergedPRs returns PRs authored by the user that were merged since the given timestamp.
func (d *DB) ListRecentlyMergedPRs(repo string, since time.Time) ([]*EnrichedNotification, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	sinceStr := since.Format(time.RFC3339)
	var rows *sql.Rows
	var err error
	if repo != "" {
		rows, err = d.db.Query(`
			SELECT
				n.id, COALESCE(n.github_id, ''), n.repository, n.title, n.type, n.reason,
				COALESCE(n.url, ''), COALESCE(n.html_url, ''), COALESCE(n.state, ''),
				COALESCE(n.ci_status, ''), COALESCE(n.author, ''), COALESCE(n.author_avatar, ''),
				COALESCE(n.branch, ''), COALESCE(n.number, 0), COALESCE(n.unread, 1),
				COALESCE(n.github_updated_at, ''), n.last_read_at, COALESCE(n.raw_data, ''),
				COALESCE(n.approvers, '[]'), COALESCE(n.pending_reviewers, '[]'),
				COALESCE(n.changes_requested_by, '[]'), COALESCE(n.ball_in_court, 'none'),
				COALESCE(n.latest_comment_author, ''), COALESCE(n.latest_comment_body, ''),
				COALESCE(n.local_worktree_path, ''),
				COALESCE(t.bucket, 'participating'), COALESCE(t.status, 'inbox'),
				t.snoozed_until, COALESCE(t.pinned, 0), COALESCE(t.notes, ''), t.updated_at
			FROM notifications n
			LEFT JOIN triage t ON n.id = t.notification_id
			WHERE n.type = 'PullRequest' AND n.state = 'merged' AND n.repository = ? AND n.github_updated_at >= ?
			ORDER BY n.github_updated_at DESC
		`, repo, sinceStr)
	} else {
		rows, err = d.db.Query(`
			SELECT
				n.id, COALESCE(n.github_id, ''), n.repository, n.title, n.type, n.reason,
				COALESCE(n.url, ''), COALESCE(n.html_url, ''), COALESCE(n.state, ''),
				COALESCE(n.ci_status, ''), COALESCE(n.author, ''), COALESCE(n.author_avatar, ''),
				COALESCE(n.branch, ''), COALESCE(n.number, 0), COALESCE(n.unread, 1),
				COALESCE(n.github_updated_at, ''), n.last_read_at, COALESCE(n.raw_data, ''),
				COALESCE(n.approvers, '[]'), COALESCE(n.pending_reviewers, '[]'),
				COALESCE(n.changes_requested_by, '[]'), COALESCE(n.ball_in_court, 'none'),
				COALESCE(n.latest_comment_author, ''), COALESCE(n.latest_comment_body, ''),
				COALESCE(n.local_worktree_path, ''),
				COALESCE(t.bucket, 'participating'), COALESCE(t.status, 'inbox'),
				t.snoozed_until, COALESCE(t.pinned, 0), COALESCE(t.notes, ''), t.updated_at
			FROM notifications n
			LEFT JOIN triage t ON n.id = t.notification_id
			WHERE n.type = 'PullRequest' AND n.state = 'merged' AND n.github_updated_at >= ?
			ORDER BY n.github_updated_at DESC
		`, sinceStr)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return d.scanEnrichedRows(rows)
}

// ListYesterdayCompletedTasks returns tasks marked 'done' in the last 48 hours.
func (d *DB) ListYesterdayCompletedTasks() ([]*EnrichedNotification, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	sinceStr := time.Now().UTC().Add(-48 * time.Hour).Format(time.RFC3339)
	rows, err := d.db.Query(`
		SELECT
			n.id, COALESCE(n.github_id, ''), n.repository, n.title, n.type, n.reason,
			COALESCE(n.url, ''), COALESCE(n.html_url, ''), COALESCE(n.state, ''),
			COALESCE(n.ci_status, ''), COALESCE(n.author, ''), COALESCE(n.author_avatar, ''),
			COALESCE(n.branch, ''), COALESCE(n.number, 0), COALESCE(n.unread, 1),
			COALESCE(n.github_updated_at, ''), n.last_read_at, COALESCE(n.raw_data, ''),
			COALESCE(n.approvers, '[]'), COALESCE(n.pending_reviewers, '[]'),
			COALESCE(n.changes_requested_by, '[]'), COALESCE(n.ball_in_court, 'none'),
			COALESCE(n.latest_comment_author, ''), COALESCE(n.latest_comment_body, ''),
			COALESCE(n.local_worktree_path, ''),
			COALESCE(t.bucket, 'participating'), COALESCE(t.status, 'done'),
			t.snoozed_until, COALESCE(t.pinned, 0), COALESCE(t.notes, ''), t.updated_at
		FROM notifications n
		JOIN triage t ON n.id = t.notification_id
		WHERE t.status = 'done' AND t.updated_at >= ?
		ORDER BY t.updated_at DESC
	`, sinceStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return d.scanEnrichedRows(rows)
}

// ListClaimableIssues returns open unassigned issues.
func (d *DB) ListClaimableIssues(repo string) ([]*ClaimableIssue, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var rows *sql.Rows
	var err error
	if repo != "" {
		rows, err = d.db.Query(`
			SELECT
				n.id, COALESCE(n.github_id, ''), n.repository, n.title, n.type, n.reason,
				COALESCE(n.url, ''), COALESCE(n.html_url, ''), COALESCE(n.state, ''),
				COALESCE(n.ci_status, ''), COALESCE(n.author, ''), COALESCE(n.author_avatar, ''),
				COALESCE(n.branch, ''), COALESCE(n.number, 0), COALESCE(n.unread, 1),
				COALESCE(n.github_updated_at, ''), n.last_read_at, COALESCE(n.raw_data, ''),
				COALESCE(n.approvers, '[]'), COALESCE(n.pending_reviewers, '[]'),
				COALESCE(n.changes_requested_by, '[]'), COALESCE(n.ball_in_court, 'none'),
				COALESCE(n.latest_comment_author, ''), COALESCE(n.latest_comment_body, ''),
				COALESCE(n.local_worktree_path, '')
			FROM notifications n
			WHERE n.type = 'Issue' AND n.state = 'open' AND n.reason = 'claimable' AND n.repository = ?
			ORDER BY n.github_updated_at DESC
		`, repo)
	} else {
		rows, err = d.db.Query(`
			SELECT
				n.id, COALESCE(n.github_id, ''), n.repository, n.title, n.type, n.reason,
				COALESCE(n.url, ''), COALESCE(n.html_url, ''), COALESCE(n.state, ''),
				COALESCE(n.ci_status, ''), COALESCE(n.author, ''), COALESCE(n.author_avatar, ''),
				COALESCE(n.branch, ''), COALESCE(n.number, 0), COALESCE(n.unread, 1),
				COALESCE(n.github_updated_at, ''), n.last_read_at, COALESCE(n.raw_data, ''),
				COALESCE(n.approvers, '[]'), COALESCE(n.pending_reviewers, '[]'),
				COALESCE(n.changes_requested_by, '[]'), COALESCE(n.ball_in_court, 'none'),
				COALESCE(n.latest_comment_author, ''), COALESCE(n.latest_comment_body, ''),
				COALESCE(n.local_worktree_path, '')
			FROM notifications n
			WHERE n.type = 'Issue' AND n.state = 'open' AND n.reason = 'claimable'
			ORDER BY n.github_updated_at DESC
		`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*ClaimableIssue
	now := time.Now().UTC()
	for rows.Next() {
		var item ClaimableIssue
		var unreadInt int
		var lastReadStr sql.NullString
		var githubUpdatedStr string
		var approversStr, pendingStr, changesStr string

		err := rows.Scan(
			&item.ID, &item.GitHubID, &item.Repository, &item.Title, &item.Type, &item.Reason,
			&item.URL, &item.HTMLURL, &item.State, &item.CIStatus, &item.Author, &item.AuthorAvatar,
			&item.Branch, &item.Number, &unreadInt, &githubUpdatedStr, &lastReadStr, &item.RawData,
			&approversStr, &pendingStr, &changesStr, &item.BallInCourt,
			&item.LatestCommentAuthor, &item.LatestCommentBody, &item.LocalWorktreePath,
		)
		if err != nil {
			return nil, err
		}
		item.Unread = unreadInt == 1
		_ = json.Unmarshal([]byte(approversStr), &item.Approvers)
		_ = json.Unmarshal([]byte(pendingStr), &item.PendingReviewers)
		_ = json.Unmarshal([]byte(changesStr), &item.ChangesRequestedBy)
		if t, err := time.Parse(time.RFC3339, githubUpdatedStr); err == nil {
			item.GitHubUpdatedAt = t
			item.DaysOpen = int(now.Sub(t).Hours() / 24)
		}
		list = append(list, &item)
	}

	return list, nil
}

// PruneStaleClaimableIssues deletes claimable issues for the repo that are no longer in the active IDs list.
func (d *DB) PruneStaleClaimableIssues(repo string, activeIDs []string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if len(activeIDs) == 0 {
		_, err := d.db.Exec(`DELETE FROM notifications WHERE type = 'Issue' AND reason = 'claimable' AND repository = ?`, repo)
		return err
	}

	placeholders := make([]string, len(activeIDs))
	args := make([]interface{}, 0, len(activeIDs)+1)
	args = append(args, repo)
	for i, id := range activeIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(`
		DELETE FROM notifications
		WHERE type = 'Issue' AND reason = 'claimable' AND repository = ? AND id NOT IN (%s)
	`, strings.Join(placeholders, ","))

	_, err := d.db.Exec(query, args...)
	return err
}

// GetBucketCounts returns active counts for each bucket (only status = 'inbox' for active buckets, plus total done/snoozed).
func (d *DB) GetBucketCounts() (map[string]int, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	counts := map[string]int{
		"action_required":    0,
		"waiting_on_others":  0,
		"mentions":           0,
		"assigned":           0,
		"participating":      0,
		"done":               0,
		"snoozed":            0,
		"inbox_total":        0,
	}

	// Active inbox bucket counts
	rows, err := d.db.Query(`
		SELECT t.bucket, COUNT(*)
		FROM notifications n
		JOIN triage t ON n.id = t.notification_id
		WHERE t.status = 'inbox'
		GROUP BY t.bucket
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var bucket string
		var count int
		if err := rows.Scan(&bucket, &count); err == nil {
			counts[bucket] = count
			counts["inbox_total"] += count
		}
	}

	// Status counts for done and snoozed
	statusRows, err := d.db.Query(`
		SELECT status, COUNT(*)
		FROM triage
		WHERE status IN ('done', 'snoozed')
		GROUP BY status
	`)
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()

	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err == nil {
			counts[status] = count
		}
	}

	return counts, nil
}

// GetRepoCounts returns counts of inbox notifications per repository.
func (d *DB) GetRepoCounts() (map[string]int, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	counts := make(map[string]int)
	rows, err := d.db.Query(`
		SELECT n.repository, COUNT(*)
		FROM notifications n
		JOIN triage t ON n.id = t.notification_id
		WHERE t.status = 'inbox'
		GROUP BY n.repository
		ORDER BY COUNT(*) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var repo string
		var count int
		if err := rows.Scan(&repo, &count); err == nil {
			counts[repo] = count
		}
	}

	return counts, nil
}

// SetUnreadStatus updates the unread state of a notification.
func (d *DB) SetUnreadStatus(id string, unread bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	unreadInt := 0
	if unread {
		unreadInt = 1
	}

	_, err := d.db.Exec(`UPDATE notifications SET unread = ? WHERE id = ?`, unreadInt, id)
	return err
}
