package triage

import (
	"testing"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

func TestCategorizeComprehensive(t *testing.T) {
	currentUser := "spencerjireh"

	tests := []struct {
		name     string
		user     string
		notif    *db.Notification
		expected string
	}{
		{
			name: "Review requested on open PR",
			user: currentUser,
			notif: &db.Notification{
				Reason: "review_requested",
				Type:   "PullRequest",
				State:  "open",
				Author: "alice",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Review requested case-insensitive check",
			user: currentUser,
			notif: &db.Notification{
				Reason: "REVIEW_REQUESTED",
				Type:   "PullRequest",
				State:  "OPEN",
				Author: "Alice",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Direct mention in issue",
			user: currentUser,
			notif: &db.Notification{
				Reason: "mention",
				Type:   "Issue",
				State:  "open",
				Author: "bob",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Team mention in discussion",
			user: currentUser,
			notif: &db.Notification{
				Reason: "team_mention",
				Type:   "Discussion",
				State:  "open",
				Author: "carol",
			},
			expected: BucketActionRequired,
		},
		{
			name: "CI activity reason with failure",
			user: currentUser,
			notif: &db.Notification{
				Reason:   "ci_activity",
				Type:     "CheckSuite",
				CIStatus: "failure",
				Author:   "spencerjireh",
			},
			expected: BucketActionRequired,
		},
		{
			name: "CI activity reason with error status",
			user: currentUser,
			notif: &db.Notification{
				Reason:   "ci_activity",
				Type:     "CheckSuite",
				CIStatus: "failure",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Author PR open with changes requested",
			user: currentUser,
			notif: &db.Notification{
				Author:   "spencerjireh",
				Reason:   "author",
				Type:     "PullRequest",
				State:    "open",
				CIStatus: "success",
				RawData:  `{"reviewDecision":"CHANGES_REQUESTED"}`,
			},
			expected: BucketActionRequired,
		},
		{
			name: "Author PR open with failing CI",
			user: currentUser,
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
			name: "Author PR open with passing CI (waiting on others)",
			user: currentUser,
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
			name: "Author PR in draft state (waiting on others)",
			user: currentUser,
			notif: &db.Notification{
				Author:   "spencerjireh",
				Reason:   "author",
				Type:     "PullRequest",
				State:    "draft",
				CIStatus: "pending",
			},
			expected: BucketWaitingOnOthers,
		},
		{
			name: "Assigned open issue",
			user: currentUser,
			notif: &db.Notification{
				Reason: "assigned",
				Type:   "Issue",
				State:  "open",
				Author: "someone",
			},
			expected: BucketActionRequired,
		},
		{
			name: "Assigned closed issue",
			user: currentUser,
			notif: &db.Notification{
				Reason: "assigned",
				Type:   "Issue",
				State:  "closed",
				Author: "someone",
			},
			expected: BucketAssigned,
		},
		{
			name: "Comment on subscribed issue",
			user: currentUser,
			notif: &db.Notification{
				Reason: "comment",
				Type:   "Issue",
				State:  "open",
				Author: "dave",
			},
			expected: BucketParticipating,
		},
		{
			name: "Subscribed thread notification",
			user: currentUser,
			notif: &db.Notification{
				Reason: "subscribed",
				Type:   "PullRequest",
				State:  "merged",
				Author: "dave",
			},
			expected: BucketParticipating,
		},
		{
			name: "State change notification",
			user: currentUser,
			notif: &db.Notification{
				Reason: "state_change",
				Type:   "PullRequest",
				State:  "closed",
				Author: "dave",
			},
			expected: BucketParticipating,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Categorize(tt.notif, tt.user)
			if got != tt.expected {
				t.Errorf("Categorize() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestComputeTriageStateTransitions(t *testing.T) {
	n := &db.Notification{
		ID:     "notif-999",
		Reason: "review_requested",
		Type:   "PullRequest",
	}

	initial := ComputeTriageState(n, "user", nil)
	if initial.Bucket != BucketActionRequired || initial.Status != StatusInbox || initial.Pinned {
		t.Errorf("unexpected initial state: %+v", initial)
	}

	snoozeTime := time.Now().Add(2 * time.Hour)
	existing := &db.TriageState{
		NotificationID: "notif-999",
		Bucket:         BucketParticipating,
		Status:         StatusSnoozed,
		SnoozedUntil:   &snoozeTime,
		Pinned:         true,
		Notes:          "Check back after deployment",
		UpdatedAt:      time.Now().Add(-1 * time.Hour),
	}

	updated := ComputeTriageState(n, "user", existing)
	if updated.Bucket != BucketActionRequired {
		t.Errorf("expected updated bucket to be action_required, got %s", updated.Bucket)
	}
	if updated.Status != StatusSnoozed || updated.SnoozedUntil == nil || !updated.Pinned || updated.Notes != "Check back after deployment" {
		t.Errorf("expected state properties to be preserved, got %+v", updated)
	}
}
