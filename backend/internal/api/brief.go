package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/rank"
)

// errNoGitHubClient is returned when the handler was constructed without a
// GitHub client, which makes the brief impossible to generate.
var errNoGitHubClient = errors.New("GitHub client is not configured")

// briefCacheTTL bounds how often a refresh can reach GitHub.
//
// The brief is regenerated on demand, so a user leaning on the refresh key
// would otherwise burn API quota for output that cannot have changed
// meaningfully. The response carries GeneratedAt, so staleness is always
// visible rather than hidden.
const briefCacheTTL = 30 * time.Second

// BriefResponse is the entire payload the client needs.
//
// The client fetches this once and does all filtering, grouping, selection,
// and exporting locally. There is deliberately no endpoint for a filtered or
// sorted subset: that design is what produced a request per keystroke.
type BriefResponse struct {
	Repo        string      `json:"repo"`
	Viewer      string      `json:"viewer"`
	GeneratedAt time.Time   `json:"generated_at"`
	Items       []rank.Item `json:"items"`
	Counts      BriefCounts `json:"counts"`
}

// BriefCounts summarizes the brief for the header line.
//
// Total only. A count of how much is blocking somebody reads as urgency, and
// the lane that would be counted is already the first thing on the page.
type BriefCounts struct {
	Total int `json:"total"`
}

// briefCache holds the last generated brief per repo and viewer.
type briefCache struct {
	mu      sync.Mutex
	entries map[string]*briefCacheEntry
}

type briefCacheEntry struct {
	response  *BriefResponse
	etag      string
	expiresAt time.Time
}

func newBriefCache() *briefCache {
	return &briefCache{entries: make(map[string]*briefCacheEntry)}
}

func (c *briefCache) get(key string, now time.Time) (*briefCacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok || now.After(entry.expiresAt) {
		return nil, false
	}
	return entry, true
}

func (c *briefCache) put(key string, entry *briefCacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = entry
}

// HandleGetBrief handles GET /api/brief.
//
// Pass ?refresh=1 to bypass the cache. This is the only request the client
// makes after the initial page load.
func (h *APIHandler) HandleGetBrief(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := time.Now().UTC()

	status, err := h.authMgr.GetStatus(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if status == nil || !status.Authenticated || status.Username == "" {
		writeError(w, http.StatusUnauthorized, "Not authenticated with GitHub")
		return
	}

	repo := r.URL.Query().Get("repo")
	if repo == "" {
		repo = h.defaultRepo()
	}
	if repo == "" {
		writeError(w, http.StatusBadRequest, "No repository configured")
		return
	}

	cacheKey := repo + "|" + status.Username
	forceRefresh := r.URL.Query().Get("refresh") == "1"

	if !forceRefresh {
		if entry, ok := h.briefCache.get(cacheKey, now); ok {
			writeBrief(w, r, entry)
			return
		}
	}

	entry, err := h.generateBrief(ctx, repo, status.Username, now)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	h.briefCache.put(cacheKey, entry)
	writeBrief(w, r, entry)
}

// generateBrief fetches from GitHub and ranks the result.
func (h *APIHandler) generateBrief(
	ctx context.Context,
	repo, viewer string,
	now time.Time,
) (*briefCacheEntry, error) {
	token, _, err := h.authMgr.GetToken(ctx)
	if err != nil {
		return nil, err
	}

	if h.fetchBriefInputs == nil {
		return nil, errNoGitHubClient
	}

	// Locally checked out branches make an item cheaper to resume, which the
	// ranking engine rewards.
	worktrees := h.wtScanner.ScanWorktrees()

	inputs, err := h.fetchBriefInputs(ctx, token, viewer, repo, worktrees)
	if err != nil {
		return nil, err
	}

	items := rank.Rank(inputs, viewer, now)
	if items == nil {
		items = []rank.Item{}
	}

	response := &BriefResponse{
		Repo:        repo,
		Viewer:      viewer,
		GeneratedAt: now,
		Items:       items,
		Counts:      BriefCounts{Total: len(items)},
	}

	return &briefCacheEntry{
		response:  response,
		etag:      etagForItems(items),
		expiresAt: now.Add(briefCacheTTL),
	}, nil
}

// defaultRepo returns the first tracked repository.
func (h *APIHandler) defaultRepo() string {
	settings, err := h.db.GetSettings()
	if err != nil || settings == nil || len(settings.TrackedRepos) == 0 {
		return ""
	}
	return settings.TrackedRepos[0]
}

// writeBrief emits the response, honoring conditional requests.
func writeBrief(w http.ResponseWriter, r *http.Request, entry *briefCacheEntry) {
	w.Header().Set("ETag", entry.etag)
	w.Header().Set("Cache-Control", "no-cache")

	// An unchanged brief costs an empty body rather than a full payload.
	if match := r.Header.Get("If-None-Match"); match != "" && match == entry.etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	writeJSON(w, http.StatusOK, entry.response)
}

// etagForItems hashes the ranked items.
//
// GeneratedAt is deliberately excluded: a brief whose content has not changed
// should keep its tag even though the clock moved, otherwise every refresh
// would transfer an identical payload.
func etagForItems(items []rank.Item) string {
	encoded, err := json.Marshal(items)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(encoded)
	return `"` + hex.EncodeToString(sum[:16]) + `"`
}
