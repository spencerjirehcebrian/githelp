package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/rank"
)

// briefHarness wires a handler with stubbed auth and a counting fetch seam.
type briefHarness struct {
	handler *APIHandler
	mux     http.Handler
	calls   *int32
}

// newBriefHarness builds an authenticated handler whose GitHub fetch is
// replaced by the supplied function.
func newBriefHarness(t *testing.T, fetch briefFetchFunc) *briefHarness {
	t.Helper()

	database, err := db.Open(filepath.Join(t.TempDir(), "brief_test.db"))
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	// Stub the GitHub user endpoint so auth resolves to a known viewer.
	ghStub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"login":"me","name":"Me"}`))
	}))
	t.Cleanup(ghStub.Close)

	settings, err := database.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings: %v", err)
	}
	settings.AuthMode = "pat"
	settings.PATToken = "test-token"
	settings.TrackedRepos = []string{"o/r"}
	if err := database.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	authMgr := auth.NewManager(database)
	authMgr.SetBaseURL(ghStub.URL)
	authMgr.SetHTTPClient(ghStub.Client())

	var calls int32
	handler := NewAPIHandler(database, authMgr, nil)
	handler.fetchBriefInputs = func(
		ctx context.Context,
		token, viewer, repo string,
		worktrees map[string]string,
	) ([]rank.Input, error) {
		atomic.AddInt32(&calls, 1)
		return fetch(ctx, token, viewer, repo, worktrees)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/brief", handler.HandleGetBrief)

	return &briefHarness{handler: handler, mux: mux, calls: &calls}
}

func (h *briefHarness) get(t *testing.T, target string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	h.mux.ServeHTTP(rr, req)
	return rr
}

// briefBase is evaluated once so repeated fixture calls produce byte-identical
// timestamps. In production these values come from GitHub and are equally
// stable; only the fixture needed pinning.
var briefBase = time.Now().UTC().Truncate(24 * time.Hour)

// sampleInputs returns a small, stable set covering three lanes.
func sampleInputs(_ context.Context, _, _, _ string, _ map[string]string) ([]rank.Input, error) {
	return []rank.Input{
		{
			Type: rank.TypePullRequest, Number: 3152, Title: "needs your review",
			Repo: "o/r", Author: "charlesong-dev", Source: rank.SourceReviewRequested,
			State: "open", Mergeable: rank.MergeClean,
			UpdatedAt: briefBase.AddDate(0, 0, -2), CreatedAt: briefBase.AddDate(0, 0, -9),
		},
		{
			Type: rank.TypePullRequest, Number: 3130, Title: "approved but behind",
			Repo: "o/r", Author: "me", Source: rank.SourceAuthored,
			State: "open", ReviewDecision: rank.DecisionApproved,
			Approvers: []string{"antoniorafaelu-dev"}, Mergeable: rank.MergeBehind,
			UpdatedAt: briefBase.AddDate(0, 0, -1), CreatedAt: briefBase.AddDate(0, 0, -14),
		},
		{
			Type: rank.TypeIssue, Number: 3331, Title: "claimable bug",
			Repo: "o/r", Source: rank.SourceUnassigned, State: "open",
			UpdatedAt: briefBase.AddDate(0, 0, -1), CreatedAt: briefBase.AddDate(0, 0, -1),
		},
	}, nil
}

func decodeBrief(t *testing.T, rr *httptest.ResponseRecorder) BriefResponse {
	t.Helper()
	var out BriefResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode brief: %v (body: %s)", err, rr.Body.String())
	}
	return out
}

func TestBriefReturnsRankedItems(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	rr := h.get(t, "/api/brief", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rr.Code, rr.Body.String())
	}

	brief := decodeBrief(t, rr)

	if brief.Repo != "o/r" {
		t.Errorf("repo = %q", brief.Repo)
	}
	if brief.Viewer != "me" {
		t.Errorf("viewer = %q", brief.Viewer)
	}
	if brief.Counts.Total != 3 {
		t.Errorf("total = %d, want 3", brief.Counts.Total)
	}
	if brief.Counts.Blocking != 1 {
		t.Errorf("blocking = %d, want 1", brief.Counts.Blocking)
	}
	if len(brief.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(brief.Items))
	}

	// The blocker must lead, and every item must be actionable.
	if brief.Items[0].Number != 3152 {
		t.Errorf("first item = #%d, want #3152", brief.Items[0].Number)
	}
	for _, it := range brief.Items {
		if it.Signal == "" || it.Action == "" {
			t.Errorf("#%d shipped without signal or action", it.Number)
		}
	}
}

func TestBriefServesFromCache(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	for i := 0; i < 5; i++ {
		if rr := h.get(t, "/api/brief", nil); rr.Code != http.StatusOK {
			t.Fatalf("request %d: status %d", i, rr.Code)
		}
	}

	// Five browser requests, one GitHub request.
	if got := atomic.LoadInt32(h.calls); got != 1 {
		t.Errorf("GitHub was called %d times, want 1", got)
	}
}

func TestBriefRefreshBypassesCache(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	h.get(t, "/api/brief", nil)
	h.get(t, "/api/brief?refresh=1", nil)

	if got := atomic.LoadInt32(h.calls); got != 2 {
		t.Errorf("GitHub was called %d times, want 2", got)
	}
}

func TestBriefCacheExpires(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	h.get(t, "/api/brief", nil)

	// Age the cached entry past its TTL.
	h.handler.briefCache.mu.Lock()
	for _, entry := range h.handler.briefCache.entries {
		entry.expiresAt = time.Now().UTC().Add(-time.Second)
	}
	h.handler.briefCache.mu.Unlock()

	h.get(t, "/api/brief", nil)

	if got := atomic.LoadInt32(h.calls); got != 2 {
		t.Errorf("GitHub was called %d times, want 2 after expiry", got)
	}
}

func TestBriefETagReturnsNotModified(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	first := h.get(t, "/api/brief", nil)
	etag := first.Header().Get("ETag")
	if etag == "" {
		t.Fatal("response carried no ETag")
	}

	second := h.get(t, "/api/brief", map[string]string{"If-None-Match": etag})
	if second.Code != http.StatusNotModified {
		t.Errorf("status = %d, want 304", second.Code)
	}
	if second.Body.Len() != 0 {
		t.Errorf("304 should have an empty body, got %d bytes", second.Body.Len())
	}
}

func TestBriefETagIsStableAcrossRegeneration(t *testing.T) {
	// A brief whose content has not changed must keep its tag even though the
	// clock moved, otherwise every refresh re-sends an identical payload.
	h := newBriefHarness(t, sampleInputs)

	first := h.get(t, "/api/brief", nil)
	second := h.get(t, "/api/brief?refresh=1", nil)

	if first.Header().Get("ETag") != second.Header().Get("ETag") {
		t.Errorf("ETag changed across regeneration: %q then %q",
			first.Header().Get("ETag"), second.Header().Get("ETag"))
	}
}

func TestBriefETagChangesWhenContentChanges(t *testing.T) {
	var second bool
	h := newBriefHarness(t, func(
		ctx context.Context, token, viewer, repo string, wt map[string]string,
	) ([]rank.Input, error) {
		items, _ := sampleInputs(ctx, token, viewer, repo, wt)
		if second {
			items = items[:1]
		}
		return items, nil
	})

	first := h.get(t, "/api/brief", nil)
	second = true
	changed := h.get(t, "/api/brief?refresh=1", nil)

	if first.Header().Get("ETag") == changed.Header().Get("ETag") {
		t.Error("ETag should change when the ranked items change")
	}
}

func TestBriefRequiresAuthentication(t *testing.T) {
	database, err := db.Open(filepath.Join(t.TempDir(), "unauth.db"))
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	defer database.Close()

	// A GitHub stub that rejects the token leaves the viewer unauthenticated.
	ghStub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer ghStub.Close()

	settings, _ := database.GetSettings()
	settings.AuthMode = "pat"
	settings.PATToken = "bad-token"
	_ = database.SaveSettings(settings)

	authMgr := auth.NewManager(database)
	authMgr.SetBaseURL(ghStub.URL)
	authMgr.SetHTTPClient(ghStub.Client())

	handler := NewAPIHandler(database, authMgr, nil)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/brief", handler.HandleGetBrief)

	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/brief", nil))

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestBriefSurfacesFetchFailure(t *testing.T) {
	h := newBriefHarness(t, func(
		context.Context, string, string, string, map[string]string,
	) ([]rank.Input, error) {
		return nil, errNoGitHubClient
	})

	rr := h.get(t, "/api/brief", nil)
	if rr.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", rr.Code)
	}
}

func TestBriefEmptyResultIsAnArrayNotNull(t *testing.T) {
	// A null items field would force the client to guard every render.
	h := newBriefHarness(t, func(
		context.Context, string, string, string, map[string]string,
	) ([]rank.Input, error) {
		return nil, nil
	})

	rr := h.get(t, "/api/brief", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if string(raw["items"]) != "[]" {
		t.Errorf("items = %s, want []", raw["items"])
	}
}

func TestBriefRespectsRepoParameter(t *testing.T) {
	var sawRepo string
	h := newBriefHarness(t, func(
		_ context.Context, _, _, repo string, _ map[string]string,
	) ([]rank.Input, error) {
		sawRepo = repo
		return nil, nil
	})

	h.get(t, "/api/brief?repo=other/project", nil)

	if sawRepo != "other/project" {
		t.Errorf("fetched repo = %q, want other/project", sawRepo)
	}
}

func TestBriefCachesPerRepo(t *testing.T) {
	h := newBriefHarness(t, sampleInputs)

	h.get(t, "/api/brief?repo=a/one", nil)
	h.get(t, "/api/brief?repo=b/two", nil)
	h.get(t, "/api/brief?repo=a/one", nil)

	// Two distinct repos, two fetches. The third is a cache hit.
	if got := atomic.LoadInt32(h.calls); got != 2 {
		t.Errorf("GitHub was called %d times, want 2", got)
	}
}
