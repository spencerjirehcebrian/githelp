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
	"github.com/spencerjireh/githelp/backend/internal/worktree"
)

// APIHandler serves the brief and the small amount of configuration around
// it. There is no stored notification state: the brief is regenerated on
// request rather than maintained, so there is nothing to keep in sync.
type APIHandler struct {
	db         *db.DB
	authMgr    *auth.Manager
	client     *github.Client
	wtScanner  *worktree.Scanner
	briefCache *briefCache

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

func NewAPIHandler(database *db.DB, authMgr *auth.Manager, client *github.Client) *APIHandler {
	h := &APIHandler{
		db:         database,
		authMgr:    authMgr,
		client:     client,
		wtScanner:  worktree.NewScanner(),
		briefCache: newBriefCache(),
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

// HandleGetStatus handles GET /api/status.
func (h *APIHandler) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.authMgr.GetStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"auth":        status,
		"server_time": time.Now().UTC().Format(time.RFC3339),
	})
}

// HandleAuthPAT handles POST /api/auth/pat.
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

	writeJSON(w, http.StatusOK, status)
}

// HandleAuthDisconnect handles POST /api/auth/disconnect.
func (h *APIHandler) HandleAuthDisconnect(w http.ResponseWriter, r *http.Request) {
	status, err := h.authMgr.Disconnect(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// HandleGetSettings handles GET /api/settings.
func (h *APIHandler) HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.db.GetSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// The token is never sent back in full. The client only needs to know
	// that one is configured.
	response := *settings
	if response.PATToken != "" {
		if len(response.PATToken) > 6 {
			response.PATToken = response.PATToken[:4] + "..." + response.PATToken[len(response.PATToken)-2:]
		} else {
			response.PATToken = "***"
		}
	}

	writeJSON(w, http.StatusOK, response)
}

// HandleUpdateSettings handles PUT /api/settings.
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

	// The client is sent a masked token, so a round trip must not overwrite
	// the real one with the mask.
	if body.PATToken == "" || strings.Contains(body.PATToken, "...") || body.PATToken == "***" {
		body.PATToken = current.PATToken
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
