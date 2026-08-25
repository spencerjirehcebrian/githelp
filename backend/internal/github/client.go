package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/triage"
)

type Client struct {
	authMgr    *auth.Manager
	db         *db.DB
	httpClient *http.Client
	baseURL    string
	graphqlURL string
}

func NewClient(authMgr *auth.Manager, database *db.DB) *Client {
	return &Client{
		authMgr: authMgr,
		db:      database,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		baseURL:    "https://api.github.com",
		graphqlURL: "https://api.github.com/graphql",
	}
}

// GitHub API Models
type RawNotification struct {
	ID         string `json:"id"`
	Unread     bool   `json:"unread"`
	Reason     string `json:"reason"`
	UpdatedAt  string `json:"updated_at"`
	LastReadAt string `json:"last_read_at"`
	Subject    struct {
		Title            string `json:"title"`
		URL              string `json:"url"`
		LatestCommentURL string `json:"latest_comment_url"`
		Type             string `json:"type"`
	} `json:"subject"`
	Repository struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		HTMLURL  string `json:"html_url"`
		Owner    struct {
			Login     string `json:"login"`
			AvatarURL string `json:"avatar_url"`
		} `json:"owner"`
	} `json:"repository"`
	URL string `json:"url"`
}

type PullRequestDetail struct {
	Number  int    `json:"number"`
	State   string `json:"state"`
	Draft   bool   `json:"draft"`
	Merged  bool   `json:"merged"`
	HTMLURL string `json:"html_url"`
	Title   string `json:"title"`
	User    struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
	Head struct {
		Ref string `json:"ref"`
		SHA string `json:"sha"`
	} `json:"head"`
}

type IssueDetail struct {
	Number  int    `json:"number"`
	State   string `json:"state"`
	HTMLURL string `json:"html_url"`
	Title   string `json:"title"`
	User    struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
}

type CombinedStatus struct {
	State string `json:"state"` // "pending", "success", "failure", "error"
}

// FetchRawNotifications retrieves notifications from GitHub API.
func (c *Client) FetchRawNotifications(ctx context.Context, all bool) ([]RawNotification, error) {
	token, _, err := c.authMgr.GetToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("auth error: %w", err)
	}

	url := fmt.Sprintf("%s/notifications?per_page=50", c.baseURL)
	if all {
		url += "&all=true"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to GitHub notifications failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub notifications API error %d: %s", resp.StatusCode, string(body))
	}

	var rawList []RawNotification
	if err := json.NewDecoder(resp.Body).Decode(&rawList); err != nil {
		return nil, fmt.Errorf("failed to decode notifications: %w", err)
	}

	return rawList, nil
}

// EnrichItem fetches additional PR or Issue details for a notification item.
func (c *Client) EnrichItem(ctx context.Context, token string, raw *RawNotification) (*db.Notification, error) {
	parsedUpdated, _ := time.Parse(time.RFC3339, raw.UpdatedAt)
	var parsedLastRead *time.Time
	if raw.LastReadAt != "" {
		if t, err := time.Parse(time.RFC3339, raw.LastReadAt); err == nil {
			parsedLastRead = &t
		}
	}

	n := &db.Notification{
		ID:              raw.ID,
		GitHubID:        raw.ID,
		Repository:      raw.Repository.FullName,
		Title:           raw.Subject.Title,
		Type:            raw.Subject.Type,
		Reason:          raw.Reason,
		URL:             raw.Subject.URL,
		HTMLURL:         raw.Repository.HTMLURL,
		State:           "open",
		CIStatus:        "",
		Author:          raw.Repository.Owner.Login,
		AuthorAvatar:    raw.Repository.Owner.AvatarURL,
		Unread:          raw.Unread,
		GitHubUpdatedAt: parsedUpdated,
		LastReadAt:      parsedLastRead,
	}

	// Default HTML URL fallback
	if raw.Subject.Type == "CheckSuite" {
		n.HTMLURL = fmt.Sprintf("%s/actions", raw.Repository.HTMLURL)
		n.CIStatus = "failure"
		return n, nil
	}

	if raw.Subject.URL == "" {
		return n, nil
	}

	// Query details for PR or Issue
	req, err := http.NewRequestWithContext(ctx, "GET", raw.Subject.URL, nil)
	if err != nil {
		return n, nil
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return n, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return n, nil
	}

	if raw.Subject.Type == "PullRequest" {
		var pr PullRequestDetail
		if err := json.NewDecoder(resp.Body).Decode(&pr); err == nil {
			n.HTMLURL = pr.HTMLURL
			n.Number = pr.Number
			n.Branch = pr.Head.Ref
			if pr.User.Login != "" {
				n.Author = pr.User.Login
				n.AuthorAvatar = pr.User.AvatarURL
			}
			if pr.Merged {
				n.State = "merged"
			} else if pr.Draft {
				n.State = "draft"
			} else {
				n.State = pr.State
			}

			// If PR has commit sha, check CI status
			if pr.Head.SHA != "" && raw.Repository.FullName != "" {
				ciStatus := c.fetchCIStatus(ctx, token, raw.Repository.FullName, pr.Head.SHA)
				if ciStatus != "" {
					n.CIStatus = ciStatus
				}
			}
		}
	} else if raw.Subject.Type == "Issue" {
		var issue IssueDetail
		if err := json.NewDecoder(resp.Body).Decode(&issue); err == nil {
			n.HTMLURL = issue.HTMLURL
			n.Number = issue.Number
			if issue.User.Login != "" {
				n.Author = issue.User.Login
				n.AuthorAvatar = issue.User.AvatarURL
			}
			n.State = issue.State
		}
	} else {
		// Fallback for commit/release
		var generic map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&generic); err == nil {
			if htmlURL, ok := generic["html_url"].(string); ok && htmlURL != "" {
				n.HTMLURL = htmlURL
			}
		}
	}

	return n, nil
}

func (c *Client) fetchCIStatus(ctx context.Context, token, repo, ref string) string {
	url := fmt.Sprintf("%s/repos/%s/commits/%s/status", c.baseURL, repo, ref)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()

	var cs CombinedStatus
	if err := json.NewDecoder(resp.Body).Decode(&cs); err == nil {
		switch cs.State {
		case "success":
			return "success"
		case "failure", "error":
			return "failure"
		case "pending":
			return "pending"
		default:
			return ""
		}
	}
	return ""
}

// Sync performs a full sync from GitHub, saves notifications to SQLite, and updates triage states.
func (c *Client) Sync(ctx context.Context) (int, error) {
	status, err := c.authMgr.GetStatus(ctx)
	if err != nil || !status.Authenticated {
		return 0, fmt.Errorf("cannot sync: not authenticated")
	}

	token, _, err := c.authMgr.GetToken(ctx)
	if err != nil {
		return 0, err
	}

	// Fetch unread notifications
	rawList, err := c.FetchRawNotifications(ctx, false)
	if err != nil {
		return 0, err
	}

	settings, err := c.db.GetSettings()
	if err != nil {
		return 0, err
	}

	ignoredMap := make(map[string]bool)
	for _, r := range settings.IgnoredRepos {
		ignoredMap[strings.ToLower(strings.TrimSpace(r))] = true
	}

	syncedCount := 0
	for _, raw := range rawList {
		if ignoredMap[strings.ToLower(strings.TrimSpace(raw.Repository.FullName))] {
			continue
		}

		item, err := c.EnrichItem(ctx, token, &raw)
		if err != nil || item == nil {
			continue
		}

		if err := c.db.UpsertNotification(item); err != nil {
			continue
		}

		// Compute and upsert triage state
		existingList, _ := c.db.ListEnrichedNotifications("", "", "", item.ID)
		var existingTriage *db.TriageState
		for _, ex := range existingList {
			if ex.ID == item.ID {
				existingTriage = &ex.Triage
				break
			}
		}

		tState := triage.ComputeTriageState(item, status.Username, existingTriage)
		_ = c.db.UpsertTriageState(tState)
		syncedCount++
	}

	// Reactivate any expired snoozed items
	_, _ = c.db.ReactivateSnoozedNotifications()

	return syncedCount, nil
}
