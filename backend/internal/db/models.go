package db

import (
	"time"
)

// Notification represents a GitHub notification item enriched with PR/Issue metadata.
type Notification struct {
	ID              string     `json:"id"`
	GitHubID        string     `json:"github_id"`
	Repository      string     `json:"repository"`
	Title           string     `json:"title"`
	Type            string     `json:"type"`
	Reason          string     `json:"reason"`
	URL             string     `json:"url"`
	HTMLURL         string     `json:"html_url"`
	State           string     `json:"state"`
	CIStatus        string     `json:"ci_status"`
	Author          string     `json:"author"`
	AuthorAvatar    string     `json:"author_avatar"`
	Branch          string     `json:"branch,omitempty"`
	Number          int        `json:"number,omitempty"`
	Unread              bool       `json:"unread"`
	GitHubUpdatedAt     time.Time  `json:"updated_at"`
	LastReadAt          *time.Time `json:"last_read_at,omitempty"`
	RawData             string     `json:"raw_data,omitempty"`
	Approvers           []string   `json:"approvers,omitempty"`
	PendingReviewers    []string   `json:"pending_reviewers,omitempty"`
	ChangesRequestedBy  []string   `json:"changes_requested_by,omitempty"`
	BallInCourt         string     `json:"ball_in_court,omitempty"` // "you", "reviewer", "none"
	LatestCommentAuthor string     `json:"latest_comment_author,omitempty"`
	LatestCommentBody   string     `json:"latest_comment_body,omitempty"`
	LocalWorktreePath   string     `json:"local_worktree_path,omitempty"`
}

// StandupEntry represents a daily standup record.
type StandupEntry struct {
	ID        string    `json:"id"`
	Date      string    `json:"date"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// StandupResponse represents the generated or saved standup for a given day.
type StandupResponse struct {
	Date          string   `json:"date"`
	FormattedText string   `json:"formatted_text"`
	IsSaved       bool     `json:"is_saved"`
	Merged        []string `json:"merged"`
	ForReview     []string `json:"for_review"`
	Done          []string `json:"done"`
	Todo          []string `json:"todo"`
}

// ClaimableIssue represents an unassigned issue available to pick up.
type ClaimableIssue struct {
	Notification
	DaysOpen  int    `json:"days_open"`
	Subsystem string `json:"subsystem,omitempty"`
}

// TriageState represents the user's triage categorization, inbox status, and snooze rules.
type TriageState struct {
	NotificationID string     `json:"notification_id"`
	Bucket         string     `json:"bucket"`
	Status         string     `json:"status"` // inbox, done, snoozed
	SnoozedUntil   *time.Time `json:"snoozed_until,omitempty"`
	Pinned         bool       `json:"pinned"`
	Notes          string     `json:"notes"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// EnrichedNotification combines Notification and TriageState for UI presentation.
type EnrichedNotification struct {
	Notification
	Triage TriageState `json:"triage"`
}

// AppSettings represents user-configurable settings.
type AppSettings struct {
	AuthMode                   string   `json:"auth_mode"` // "gh_cli" or "pat"
	PATToken                   string   `json:"pat_token,omitempty"`
	PollIntervalSec            int      `json:"poll_interval_sec"`
	EnableBrowserNotifications bool     `json:"enable_browser_notifications"`
	EnableSound                bool     `json:"enable_sound"`
	IgnoredRepos               []string `json:"ignored_repos"`
	TrackedRepos               []string `json:"tracked_repos"`
	Theme                      string   `json:"theme"` // "dark", "light", "system"
}

// AuthStatus returns the current connection and user profile status.
type AuthStatus struct {
	Authenticated bool   `json:"authenticated"`
	AuthMode      string `json:"auth_mode"`
	Username      string `json:"username,omitempty"`
	Name          string `json:"name,omitempty"`
	AvatarURL     string `json:"avatar_url,omitempty"`
	Scopes        string `json:"scopes,omitempty"`
	ErrorMessage  string `json:"error_message,omitempty"`
}
