package triage

import (
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

// Bucket constants
const (
	BucketActionRequired  = "action_required"
	BucketWaitingOnOthers = "waiting_on_others"
	BucketMentions        = "mentions"
	BucketAssigned        = "assigned"
	BucketParticipating   = "participating"
)

// Status constants
const (
	StatusInbox   = "inbox"
	StatusDone    = "done"
	StatusSnoozed = "snoozed"
)

// Categorize determines the appropriate triage bucket for a notification given the current user's username.
func Categorize(n *db.Notification, currentUsername string) string {
	lowerCurrentUser := strings.ToLower(strings.TrimSpace(currentUsername))
	lowerAuthor := strings.ToLower(strings.TrimSpace(n.Author))
	lowerReason := strings.ToLower(strings.TrimSpace(n.Reason))
	lowerState := strings.ToLower(strings.TrimSpace(n.State))
	lowerCIStatus := strings.ToLower(strings.TrimSpace(n.CIStatus))

	isAuthor := lowerCurrentUser != "" && lowerAuthor == lowerCurrentUser

	// 1. Review requested is always high-priority Action Required
	if lowerReason == "review_requested" {
		return BucketActionRequired
	}

	// 2. CI failure on user's branch or PR
	if (lowerReason == "ci_activity" || isAuthor) && lowerCIStatus == "failure" {
		return BucketActionRequired
	}

	// 3. User is author of PR with changes requested or open with CI failure
	if isAuthor && n.Type == "PullRequest" {
		if strings.Contains(strings.ToLower(n.RawData), "changes_requested") || lowerCIStatus == "failure" {
			return BucketActionRequired
		}
		if lowerState == "open" || lowerState == "draft" {
			return BucketWaitingOnOthers
		}
	}

	// 4. Mention (direct mention) -> Action Required / Mentions
	if lowerReason == "mention" || lowerReason == "team_mention" {
		return BucketActionRequired
	}

	// 5. Assigned to user and still open -> Action Required
	if lowerReason == "assigned" {
		if lowerState == "open" || lowerState == "" {
			return BucketActionRequired
		}
		return BucketAssigned
	}

	// 6. If authored by user and not matching above
	if isAuthor && lowerState == "open" {
		return BucketWaitingOnOthers
	}

	// 7. General participating / subscribed
	return BucketParticipating
}

// ComputeTriageState returns an initial or updated TriageState for a notification.
func ComputeTriageState(n *db.Notification, currentUsername string, existing *db.TriageState) *db.TriageState {
	bucket := Categorize(n, currentUsername)
	now := time.Now().UTC()

	if existing == nil {
		return &db.TriageState{
			NotificationID: n.ID,
			Bucket:         bucket,
			Status:         StatusInbox,
			Pinned:         false,
			Notes:          "",
			UpdatedAt:      now,
		}
	}

	state := *existing
	state.Bucket = bucket
	state.UpdatedAt = now
	return &state
}
