package triage

import (
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

func TestCategorize(t *testing.T) {
	currentUser := "spencerjireh"

	tests := []struct {
		name     string
		notif    *db.Notification
		expected string
	}{
		{
			name: "Review requested",
			notif: &db.Notification{
				Reason: "review_requested",
				Type:   "PullRequest",
				State:  "open",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Direct mention",
			notif: &db.Notification{
				Reason: "mention",
				Type:   "Issue",
				State:  "open",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Team mention",
			notif: &db.Notification{
				Reason: "team_mention",
				Type:   "Discussion",
				State:  "open",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Assigned open issue",
			notif: &db.Notification{
				Reason: "assigned",
				Type:   "Issue",
				State:  "open",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Author PR open (waiting on reviewers)",
			notif: &db.Notification{
				Author:   "spencerjireh",
				Reason:   "author",
				Type:     "PullRequest",
				State:    "open",
				CIStatus: "success",
			},
			expected: BucketWaitingOnOthers,
		},
		{
			name: "Author PR with CI failure",
			notif: &db.Notification{
				Author:   "spencerjireh",
				Reason:   "author",
				Type:     "PullRequest",
				State:    "open",
				CIStatus: "failure",
			},
			expected: BucketActionRequired,
		},
		{
			name: "CI activity failure",
			notif: &db.Notification{
				Reason:   "ci_activity",
				Type:     "CheckSuite",
				CIStatus: "failure",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Subscribed comment",
			notif: &db.Notification{
				Reason: "comment",
				Type:   "Issue",
				State:  "open",
				Author: "otheruser",
			},
			expected: BucketParticipating,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Categorize(tt.notif, currentUser)
			if got != tt.expected {
				t.Errorf("Categorize() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestComputeTriageState(t *testing.T) {
	n := &db.Notification{
		ID:     "123",
		Reason: "review_requested",
		Type:   "PullRequest",
	}

	state := ComputeTriageState(n, "user", nil)
	if state.Bucket != BucketActionRequired || state.Status != StatusInbox {
		t.Errorf("unexpected initial triage state: %+v", state)
	}

	// Preserves status if existing
	existing := &db.TriageState{
		NotificationID: "123",
		Bucket:         BucketParticipating,
		Status:         StatusDone,
		Pinned:         true,
		UpdatedAt:      time.Now(),
	}

	updated := ComputeTriageState(n, "user", existing)
	if updated.Bucket != BucketActionRequired || updated.Status != StatusDone || !updated.Pinned {
		t.Errorf("unexpected updated triage state: %+v", updated)
	}
}
