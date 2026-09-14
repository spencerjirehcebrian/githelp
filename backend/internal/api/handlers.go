package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
	"github.com/spencerjireh/githelp/backend/internal/rank"
	"github.com/spencerjireh/githelp/backend/internal/standup"
	"github.com/spencerjireh/githelp/backend/internal/worktree"
)

type APIHandler struct {
	db          *db.DB
	authMgr     *auth.Manager
	client      *github.Client
	poller      *github.Poller
	broadcaster *SSEBroadcaster
	standupGen  *standup.Generator
	wtScanner   *worktree.Scanner
	briefCache  *briefCache

	// fetchBriefInputs is the seam between the handler and GitHub. Tests
	// substitute it to exercise caching and conditional requests without a
	// network round trip.
	fetchBriefInputs briefFetchFunc
}

// briefFetchFunc retrieves raw work items for the brief.
type briefFetchFunc func(
	ctx context.Context,
	token, viewer, repo string,
	worktrees map[string]string,
) ([]rank.Input, error)

func NewAPIHandler(database *db.DB, authMgr *auth.Manager, client *github.Client, poller *github.Poller, broadcaster *SSEBroadcaster) *APIHandler {
	h := &APIHandler{
		db:          database,
		authMgr:     authMgr,
		client:      client,
		poller:      poller,
		broadcaster: broadcaster,
		standupGen:  standup.NewGenerator(database),
		wtScanner:   worktree.NewScanner(),
		briefCache:  newBriefCache(),
	}

	if client != nil {
		h.fetchBriefInputs = client.FetchBriefInputs
	}

	return h
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// HandleGetStatus handles GET /api/status
func (h *APIHandler) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.authMgr.GetStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bucketCounts, _ := h.db.GetBucketCounts()
	repoCounts, _ := h.db.GetRepoCounts()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"auth":          status,
		"bucket_counts": bucketCounts,
		"repo_counts":   repoCounts,
		"server_time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// HandleAuthPAT handles POST /api/auth/pat
func (h *APIHandler) HandleAuthPAT(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	status, err := h.authMgr.SetPAT(r.Context(), body.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Trigger initial sync with new token in background
	if h.poller != nil {
		h.poller.TriggerSync()
	}

	writeJSON(w, http.StatusOK, status)
}

// HandleAuthDisconnect handles POST /api/auth/disconnect
func (h *APIHandler) HandleAuthDisconnect(w http.ResponseWriter, r *http.Request) {
	status, err := h.authMgr.Disconnect(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// HandleGetNotifications handles GET /api/notifications
func (h *APIHandler) HandleGetNotifications(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	bucket := query.Get("bucket")
	repo := query.Get("repo")
	status := query.Get("status")
	q := query.Get("q")

	// If status is not provided and bucket is not "done" or "snoozed", default status is "inbox"
	if status == "" {
		if bucket == "done" {
			status = "done"
			bucket = ""
		} else if bucket == "snoozed" {
			status = "snoozed"
			bucket = ""
		} else {
			status = "inbox"
		}
	}

	items, err := h.db.ListEnrichedNotifications(bucket, repo, status, q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if items == nil {
		items = []*db.EnrichedNotification{}
	}

	writeJSON(w, http.StatusOK, items)
}

// HandleSyncNotifications handles POST /api/notifications/sync
func (h *APIHandler) HandleSyncNotifications(w http.ResponseWriter, r *http.Request) {
	count, err := h.client.Sync(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bucketCounts, _ := h.db.GetBucketCounts()
	repoCounts, _ := h.db.GetRepoCounts()

	if h.broadcaster != nil {
		h.broadcaster.Broadcast("sync_completed", map[string]interface{}{
			"synced_count":  count,
			"bucket_counts": bucketCounts,
			"timestamp":     time.Now().UTC().Format(time.RFC3339),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"synced_count":  count,
		"bucket_counts": bucketCounts,
		"repo_counts":   repoCounts,
	})
}

// HandleUpdateNotificationState handles PATCH /api/notifications/{id}/state
func (h *APIHandler) HandleUpdateNotificationState(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Missing notification ID")
		return
	}

	var body struct {
		Status       string  `json:"status"` // "inbox", "done", "snoozed"
		SnoozedUntil *string `json:"snoozed_until"`
		Pinned       *bool   `json:"pinned"`
		Notes        *string `json:"notes"`
		Unread       *bool   `json:"unread"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	var snoozedUntil *time.Time
	if body.SnoozedUntil != nil && strings.TrimSpace(*body.SnoozedUntil) != "" {
		if t, err := time.Parse(time.RFC3339, *body.SnoozedUntil); err == nil {
			snoozedUntil = &t
		}
	}

	if err := h.db.UpdateTriageStatus(id, body.Status, snoozedUntil, body.Pinned, body.Notes); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if body.Unread != nil {
		_ = h.db.SetUnreadStatus(id, *body.Unread)
	}

	if h.broadcaster != nil {
		counts, _ := h.db.GetBucketCounts()
		h.broadcaster.Broadcast("notification_updated", map[string]interface{}{
			"id":            id,
			"status":        body.Status,
			"bucket_counts": counts,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "updated", "id": id})
}

// HandleBulkUpdate handles POST /api/notifications/bulk
func (h *APIHandler) HandleBulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs          []string `json:"ids"`
		Status       string   `json:"status"`
		SnoozedUntil *string  `json:"snoozed_until"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	var snoozedUntil *time.Time
	if body.SnoozedUntil != nil && strings.TrimSpace(*body.SnoozedUntil) != "" {
		if t, err := time.Parse(time.RFC3339, *body.SnoozedUntil); err == nil {
			snoozedUntil = &t
		}
	}

	if err := h.db.BatchUpdateTriageStatus(body.IDs, body.Status, snoozedUntil); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if h.broadcaster != nil {
		counts, _ := h.db.GetBucketCounts()
		h.broadcaster.Broadcast("bulk_updated", map[string]interface{}{
			"ids":           body.IDs,
			"status":        body.Status,
			"bucket_counts": counts,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updated_count": len(body.IDs),
	})
}

// HandleGetSettings handles GET /api/settings
func (h *APIHandler) HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.db.GetSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Mask PAT token in response
	responseSettings := *settings
	if responseSettings.PATToken != "" {
		if len(responseSettings.PATToken) > 6 {
			responseSettings.PATToken = responseSettings.PATToken[:4] + "..." + responseSettings.PATToken[len(responseSettings.PATToken)-2:]
		} else {
			responseSettings.PATToken = "***"
		}
	}

	writeJSON(w, http.StatusOK, responseSettings)
}

// HandleUpdateSettings handles PUT /api/settings
func (h *APIHandler) HandleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var body db.AppSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	current, err := h.db.GetSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Keep existing PAT if masked or omitted
	if body.PATToken == "" || strings.Contains(body.PATToken, "...") || body.PATToken == "***" {
		body.PATToken = current.PATToken
	}

	if body.PollIntervalSec < 15 {
		body.PollIntervalSec = 60
	}
	if body.Theme == "" {
		body.Theme = "dark"
	}
	if body.AuthMode == "" {
		body.AuthMode = current.AuthMode
	}

	if err := h.db.SaveSettings(&body); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// HandleGetBucketCounts handles GET /api/counts
func (h *APIHandler) HandleGetBucketCounts(w http.ResponseWriter, r *http.Request) {
	counts, err := h.db.GetBucketCounts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, counts)
}

// HandleGetRepos handles GET /api/repos
func (h *APIHandler) HandleGetRepos(w http.ResponseWriter, r *http.Request) {
	repos, err := h.db.GetRepoCounts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, repos)
}

// HandleGetStandup handles GET /api/standup?date=YYYY-MM-DD&repo=...
func (h *APIHandler) HandleGetStandup(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	repo := r.URL.Query().Get("repo")

	if repo == "" {
		settings, err := h.db.GetSettings()
		if err == nil && len(settings.TrackedRepos) > 0 {
			repo = settings.TrackedRepos[0]
		}
	}

	res, err := h.standupGen.GenerateStandup(date, repo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// HandleSaveStandup handles POST /api/standup
func (h *APIHandler) HandleSaveStandup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Date    string `json:"date"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if body.Date == "" {
		body.Date = time.Now().UTC().Format("2006-01-02")
	}

	if err := h.db.SaveStandup(body.Date, body.Content); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "saved", "date": body.Date})
}

// HandleGetBacklog handles GET /api/backlog?repo=...
func (h *APIHandler) HandleGetBacklog(w http.ResponseWriter, r *http.Request) {
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		settings, err := h.db.GetSettings()
		if err == nil && len(settings.TrackedRepos) > 0 {
			repo = settings.TrackedRepos[0]
		}
	}

	issues, err := h.db.ListClaimableIssues(repo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, issues)
}

// HandleGetWorktrees handles GET /api/worktrees
func (h *APIHandler) HandleGetWorktrees(w http.ResponseWriter, r *http.Request) {
	worktrees := h.wtScanner.ScanWorktrees()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"worktrees": worktrees,
	})
}
