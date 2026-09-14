package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/rank"
)

// briefQuery fetches every work item the daily brief can contain in a single
// round trip. Each search is aliased rather than issued separately, so adding
// a lane costs no extra network calls.
//
// Two of these searches did not exist in the older notification sync and are
// load-bearing for the "unblock others" lane:
//
//	reviewedBy - PRs you have already reviewed. When you request changes,
//	             GitHub does not re-request your review after the author
//	             responds, so these fall off every other dashboard.
//	mentioned  - issues and PRs where somebody asked you a direct question.
//
// Comments and reviews are fetched with their timestamps rather than as a
// single latest author, because who spoke last is only answerable by merging
// the two lists. A batch of twenty covers the bot chatter that would
// otherwise crowd out the last human comment.
const briefQuery = `
fragment prFields on PullRequest {
  __typename
  number
  title
  url
  state
  isDraft
  headRefName
  createdAt
  updatedAt
  reviewDecision
  mergeable
  mergeStateStatus
  author { login }
  labels(first: 10) { nodes { name } }
  latestReviews(first: 20) { nodes { state author { login } } }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } } } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  comments(last: 20) { nodes { createdAt author { login } } }
  reviews(last: 20) { nodes { submittedAt author { login } } }
}

fragment issueFields on Issue {
  __typename
  number
  title
  url
  state
  createdAt
  updatedAt
  author { login }
  labels(first: 10) { nodes { name } }
  comments(last: 20) { nodes { createdAt author { login } } }
  projectItems(first: 1) { nodes { status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } }
  timelineItems(first: 5, itemTypes: [CROSS_REFERENCED_EVENT]) {
    nodes {
      ... on CrossReferencedEvent {
        source {
          ... on PullRequest { number state }
        }
      }
    }
  }
}

query Brief(
  $authored: String!
  $reviewRequested: String!
  $reviewedBy: String!
  $mentioned: String!
  $assigned: String!
  $unassigned: String!
) {
  authored: search(query: $authored, type: ISSUE, first: 30) {
    nodes { ...prFields }
  }
  reviewRequested: search(query: $reviewRequested, type: ISSUE, first: 30) {
    nodes { ...prFields }
  }
  reviewedBy: search(query: $reviewedBy, type: ISSUE, first: 30) {
    nodes { ...prFields }
  }
  mentioned: search(query: $mentioned, type: ISSUE, first: 20) {
    nodes { ...prFields ...issueFields }
  }
  assigned: search(query: $assigned, type: ISSUE, first: 30) {
    nodes { ...prFields ...issueFields }
  }
  unassigned: search(query: $unassigned, type: ISSUE, first: 20) {
    nodes { ...issueFields }
  }
}
`

// briefNode decodes either a PullRequest or an Issue. Fields absent for a
// given type simply stay zero, and TypeName disambiguates.
type briefNode struct {
	TypeName    string `json:"__typename"`
	Number      int    `json:"number"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	State       string `json:"state"`
	IsDraft     bool   `json:"isDraft"`
	HeadRefName string `json:"headRefName"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`

	ReviewDecision   string `json:"reviewDecision"`
	Mergeable        string `json:"mergeable"`
	MergeStateStatus string `json:"mergeStateStatus"`

	Author struct {
		Login string `json:"login"`
	} `json:"author"`

	Labels struct {
		Nodes []struct {
			Name string `json:"name"`
		} `json:"nodes"`
	} `json:"labels"`

	LatestReviews struct {
		Nodes []struct {
			State  string `json:"state"`
			Author struct {
				Login string `json:"login"`
			} `json:"author"`
		} `json:"nodes"`
	} `json:"latestReviews"`

	ReviewRequests struct {
		Nodes []struct {
			RequestedReviewer struct {
				Login string `json:"login"`
			} `json:"requestedReviewer"`
		} `json:"nodes"`
	} `json:"reviewRequests"`

	Commits struct {
		Nodes []struct {
			Commit struct {
				StatusCheckRollup struct {
					State string `json:"state"`
				} `json:"statusCheckRollup"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"commits"`

	Comments struct {
		Nodes []struct {
			CreatedAt string `json:"createdAt"`
			Author    struct {
				Login string `json:"login"`
			} `json:"author"`
		} `json:"nodes"`
	} `json:"comments"`

	Reviews struct {
		Nodes []struct {
			SubmittedAt string `json:"submittedAt"`
			Author      struct {
				Login string `json:"login"`
			} `json:"author"`
		} `json:"nodes"`
	} `json:"reviews"`

	ProjectItems struct {
		Nodes []struct {
			Status struct {
				Name string `json:"name"`
			} `json:"status"`
		} `json:"nodes"`
	} `json:"projectItems"`

	TimelineItems struct {
		Nodes []struct {
			Source struct {
				Number int    `json:"number"`
				State  string `json:"state"`
			} `json:"source"`
		} `json:"nodes"`
	} `json:"timelineItems"`
}

type briefResponse struct {
	Data struct {
		Authored        struct{ Nodes []briefNode } `json:"authored"`
		ReviewRequested struct{ Nodes []briefNode } `json:"reviewRequested"`
		ReviewedBy      struct{ Nodes []briefNode } `json:"reviewedBy"`
		Mentioned       struct{ Nodes []briefNode } `json:"mentioned"`
		Assigned        struct{ Nodes []briefNode } `json:"assigned"`
		Unassigned      struct{ Nodes []briefNode } `json:"unassigned"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// FetchBriefInputs retrieves every candidate work item for the brief in one
// GraphQL request and maps it into the ranking engine's input type.
//
// It performs no database writes. The brief is regenerated on demand, so
// there is nothing to persist and nothing to invalidate.
func (c *Client) FetchBriefInputs(
	ctx context.Context,
	token, username, repo string,
	worktrees map[string]string,
) ([]rank.Input, error) {
	if username == "" || repo == "" {
		return nil, fmt.Errorf("username and repo are both required")
	}

	variables := map[string]interface{}{
		"authored":        fmt.Sprintf("repo:%s is:pr is:open author:%s", repo, username),
		"reviewRequested": fmt.Sprintf("repo:%s is:pr is:open review-requested:%s", repo, username),
		"reviewedBy":      fmt.Sprintf("repo:%s is:pr is:open reviewed-by:%s", repo, username),
		"mentioned":       fmt.Sprintf("repo:%s is:open mentions:%s", repo, username),
		"assigned":        fmt.Sprintf("repo:%s is:open assignee:%s", repo, username),
		"unassigned":      fmt.Sprintf("repo:%s is:issue is:open no:assignee sort:created-desc", repo),
	}

	resp, err := c.postBriefQuery(ctx, token, variables)
	if err != nil {
		return nil, err
	}

	var inputs []rank.Input

	collect := func(nodes []briefNode, source rank.Source) {
		for _, n := range nodes {
			if in, ok := toRankInput(n, repo, source, worktrees); ok {
				inputs = append(inputs, in)
			}
		}
	}

	// Order matters only for readability. Deduplication in the ranking engine
	// keeps the most specific source regardless of arrival order.
	collect(resp.Data.Authored.Nodes, rank.SourceAuthored)
	collect(resp.Data.ReviewRequested.Nodes, rank.SourceReviewRequested)
	collect(resp.Data.ReviewedBy.Nodes, rank.SourceReviewedBy)
	collect(resp.Data.Mentioned.Nodes, rank.SourceMentioned)
	collect(resp.Data.Assigned.Nodes, rank.SourceAssigned)
	collect(resp.Data.Unassigned.Nodes, rank.SourceUnassigned)

	return inputs, nil
}

// projectStatusField is stripped when the token cannot read project boards.
// It must match the line in briefQuery byte for byte.
const projectStatusField = `  projectItems(first: 1) { nodes { status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } }
`

// postBriefQuery executes the query, retrying once without the fields the
// token is not allowed to select.
//
// mergeStateStatus requires push access and the board status requires
// read:project. Rather than fail the entire brief for a repo you only read,
// degrade and lose one column instead of all of them.
func (c *Client) postBriefQuery(
	ctx context.Context,
	token string,
	variables map[string]interface{},
) (*briefResponse, error) {
	resp, err := c.doBriefRequest(ctx, token, briefQuery, variables)
	if err == nil {
		return resp, nil
	}

	degraded, changed := degradeQuery(briefQuery, err)
	if !changed {
		return nil, err
	}

	return c.doBriefRequest(ctx, token, degraded, variables)
}

// degradeQuery removes optional fields the error blames, reporting whether
// anything was actually removed.
func degradeQuery(query string, err error) (string, bool) {
	if err == nil {
		return query, false
	}
	message := strings.ToLower(err.Error())
	out := query

	if strings.Contains(message, "mergestatestatus") {
		out = strings.ReplaceAll(out, "  mergeStateStatus\n", "")
	}
	if strings.Contains(message, "read:project") || strings.Contains(message, "projectitems") {
		out = strings.ReplaceAll(out, projectStatusField, "")
	}

	return out, out != query
}

// graphQLRequest is the POST body GitHub's GraphQL endpoint expects.
type graphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

func (c *Client) doBriefRequest(
	ctx context.Context,
	token, query string,
	variables map[string]interface{},
) (*briefResponse, error) {
	body, err := json.Marshal(graphQLRequest{Query: query, Variables: variables})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.graphqlURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")
	// mergeStateStatus historically sat behind this preview media type.
	req.Header.Set("Accept", "application/vnd.github.merge-info-preview+json")

	httpResp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("brief request failed: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(httpResp.Body)
		return nil, fmt.Errorf("brief query returned %d: %s", httpResp.StatusCode, string(b))
	}

	var parsed briefResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("failed to decode brief response: %w", err)
	}

	if len(parsed.Errors) > 0 {
		msgs := make([]string, 0, len(parsed.Errors))
		for _, e := range parsed.Errors {
			msgs = append(msgs, e.Message)
		}
		return nil, fmt.Errorf("brief query error: %s", strings.Join(msgs, "; "))
	}

	return &parsed, nil
}

// toRankInput converts one GraphQL node into a ranking input.
func toRankInput(
	n briefNode,
	repo string,
	source rank.Source,
	worktrees map[string]string,
) (rank.Input, bool) {
	if n.Number == 0 {
		return rank.Input{}, false
	}

	itemType := rank.TypeIssue
	if n.TypeName == "PullRequest" {
		itemType = rank.TypePullRequest
	}

	in := rank.Input{
		Type:           itemType,
		Number:         n.Number,
		Title:          n.Title,
		URL:            n.URL,
		Repo:           repo,
		Branch:         n.HeadRefName,
		Author:         n.Author.Login,
		Source:         source,
		State:          strings.ToLower(n.State),
		IsDraft:        n.IsDraft,
		ReviewDecision: strings.ToUpper(n.ReviewDecision),
		Mergeable:      normalizeMergeState(n.Mergeable, n.MergeStateStatus),
		CI:             normalizeCI(n),
		CreatedAt:      parseTime(n.CreatedAt),
		UpdatedAt:      parseTime(n.UpdatedAt),
	}

	if n.IsDraft {
		in.State = "draft"
	}

	for _, l := range n.Labels.Nodes {
		if l.Name != "" {
			in.Labels = append(in.Labels, l.Name)
		}
	}

	for _, rev := range n.LatestReviews.Nodes {
		login := rev.Author.Login
		if login == "" {
			continue
		}
		switch strings.ToUpper(rev.State) {
		case "APPROVED":
			in.Approvers = append(in.Approvers, login)
		case "CHANGES_REQUESTED":
			in.ChangesRequestedBy = append(in.ChangesRequestedBy, login)
		}
	}

	for _, r := range n.ReviewRequests.Nodes {
		if r.RequestedReviewer.Login != "" {
			in.PendingReviewers = append(in.PendingReviewers, r.RequestedReviewer.Login)
		}
	}

	// Comments and reviews are one conversation. The ranking engine decides
	// who the ball is with; this only has to hand it every utterance.
	for _, c := range n.Comments.Nodes {
		if c.Author.Login == "" {
			continue
		}
		in.Events = append(in.Events, rank.Event{
			Actor: c.Author.Login,
			At:    parseTime(c.CreatedAt),
		})
	}
	for _, rv := range n.Reviews.Nodes {
		if rv.Author.Login == "" {
			continue
		}
		in.Events = append(in.Events, rank.Event{
			Actor: rv.Author.Login,
			At:    parseTime(rv.SubmittedAt),
		})
	}

	if len(n.ProjectItems.Nodes) > 0 {
		in.ProjectStatus = n.ProjectItems.Nodes[0].Status.Name
	}

	// An issue counts as in flight when an open PR references it.
	for _, t := range n.TimelineItems.Nodes {
		if t.Source.Number != 0 && strings.EqualFold(t.Source.State, "OPEN") {
			in.HasLinkedPR = true
			break
		}
	}

	if n.HeadRefName != "" && worktrees != nil {
		in.LocalWorktreePath = worktrees[n.HeadRefName]
	}

	return in, true
}

// normalizeMergeState collapses GitHub's two separate merge fields into the
// single value the ranking engine reasons about.
func normalizeMergeState(mergeable, mergeState string) string {
	// A known conflict is decisive regardless of the state status.
	if strings.EqualFold(mergeable, "CONFLICTING") {
		return rank.MergeConflicting
	}

	switch strings.ToUpper(mergeState) {
	case "BEHIND":
		return rank.MergeBehind
	case "DIRTY":
		return rank.MergeConflicting
	case "BLOCKED":
		return rank.MergeBlocked
	case "CLEAN", "HAS_HOOKS", "UNSTABLE":
		return rank.MergeClean
	}

	if strings.EqualFold(mergeable, "MERGEABLE") {
		return rank.MergeClean
	}

	return rank.MergeUnknown
}

// normalizeCI reduces the status check rollup to a simple verdict.
func normalizeCI(n briefNode) string {
	if len(n.Commits.Nodes) == 0 {
		return ""
	}
	switch strings.ToUpper(n.Commits.Nodes[0].Commit.StatusCheckRollup.State) {
	case "SUCCESS":
		return rank.CISuccess
	case "FAILURE", "ERROR":
		return rank.CIFailure
	case "PENDING", "EXPECTED":
		return rank.CIPending
	}
	return ""
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}
