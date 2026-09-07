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

	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/triage"
)

const repoStateQuery = `
query RepoState($authoredQuery: String!, $reviewRequestedQuery: String!, $assignedQuery: String!, $mergedQuery: String!, $unassignedQuery: String!) {
  authored: search(query: $authoredQuery, type: ISSUE, first: 20) {
    nodes {
      ... on PullRequest {
        id
        number
        title
        url
        state
        isDraft
        headRefName
        updatedAt
        reviewDecision
        author { login avatarUrl }
        latestReviews(first: 10) {
          nodes {
            state
            author { login }
          }
        }
        reviewRequests(first: 10) {
          nodes {
            requestedReviewer {
              ... on User { login }
            }
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
        comments(last: 1) {
          nodes {
            author { login }
            body
          }
        }
      }
    }
  }
  reviewRequested: search(query: $reviewRequestedQuery, type: ISSUE, first: 20) {
    nodes {
      ... on PullRequest {
        id
        number
        title
        url
        state
        isDraft
        headRefName
        updatedAt
        reviewDecision
        author { login avatarUrl }
        latestReviews(first: 10) {
          nodes {
            state
            author { login }
          }
        }
        reviewRequests(first: 10) {
          nodes {
            requestedReviewer {
              ... on User { login }
            }
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
  assigned: search(query: $assignedQuery, type: ISSUE, first: 20) {
    nodes {
      ... on Issue {
        id
        number
        title
        url
        state
        updatedAt
        author { login avatarUrl }
        comments(last: 1) {
          nodes {
            author { login }
            body
          }
        }
      }
      ... on PullRequest {
        id
        number
        title
        url
        state
        isDraft
        headRefName
        updatedAt
        author { login avatarUrl }
      }
    }
  }
  merged: search(query: $mergedQuery, type: ISSUE, first: 10) {
    nodes {
      ... on PullRequest {
        id
        number
        title
        url
        state
        headRefName
        updatedAt
        author { login avatarUrl }
      }
    }
  }
  unassigned: search(query: $unassignedQuery, type: ISSUE, first: 15) {
    nodes {
      ... on Issue {
        id
        number
        title
        url
        state
        createdAt
        updatedAt
        author { login avatarUrl }
        labels(first: 5) {
          nodes { name }
        }
      }
    }
  }
}
`

type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

type GraphQLResponse struct {
	Data struct {
		Authored struct {
			Nodes []GQLPullRequest `json:"nodes"`
		} `json:"authored"`
		ReviewRequested struct {
			Nodes []GQLPullRequest `json:"nodes"`
		} `json:"reviewRequested"`
		Assigned struct {
			Nodes []GQLIssueOrPR `json:"nodes"`
		} `json:"assigned"`
		Merged struct {
			Nodes []GQLPullRequest `json:"nodes"`
		} `json:"merged"`
		Unassigned struct {
			Nodes []GQLUnassignedIssue `json:"nodes"`
		} `json:"unassigned"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

type GQLPullRequest struct {
	ID             string `json:"id"`
	Number         int    `json:"number"`
	Title          string `json:"title"`
	URL            string `json:"url"`
	State          string `json:"state"`
	IsDraft        bool   `json:"isDraft"`
	HeadRefName    string `json:"headRefName"`
	UpdatedAt      string `json:"updatedAt"`
	ReviewDecision string `json:"reviewDecision"`
	Author         struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatarUrl"`
	} `json:"author"`
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
			Author struct {
				Login string `json:"login"`
			} `json:"author"`
			Body string `json:"body"`
		} `json:"nodes"`
	} `json:"comments"`
}

type GQLIssueOrPR struct {
	ID          string `json:"id"`
	Number      int    `json:"number"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	State       string `json:"state"`
	IsDraft     bool   `json:"isDraft"`
	HeadRefName string `json:"headRefName"`
	UpdatedAt   string `json:"updatedAt"`
	Author      struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatarUrl"`
	} `json:"author"`
	Comments struct {
		Nodes []struct {
			Author struct {
				Login string `json:"login"`
			} `json:"author"`
			Body string `json:"body"`
		} `json:"nodes"`
	} `json:"comments"`
}

type GQLUnassignedIssue struct {
	ID        string `json:"id"`
	Number    int    `json:"number"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	State     string `json:"state"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	Author    struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatarUrl"`
	} `json:"author"`
	Labels struct {
		Nodes []struct {
			Name string `json:"name"`
		} `json:"nodes"`
	} `json:"labels"`
}

// SyncRepositoryState queries GitHub GraphQL for repository work items and updates SQLite.
func (c *Client) SyncRepositoryState(ctx context.Context, token, username, repo string, worktrees map[string]string) (int, error) {
	if username == "" || repo == "" {
		return 0, nil
	}

	variables := map[string]interface{}{
		"authoredQuery":        fmt.Sprintf("repo:%s is:pr is:open author:%s", repo, username),
		"reviewRequestedQuery": fmt.Sprintf("repo:%s is:pr is:open review-requested:%s", repo, username),
		"assignedQuery":        fmt.Sprintf("repo:%s is:issue is:open assignee:%s", repo, username),
		"mergedQuery":          fmt.Sprintf("repo:%s is:pr is:merged author:%s sort:updated-desc", repo, username),
		"unassignedQuery":      fmt.Sprintf("repo:%s is:issue is:open no:assignee sort:created-desc", repo),
	}

	reqBody, err := json.Marshal(GraphQLRequest{
		Query:     repoStateQuery,
		Variables: variables,
	})
	if err != nil {
		return 0, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.graphqlURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("graphql request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("graphql error %d: %s", resp.StatusCode, string(b))
	}

	var gqlResp GraphQLResponse
	if err := json.NewDecoder(resp.Body).Decode(&gqlResp); err != nil {
		return 0, fmt.Errorf("failed to decode graphql response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		return 0, fmt.Errorf("graphql returned error: %s", gqlResp.Errors[0].Message)
	}

	synced := 0

	// 1. Process Authored PRs
	for _, pr := range gqlResp.Data.Authored.Nodes {
		item := convertGQLPRToNotification(repo, pr, "author", worktrees)
		if err := c.db.UpsertNotification(item); err == nil {
			existingTriage, _ := c.db.GetTriageState(item.ID)
			tState := triage.ComputeTriageState(item, username, existingTriage)
			_ = c.db.UpsertTriageState(tState)
			synced++
		}
	}

	// 2. Process Review Requested PRs
	for _, pr := range gqlResp.Data.ReviewRequested.Nodes {
		item := convertGQLPRToNotification(repo, pr, "review_requested", worktrees)
		if err := c.db.UpsertNotification(item); err == nil {
			existingTriage, _ := c.db.GetTriageState(item.ID)
			tState := triage.ComputeTriageState(item, username, existingTriage)
			_ = c.db.UpsertTriageState(tState)
			synced++
		}
	}

	// 3. Process Assigned Items
	for _, a := range gqlResp.Data.Assigned.Nodes {
		item := convertGQLAssignedToNotification(repo, a, worktrees)
		if err := c.db.UpsertNotification(item); err == nil {
			existingTriage, _ := c.db.GetTriageState(item.ID)
			tState := triage.ComputeTriageState(item, username, existingTriage)
			_ = c.db.UpsertTriageState(tState)
			synced++
		}
	}

	// 4. Process Recently Merged PRs
	for _, pr := range gqlResp.Data.Merged.Nodes {
		item := convertGQLPRToNotification(repo, pr, "author", worktrees)
		item.State = "merged"
		if err := c.db.UpsertNotification(item); err == nil {
			existingTriage, _ := c.db.GetTriageState(item.ID)
			tState := triage.ComputeTriageState(item, username, existingTriage)
			tState.Bucket = "done"
			tState.Status = "done"
			_ = c.db.UpsertTriageState(tState)
			synced++
		}
	}

	// 5. Process Curated Claimable Unassigned Issues
	var activeClaimableIDs []string
	for _, u := range gqlResp.Data.Unassigned.Nodes {
		item := convertGQLUnassignedToNotification(repo, u)
		if err := c.db.UpsertNotification(item); err == nil {
			activeClaimableIDs = append(activeClaimableIDs, item.ID)
			synced++
		}
	}
	_ = c.db.PruneStaleClaimableIssues(repo, activeClaimableIDs)

	return synced, nil
}

func convertGQLPRToNotification(repo string, pr GQLPullRequest, defaultReason string, worktrees map[string]string) *db.Notification {
	updated, _ := time.Parse(time.RFC3339, pr.UpdatedAt)

	var approvers []string
	var changesRequested []string
	for _, rev := range pr.LatestReviews.Nodes {
		switch rev.State {
		case "APPROVED":
			if rev.Author.Login != "" {
				approvers = append(approvers, rev.Author.Login)
			}
		case "CHANGES_REQUESTED":
			if rev.Author.Login != "" {
				changesRequested = append(changesRequested, rev.Author.Login)
			}
		}
	}

	var pendingReviewers []string
	for _, req := range pr.ReviewRequests.Nodes {
		if req.RequestedReviewer.Login != "" {
			pendingReviewers = append(pendingReviewers, req.RequestedReviewer.Login)
		}
	}

	ballInCourt := "none"
	if len(changesRequested) > 0 {
		ballInCourt = "you"
	} else if len(pendingReviewers) > 0 {
		ballInCourt = "reviewer"
	}

	ciStatus := ""
	if len(pr.Commits.Nodes) > 0 {
		state := pr.Commits.Nodes[0].Commit.StatusCheckRollup.State
		switch strings.ToUpper(state) {
		case "SUCCESS":
			ciStatus = "success"
		case "FAILURE", "ERROR":
			ciStatus = "failure"
		case "PENDING", "EXPECTED":
			ciStatus = "pending"
		}
	}

	latestCommentAuthor := ""
	latestCommentBody := ""
	if len(pr.Comments.Nodes) > 0 {
		latestCommentAuthor = pr.Comments.Nodes[0].Author.Login
		latestCommentBody = pr.Comments.Nodes[0].Body
	}

	state := strings.ToLower(pr.State)
	if pr.IsDraft {
		state = "draft"
	}

	localWorktree := ""
	if pr.HeadRefName != "" && worktrees != nil {
		localWorktree = worktrees[pr.HeadRefName]
	}

	metaJSON, _ := json.Marshal(map[string]interface{}{
		"review_decision": pr.ReviewDecision,
		"head_branch":     pr.HeadRefName,
	})

	id := fmt.Sprintf("pr-%s-%d", strings.ReplaceAll(repo, "/", "-"), pr.Number)

	return &db.Notification{
		ID:                  id,
		GitHubID:            pr.ID,
		Repository:          repo,
		Title:               pr.Title,
		Type:                "PullRequest",
		Reason:              defaultReason,
		URL:                 pr.URL,
		HTMLURL:             pr.URL,
		State:               state,
		CIStatus:            ciStatus,
		Author:              pr.Author.Login,
		AuthorAvatar:        pr.Author.AvatarURL,
		Branch:              pr.HeadRefName,
		Number:              pr.Number,
		Unread:              false,
		GitHubUpdatedAt:     updated,
		RawData:             string(metaJSON),
		Approvers:           approvers,
		PendingReviewers:    pendingReviewers,
		ChangesRequestedBy:  changesRequested,
		BallInCourt:         ballInCourt,
		LatestCommentAuthor: latestCommentAuthor,
		LatestCommentBody:   latestCommentBody,
		LocalWorktreePath:   localWorktree,
	}
}

func convertGQLAssignedToNotification(repo string, a GQLIssueOrPR, worktrees map[string]string) *db.Notification {
	updated, _ := time.Parse(time.RFC3339, a.UpdatedAt)

	latestAuthor := ""
	latestBody := ""
	if len(a.Comments.Nodes) > 0 {
		latestAuthor = a.Comments.Nodes[0].Author.Login
		latestBody = a.Comments.Nodes[0].Body
	}

	itemType := "Issue"
	if a.HeadRefName != "" {
		itemType = "PullRequest"
	}

	localWorktree := ""
	if a.HeadRefName != "" && worktrees != nil {
		localWorktree = worktrees[a.HeadRefName]
	}

	prefix := "issue"
	if itemType == "PullRequest" {
		prefix = "pr"
	}
	id := fmt.Sprintf("%s-%s-%d", prefix, strings.ReplaceAll(repo, "/", "-"), a.Number)

	return &db.Notification{
		ID:                  id,
		GitHubID:            a.ID,
		Repository:          repo,
		Title:               a.Title,
		Type:                itemType,
		Reason:              "assigned",
		URL:                 a.URL,
		HTMLURL:             a.URL,
		State:               strings.ToLower(a.State),
		Author:              a.Author.Login,
		AuthorAvatar:        a.Author.AvatarURL,
		Branch:              a.HeadRefName,
		Number:              a.Number,
		Unread:              false,
		GitHubUpdatedAt:     updated,
		LatestCommentAuthor: latestAuthor,
		LatestCommentBody:   latestBody,
		LocalWorktreePath:   localWorktree,
	}
}

func convertGQLUnassignedToNotification(repo string, u GQLUnassignedIssue) *db.Notification {
	updated, _ := time.Parse(time.RFC3339, u.UpdatedAt)

	var labels []map[string]string
	for _, l := range u.Labels.Nodes {
		labels = append(labels, map[string]string{"name": l.Name})
	}
	metaJSON, _ := json.Marshal(map[string]interface{}{
		"labels": labels,
	})

	id := fmt.Sprintf("claimable-%s-%d", strings.ReplaceAll(repo, "/", "-"), u.Number)

	return &db.Notification{
		ID:              id,
		GitHubID:        u.ID,
		Repository:      repo,
		Title:               u.Title,
		Type:            "Issue",
		Reason:          "claimable",
		URL:             u.URL,
		HTMLURL:         u.URL,
		State:           "open",
		Author:          u.Author.Login,
		AuthorAvatar:    u.Author.AvatarURL,
		Number:          u.Number,
		Unread:          false,
		GitHubUpdatedAt: updated,
		RawData:         string(metaJSON),
	}
}
