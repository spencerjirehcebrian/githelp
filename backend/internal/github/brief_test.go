package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/rank"
)

func TestNormalizeMergeState(t *testing.T) {
	tests := []struct {
		name       string
		mergeable  string
		mergeState string
		want       string
	}{
		{"conflicting wins outright", "CONFLICTING", "BEHIND", rank.MergeConflicting},
		{"behind main", "MERGEABLE", "BEHIND", rank.MergeBehind},
		{"clean", "MERGEABLE", "CLEAN", rank.MergeClean},
		{"unstable checks still mergeable", "MERGEABLE", "UNSTABLE", rank.MergeClean},
		{"hooks pending still mergeable", "MERGEABLE", "HAS_HOOKS", rank.MergeClean},
		{"blocked by branch protection", "MERGEABLE", "BLOCKED", rank.MergeBlocked},
		{"dirty maps to conflicting", "UNKNOWN", "DIRTY", rank.MergeConflicting},
		{"degraded without merge state", "MERGEABLE", "", rank.MergeClean},
		{"degraded and conflicting", "CONFLICTING", "", rank.MergeConflicting},
		{"nothing known", "UNKNOWN", "", rank.MergeUnknown},
		{"empty", "", "", rank.MergeUnknown},
		{"lowercase input", "mergeable", "behind", rank.MergeBehind},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeMergeState(tc.mergeable, tc.mergeState); got != tc.want {
				t.Errorf("normalizeMergeState(%q, %q) = %q, want %q",
					tc.mergeable, tc.mergeState, got, tc.want)
			}
		})
	}
}

func TestNormalizeCI(t *testing.T) {
	withRollup := func(state string) briefNode {
		var n briefNode
		n.Commits.Nodes = []struct {
			Commit struct {
				StatusCheckRollup struct {
					State string `json:"state"`
				} `json:"statusCheckRollup"`
			} `json:"commit"`
		}{{}}
		n.Commits.Nodes[0].Commit.StatusCheckRollup.State = state
		return n
	}

	cases := map[string]string{
		"SUCCESS":  rank.CISuccess,
		"FAILURE":  rank.CIFailure,
		"ERROR":    rank.CIFailure,
		"PENDING":  rank.CIPending,
		"EXPECTED": rank.CIPending,
		"WEIRD":    "",
	}

	for state, want := range cases {
		if got := normalizeCI(withRollup(state)); got != want {
			t.Errorf("rollup %q gave %q, want %q", state, got, want)
		}
	}

	if got := normalizeCI(briefNode{}); got != "" {
		t.Errorf("no commits should give empty CI, got %q", got)
	}
}

func TestToRankInputPullRequest(t *testing.T) {
	raw := `{
      "__typename": "PullRequest",
      "number": 3130,
      "title": "replace itemset continue run logic",
      "url": "https://github.com/o/r/pull/3130",
      "state": "OPEN",
      "isDraft": false,
      "headRefName": "feature-branch",
      "createdAt": "2026-08-28T10:00:00Z",
      "updatedAt": "2026-09-09T10:00:00Z",
      "reviewDecision": "APPROVED",
      "mergeable": "MERGEABLE",
      "mergeStateStatus": "BEHIND",
      "author": { "login": "me" },
      "labels": { "nodes": [{ "name": "backend" }] },
      "latestReviews": { "nodes": [
        { "state": "APPROVED", "author": { "login": "antoniorafaelu-dev" } },
        { "state": "CHANGES_REQUESTED", "author": { "login": "kgreatwood-abc" } },
        { "state": "COMMENTED", "author": { "login": "ignored" } }
      ]},
      "reviewRequests": { "nodes": [
        { "requestedReviewer": { "login": "pending-person" } }
      ]},
      "commits": { "nodes": [
        { "commit": { "statusCheckRollup": { "state": "SUCCESS" } } }
      ]},
      "comments": { "nodes": [ { "author": { "login": "charlesong-dev" } } ] }
    }`

	var node briefNode
	if err := json.Unmarshal([]byte(raw), &node); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	worktrees := map[string]string{"feature-branch": "/Users/me/git/repo"}
	in, ok := toRankInput(node, "o/r", rank.SourceAuthored, worktrees)
	if !ok {
		t.Fatal("expected node to convert")
	}

	if in.Type != rank.TypePullRequest {
		t.Errorf("type = %q", in.Type)
	}
	if in.Number != 3130 {
		t.Errorf("number = %d", in.Number)
	}
	if in.State != "open" {
		t.Errorf("state = %q, want lowercased", in.State)
	}
	if in.Mergeable != rank.MergeBehind {
		t.Errorf("mergeable = %q, want %q", in.Mergeable, rank.MergeBehind)
	}
	if in.CI != rank.CISuccess {
		t.Errorf("ci = %q", in.CI)
	}
	if len(in.Approvers) != 1 || in.Approvers[0] != "antoniorafaelu-dev" {
		t.Errorf("approvers = %v", in.Approvers)
	}
	if len(in.ChangesRequestedBy) != 1 || in.ChangesRequestedBy[0] != "kgreatwood-abc" {
		t.Errorf("changesRequestedBy = %v", in.ChangesRequestedBy)
	}
	if len(in.PendingReviewers) != 1 || in.PendingReviewers[0] != "pending-person" {
		t.Errorf("pendingReviewers = %v", in.PendingReviewers)
	}
	if in.LatestCommentAuthor != "charlesong-dev" {
		t.Errorf("latestCommentAuthor = %q", in.LatestCommentAuthor)
	}
	if in.LocalWorktreePath != "/Users/me/git/repo" {
		t.Errorf("worktree = %q", in.LocalWorktreePath)
	}
	if len(in.Labels) != 1 || in.Labels[0] != "backend" {
		t.Errorf("labels = %v", in.Labels)
	}
	if !in.UpdatedAt.Equal(time.Date(2026, 9, 9, 10, 0, 0, 0, time.UTC)) {
		t.Errorf("updatedAt = %v", in.UpdatedAt)
	}
}

func TestToRankInputDraftOverridesState(t *testing.T) {
	node := briefNode{TypeName: "PullRequest", Number: 1, State: "OPEN", IsDraft: true}
	in, _ := toRankInput(node, "o/r", rank.SourceAuthored, nil)
	if in.State != "draft" {
		t.Errorf("state = %q, want draft", in.State)
	}
}

func TestToRankInputIssueWithLinkedPR(t *testing.T) {
	raw := `{
      "__typename": "Issue",
      "number": 3086,
      "title": "warning dialog needed",
      "state": "OPEN",
      "createdAt": "2026-09-01T10:00:00Z",
      "updatedAt": "2026-09-09T10:00:00Z",
      "timelineItems": { "nodes": [
        { "source": { "number": 3130, "state": "OPEN" } }
      ]}
    }`

	var node briefNode
	if err := json.Unmarshal([]byte(raw), &node); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	in, _ := toRankInput(node, "o/r", rank.SourceAssigned, nil)
	if in.Type != rank.TypeIssue {
		t.Errorf("type = %q", in.Type)
	}
	if !in.HasLinkedPR {
		t.Error("expected HasLinkedPR from the open cross reference")
	}
}

func TestToRankInputIgnoresClosedCrossReference(t *testing.T) {
	// A closed PR referencing the issue does not mean work is in flight.
	raw := `{
      "__typename": "Issue",
      "number": 3086,
      "state": "OPEN",
      "timelineItems": { "nodes": [ { "source": { "number": 9, "state": "CLOSED" } } ] }
    }`

	var node briefNode
	_ = json.Unmarshal([]byte(raw), &node)

	in, _ := toRankInput(node, "o/r", rank.SourceAssigned, nil)
	if in.HasLinkedPR {
		t.Error("a closed PR reference should not count as work in flight")
	}
}

func TestToRankInputSkipsEmptyNodes(t *testing.T) {
	// Search unions yield empty objects for types we did not select.
	if _, ok := toRankInput(briefNode{}, "o/r", rank.SourceAuthored, nil); ok {
		t.Error("expected an empty node to be skipped")
	}
}

// newBriefServer returns a stub GitHub GraphQL endpoint serving the supplied
// response body, along with the captured request body for assertions.
func newBriefServer(t *testing.T, body string) (*Client, *string) {
	t.Helper()

	captured := new(string)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		*captured = string(buf)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	return &Client{httpClient: srv.Client(), graphqlURL: srv.URL}, captured
}

func TestFetchBriefInputsIssuesAllSixSearches(t *testing.T) {
	client, captured := newBriefServer(t, `{"data":{}}`)

	_, err := client.FetchBriefInputs(context.Background(), "tok", "me", "o/r", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Every lane's data must arrive in a single round trip.
	for _, want := range []string{
		"is:pr is:open author:me",
		"is:pr is:open review-requested:me",
		"is:pr is:open reviewed-by:me",
		"is:open mentions:me",
		"is:open assignee:me",
		"is:issue is:open no:assignee",
	} {
		if !strings.Contains(*captured, want) {
			t.Errorf("request is missing search %q", want)
		}
	}
}

func TestFetchBriefInputsRequiresUserAndRepo(t *testing.T) {
	client, _ := newBriefServer(t, `{"data":{}}`)

	if _, err := client.FetchBriefInputs(context.Background(), "tok", "", "o/r", nil); err == nil {
		t.Error("expected an error when username is empty")
	}
	if _, err := client.FetchBriefInputs(context.Background(), "tok", "me", "", nil); err == nil {
		t.Error("expected an error when repo is empty")
	}
}

func TestFetchBriefInputsSurfacesGraphQLErrors(t *testing.T) {
	client, _ := newBriefServer(t, `{"errors":[{"message":"Bad credentials"}]}`)

	_, err := client.FetchBriefInputs(context.Background(), "tok", "me", "o/r", nil)
	if err == nil || !strings.Contains(err.Error(), "Bad credentials") {
		t.Errorf("expected the GitHub error to surface, got %v", err)
	}
}

func TestFetchBriefInputsDegradesWithoutMergeStateStatus(t *testing.T) {
	// Repos where you lack push access reject mergeStateStatus. Losing the
	// BEHIND distinction is acceptable; losing the whole brief is not.
	var attempts int
	var sawFieldOnRetry bool

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		attempts++

		if attempts == 1 {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(
				`{"errors":[{"message":"Field 'mergeStateStatus' requires push access"}]}`))
			return
		}

		sawFieldOnRetry = strings.Contains(string(buf), "mergeStateStatus")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"authored":{"nodes":[
          {"__typename":"PullRequest","number":7,"state":"OPEN","mergeable":"MERGEABLE",
           "author":{"login":"me"},"updatedAt":"2026-09-13T10:00:00Z"}
        ]}}}`))
	}))
	defer srv.Close()

	client := &Client{httpClient: srv.Client(), graphqlURL: srv.URL}

	inputs, err := client.FetchBriefInputs(context.Background(), "tok", "me", "o/r", nil)
	if err != nil {
		t.Fatalf("expected graceful degradation, got %v", err)
	}
	if attempts != 2 {
		t.Errorf("expected exactly one retry, got %d attempts", attempts)
	}
	if sawFieldOnRetry {
		t.Error("retry should have stripped mergeStateStatus")
	}
	if len(inputs) != 1 {
		t.Fatalf("expected 1 input after degrading, got %d", len(inputs))
	}
	if inputs[0].Mergeable != rank.MergeClean {
		t.Errorf("degraded mergeable = %q, want %q", inputs[0].Mergeable, rank.MergeClean)
	}
}

// TestFetchBriefInputsEndToEnd runs a realistic payload all the way through the
// ranking engine, which is the contract the API handler depends on.
func TestFetchBriefInputsEndToEnd(t *testing.T) {
	payload := `{"data":{
      "authored": { "nodes": [
        {"__typename":"PullRequest","number":3130,
         "title":"replace itemset continue run logic",
         "state":"OPEN","headRefName":"warn-dialog","author":{"login":"me"},
         "reviewDecision":"APPROVED","mergeable":"MERGEABLE","mergeStateStatus":"BEHIND",
         "createdAt":"2026-08-28T10:00:00Z","updatedAt":"2026-09-13T10:00:00Z",
         "latestReviews":{"nodes":[
           {"state":"APPROVED","author":{"login":"antoniorafaelu-dev"}}]},
         "commits":{"nodes":[{"commit":{"statusCheckRollup":{"state":"SUCCESS"}}}]}}
      ]},
      "reviewRequested": { "nodes": [
        {"__typename":"PullRequest","number":3152,
         "title":"Update Images.AvailableProtoFields",
         "state":"OPEN","headRefName":"bq-object-ext",
         "author":{"login":"charlesong-dev"},
         "mergeable":"MERGEABLE","mergeStateStatus":"CLEAN",
         "createdAt":"2026-09-01T10:00:00Z","updatedAt":"2026-09-12T10:00:00Z"}
      ]},
      "unassigned": { "nodes": [
        {"__typename":"Issue","number":3331,"title":"Fix halved labels",
         "state":"OPEN","createdAt":"2026-09-13T10:00:00Z",
         "updatedAt":"2026-09-13T10:00:00Z"}
      ]}
    }}`

	client, _ := newBriefServer(t, payload)

	inputs, err := client.FetchBriefInputs(context.Background(), "tok", "me", "o/r", nil)
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(inputs) != 3 {
		t.Fatalf("expected 3 inputs, got %d", len(inputs))
	}

	now := time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
	items := rank.Rank(inputs, "me", now)

	if len(items) != 3 {
		t.Fatalf("expected 3 ranked items, got %d", len(items))
	}

	// The review request blocks another person, so it must lead.
	if items[0].Number != 3152 {
		t.Errorf("expected #3152 first, got #%d", items[0].Number)
	}
	if items[0].Lane != rank.LaneUnblockOthers {
		t.Errorf("#3152 lane = %q", items[0].Lane)
	}
	if items[0].Signal != "charlesong-dev requested your review 2d ago" {
		t.Errorf("#3152 signal = %q", items[0].Signal)
	}

	// The approved-but-behind PR must carry the rebase instruction.
	var found bool
	for _, it := range items {
		if it.Number != 3130 {
			continue
		}
		found = true
		if it.Lane != rank.LaneLandInFlight {
			t.Errorf("#3130 lane = %q", it.Lane)
		}
		if it.Action != "Rebase, verify CI, then merge" {
			t.Errorf("#3130 action = %q", it.Action)
		}
		if it.Checkout != "gh pr checkout 3130" {
			t.Errorf("#3130 checkout = %q", it.Checkout)
		}
	}
	if !found {
		t.Error("#3130 missing from ranked output")
	}
}
