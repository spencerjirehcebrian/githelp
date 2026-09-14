package rank

import (
	"strings"
	"testing"
	"time"
)

// now is a fixed clock so every age-dependent assertion is deterministic.
var now = time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)

// daysAgo returns a timestamp exactly d days before the fixed clock.
func daysAgo(d int) time.Time {
	return now.Add(-time.Duration(d) * 24 * time.Hour)
}

const viewer = "spencerjirehcebrian"

// spoke returns a one-entry timeline: login said something d days ago.
func spoke(login string, d int) []Event {
	return []Event{{Actor: login, At: daysAgo(d)}}
}

// basePR returns a minimal open PR authored by the viewer.
func basePR() Input {
	return Input{
		Type:      TypePullRequest,
		Number:    100,
		Title:     "some change",
		URL:       "https://github.com/o/r/pull/100",
		Repo:      "o/r",
		Branch:    "feature",
		Author:    viewer,
		Source:    SourceAuthored,
		State:     "open",
		Mergeable: MergeClean,
		UpdatedAt: daysAgo(1),
		CreatedAt: daysAgo(1),
	}
}

func TestClassify(t *testing.T) {
	tests := []struct {
		name       string
		input      Input
		wantLane   Lane
		wantSignal string
		wantAction string
		wantDrop   bool
	}{
		{
			name: "review requested of you is the top blocker",
			input: func() Input {
				in := basePR()
				in.Author = "charlesong-dev"
				in.Source = SourceReviewRequested
				in.UpdatedAt = daysAgo(2)
				return in
			}(),
			wantLane:   LaneUnblockOthers,
			wantSignal: "charlesong-dev requested your review 2d ago",
			wantAction: "Review it",
		},
		{
			name: "you requested changes and the author replied",
			input: func() Input {
				in := basePR()
				in.Author = "charlesong-dev"
				in.Source = SourceReviewedBy
				in.ChangesRequestedBy = []string{viewer}
				in.Events = spoke("charlesong-dev", 1)
				return in
			}(),
			wantLane:   LaneUnblockOthers,
			wantSignal: "you requested changes, charlesong-dev replied yesterday",
			wantAction: "Re-review",
		},
		{
			name: "your own reply does not re-raise a blocked PR",
			input: func() Input {
				in := basePR()
				in.Author = "charlesong-dev"
				in.Source = SourceReviewedBy
				in.ChangesRequestedBy = []string{viewer}
				in.Events = spoke(viewer, 1)
				return in
			}(),
			wantDrop: true,
		},
		{
			name: "unanswered mention",
			input: func() Input {
				in := basePR()
				in.Type = TypeIssue
				in.Author = "kgreatwood-abc"
				in.Source = SourceMentioned
				in.Events = spoke("kgreatwood-abc", 3)
				in.UpdatedAt = daysAgo(3)
				return in
			}(),
			wantLane:   LaneUnblockOthers,
			wantSignal: "kgreatwood-abc mentioned you 3d ago and has not had a reply",
			wantAction: "Reply to kgreatwood-abc",
		},
		{
			name: "mention you already answered is dropped",
			input: func() Input {
				in := basePR()
				in.Type = TypeIssue
				in.Source = SourceMentioned
				in.Author = "kgreatwood-abc"
				in.Events = spoke(viewer, 1)
				return in
			}(),
			wantDrop: true,
		},
		{
			name: "approved and clean means merge",
			input: func() Input {
				in := basePR()
				in.ReviewDecision = DecisionApproved
				in.Approvers = []string{"antoniorafaelu-dev"}
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "approved by antoniorafaelu-dev and mergeable",
			wantAction: "Merge",
		},
		{
			name: "approved but behind main means rebase first",
			input: func() Input {
				in := basePR()
				in.ReviewDecision = DecisionApproved
				in.Approvers = []string{"antoniorafaelu-dev"}
				in.Mergeable = MergeBehind
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "approved by antoniorafaelu-dev, branch is behind main",
			wantAction: "Update branch, then merge",
		},
		{
			name: "approved but conflicting",
			input: func() Input {
				in := basePR()
				in.ReviewDecision = DecisionApproved
				in.Approvers = []string{"antoniorafaelu-dev"}
				in.Mergeable = MergeConflicting
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "approved by antoniorafaelu-dev, but the branch has conflicts",
			wantAction: "Resolve conflicts",
		},
		{
			name: "failing CI",
			input: func() Input {
				in := basePR()
				in.CI = CIFailure
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "CI is failing on your branch",
			wantAction: "Fix the failing checks",
		},
		{
			name: "changes requested on your PR",
			input: func() Input {
				in := basePR()
				in.ReviewDecision = DecisionChangesRequested
				in.ChangesRequestedBy = []string{"kgreatwood-abc"}
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "kgreatwood-abc requested changes",
			wantAction: "Address review",
		},
		{
			name: "draft",
			input: func() Input {
				in := basePR()
				in.IsDraft = true
				in.State = "draft"
				in.UpdatedAt = daysAgo(4)
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "still a draft after 4d",
			wantAction: "Finish draft",
		},
		{
			name: "no reviewer engaged past the nudge threshold",
			input: func() Input {
				in := basePR()
				in.UpdatedAt = daysAgo(10)
				return in
			}(),
			wantLane:   LaneNeedsDecision,
			wantSignal: "no reviewer engaged in 10d",
			wantAction: "Request a reviewer",
		},
		{
			name: "stale past the stale threshold",
			input: func() Input {
				in := basePR()
				in.UpdatedAt = daysAgo(45)
				return in
			}(),
			wantLane:   LaneNeedsDecision,
			wantSignal: "no review decision in 45d",
			wantAction: "Chase a reviewer",
		},
		{
			name: "stale and conflicting is a kill-or-fix decision",
			input: func() Input {
				in := basePR()
				in.Mergeable = MergeConflicting
				in.UpdatedAt = daysAgo(63)
				return in
			}(),
			wantLane:   LaneNeedsDecision,
			wantSignal: "conflicting and untouched for 63d",
			wantAction: "Resolve conflicts",
		},
		{
			name: "fresh PR waiting on a named reviewer is low priority",
			input: func() Input {
				in := basePR()
				in.PendingReviewers = []string{"antoniorafaelu-dev"}
				return in
			}(),
			wantLane:   LaneLandInFlight,
			wantSignal: "waiting on antoniorafaelu-dev to review",
			wantAction: "",
		},
		{
			name: "assigned issue with a priority label is a blocker",
			input: Input{
				Type:      TypeIssue,
				Number:    3321,
				Repo:      "o/r",
				Author:    "someone",
				Source:    SourceAssigned,
				State:     "open",
				Labels:    []string{"priority-high"},
				UpdatedAt: daysAgo(4),
				CreatedAt: daysAgo(6),
			},
			wantLane:   LaneUnblockOthers,
			wantSignal: "assigned to you and labelled priority-high",
			wantAction: "Start it",
		},
		{
			name: "assigned issue with no PR needs scoping",
			input: Input{
				Type:      TypeIssue,
				Number:    3333,
				Repo:      "o/r",
				Source:    SourceAssigned,
				State:     "open",
				UpdatedAt: daysAgo(5),
				CreatedAt: daysAgo(5),
			},
			wantLane:   LaneNeedsDecision,
			wantSignal: "assigned to you 5d ago with no PR opened",
			wantAction: "Scope it",
		},
		{
			name: "assigned issue that already has a PR is in flight",
			input: Input{
				Type:        TypeIssue,
				Number:      3086,
				Repo:        "o/r",
				Source:      SourceAssigned,
				State:       "open",
				HasLinkedPR: true,
				UpdatedAt:   daysAgo(2),
				CreatedAt:   daysAgo(9),
			},
			wantLane:   LaneLandInFlight,
			wantSignal: "assigned to you, work already open against it",
			wantAction: "Finish the open PR",
		},
		{
			name: "claimable issue",
			input: Input{
				Type:      TypeIssue,
				Number:    2229,
				Repo:      "o/r",
				Source:    SourceUnassigned,
				State:     "open",
				CreatedAt: daysAgo(149),
				UpdatedAt: daysAgo(20),
			},
			wantLane:   LanePickUpNext,
			wantSignal: "open and unassigned for 149d",
			wantAction: "",
		},
		{
			name: "claimable issue lists its labels",
			input: Input{
				Type:      TypeIssue,
				Number:    3331,
				Repo:      "o/r",
				Source:    SourceUnassigned,
				State:     "open",
				Labels:    []string{"bug"},
				CreatedAt: daysAgo(1),
				UpdatedAt: daysAgo(1),
			},
			wantLane:   LanePickUpNext,
			wantSignal: "open and unassigned for 1 day, labelled bug",
			wantAction: "",
		},
		{
			name: "someone else's PR you have no relationship to is dropped",
			input: func() Input {
				in := basePR()
				in.Author = "stranger"
				in.Source = SourceAuthored
				return in
			}(),
			wantDrop: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Rank([]Input{tc.input}, viewer, now)

			if tc.wantDrop {
				if len(got) != 0 {
					t.Fatalf("expected item to be dropped, got lane=%q signal=%q",
						got[0].Lane, got[0].Signal)
				}
				return
			}

			if len(got) != 1 {
				t.Fatalf("expected exactly 1 item, got %d", len(got))
			}
			item := got[0]

			if item.Lane != tc.wantLane {
				t.Errorf("lane\n got: %q\nwant: %q", item.Lane, tc.wantLane)
			}
			if item.Signal != tc.wantSignal {
				t.Errorf("signal\n got: %q\nwant: %q", item.Signal, tc.wantSignal)
			}
			if item.Action != tc.wantAction {
				t.Errorf("action\n got: %q\nwant: %q", item.Action, tc.wantAction)
			}
		})
	}
}

func TestLaneOrdering(t *testing.T) {
	claimable := Input{
		Type: TypeIssue, Number: 1, Repo: "o/r", Source: SourceUnassigned,
		State: "open", CreatedAt: daysAgo(200), UpdatedAt: daysAgo(200),
	}
	stale := basePR()
	stale.Number = 2
	stale.UpdatedAt = daysAgo(45)

	approved := basePR()
	approved.Number = 3
	approved.ReviewDecision = DecisionApproved

	blocker := basePR()
	blocker.Number = 4
	blocker.Author = "charlesong-dev"
	blocker.Source = SourceReviewRequested

	got := Rank([]Input{claimable, stale, approved, blocker}, viewer, now)

	wantLanes := []Lane{
		LaneUnblockOthers,
		LaneLandInFlight,
		LaneNeedsDecision,
		LanePickUpNext,
	}

	if len(got) != len(wantLanes) {
		t.Fatalf("expected %d items, got %d", len(wantLanes), len(got))
	}
	for i, want := range wantLanes {
		if got[i].Lane != want {
			t.Errorf("position %d: got lane %q, want %q", i, got[i].Lane, want)
		}
	}
}

func TestStalenessNeverOutranksAFreshBlocker(t *testing.T) {
	// A two-year-old claimable issue must not climb above a blocker, which is
	// exactly the failure mode of sorting by age alone.
	ancient := Input{
		Type: TypeIssue, Number: 1, Repo: "o/r", Source: SourceUnassigned,
		State: "open", CreatedAt: daysAgo(700), UpdatedAt: daysAgo(700),
	}
	fresh := basePR()
	fresh.Number = 2
	fresh.Author = "charlesong-dev"
	fresh.Source = SourceReviewRequested
	fresh.UpdatedAt = now

	got := Rank([]Input{ancient, fresh}, viewer, now)

	if got[0].Number != 2 {
		t.Fatalf("expected the fresh blocker first, got #%d (%s)", got[0].Number, got[0].Signal)
	}
	if got[0].Score <= got[1].Score {
		t.Errorf("blocker score %d should exceed claimable score %d", got[0].Score, got[1].Score)
	}
}

func TestScoreModifiers(t *testing.T) {
	t.Run("failing CI adds weight", func(t *testing.T) {
		clean := basePR()
		clean.ReviewDecision = DecisionChangesRequested

		failing := basePR()
		failing.ReviewDecision = DecisionChangesRequested
		failing.CI = CIFailure

		gotClean := Rank([]Input{clean}, viewer, now)[0]
		gotFailing := Rank([]Input{failing}, viewer, now)[0]

		// Failing CI is matched by an earlier rule, so compare against its own
		// base rather than assuming the same classification.
		if gotFailing.Score <= gotClean.Score {
			t.Errorf("failing CI scored %d, expected above %d", gotFailing.Score, gotClean.Score)
		}
	})

	t.Run("local checkout adds weight", func(t *testing.T) {
		remote := basePR()
		remote.ReviewDecision = DecisionApproved

		local := basePR()
		local.ReviewDecision = DecisionApproved
		local.LocalWorktreePath = "/Users/me/git/repo"

		gotRemote := Rank([]Input{remote}, viewer, now)[0]
		gotLocal := Rank([]Input{local}, viewer, now)[0]

		if gotLocal.Score != gotRemote.Score+10 {
			t.Errorf("local score %d, want %d", gotLocal.Score, gotRemote.Score+10)
		}
		if gotLocal.Local != "/Users/me/git/repo" {
			t.Errorf("local path not carried through, got %q", gotLocal.Local)
		}
	})

	t.Run("staleness is capped", func(t *testing.T) {
		old := basePR()
		old.ReviewDecision = DecisionApproved
		old.UpdatedAt = daysAgo(500)

		capped := basePR()
		capped.ReviewDecision = DecisionApproved
		capped.UpdatedAt = daysAgo(staleCapDays)

		if Rank([]Input{old}, viewer, now)[0].Score != Rank([]Input{capped}, viewer, now)[0].Score {
			t.Error("staleness bonus should saturate at the cap")
		}
	})

	t.Run("claimable issues are not boosted by age", func(t *testing.T) {
		// An issue nobody has claimed in a year is stale because nobody wants
		// it, not because it is urgent. Fresh issues should surface first.
		claimable := func(number, openDays int) Input {
			return Input{
				Type: TypeIssue, Number: number, Repo: "o/r",
				Source: SourceUnassigned, State: "open",
				CreatedAt: daysAgo(openDays), UpdatedAt: daysAgo(openDays),
			}
		}

		got := Rank([]Input{
			claimable(1, 150),
			claimable(2, 2),
			claimable(3, 17),
		}, viewer, now)

		wantOrder := []int{2, 3, 1}
		for i, want := range wantOrder {
			if got[i].Number != want {
				t.Errorf("position %d: got #%d, want #%d", i, got[i].Number, want)
			}
		}
	})
}

func TestDedupeKeepsMostSpecificSource(t *testing.T) {
	// The same PR surfaced by both the authored and review-requested searches.
	authored := basePR()
	authored.Author = "charlesong-dev"
	authored.Source = SourceAuthored

	requested := basePR()
	requested.Author = "charlesong-dev"
	requested.Source = SourceReviewRequested

	got := Rank([]Input{authored, requested}, viewer, now)

	if len(got) != 1 {
		t.Fatalf("expected deduplication to 1 item, got %d", len(got))
	}
	if got[0].Lane != LaneUnblockOthers {
		t.Errorf("expected the more specific source to win, got lane %q", got[0].Lane)
	}
}

func TestDedupeMergesReviewMetadata(t *testing.T) {
	sparse := basePR()
	sparse.ReviewDecision = ""
	sparse.Mergeable = MergeUnknown

	rich := basePR()
	rich.ReviewDecision = DecisionApproved
	rich.Approvers = []string{"antoniorafaelu-dev"}
	rich.Mergeable = MergeBehind

	got := Rank([]Input{sparse, rich}, viewer, now)

	if len(got) != 1 {
		t.Fatalf("expected 1 item, got %d", len(got))
	}
	if got[0].Signal != "approved by antoniorafaelu-dev, branch is behind main" {
		t.Errorf("metadata not merged, got signal %q", got[0].Signal)
	}
}

func TestCheckoutCommandOnlyForPullRequests(t *testing.T) {
	pr := Rank([]Input{basePR()}, viewer, now)[0]
	if pr.Checkout != "gh pr checkout 100" {
		t.Errorf("got checkout %q", pr.Checkout)
	}

	issue := Rank([]Input{{
		Type: TypeIssue, Number: 5, Repo: "o/r", Source: SourceUnassigned,
		State: "open", CreatedAt: daysAgo(3), UpdatedAt: daysAgo(3),
	}}, viewer, now)[0]
	if issue.Checkout != "" {
		t.Errorf("issues should have no checkout command, got %q", issue.Checkout)
	}
}

func TestRankIsDeterministic(t *testing.T) {
	inputs := []Input{}
	for i := 1; i <= 12; i++ {
		in := basePR()
		in.Number = i
		in.UpdatedAt = daysAgo(i % 5)
		inputs = append(inputs, in)
	}

	first := Rank(inputs, viewer, now)
	for i := 0; i < 20; i++ {
		next := Rank(inputs, viewer, now)
		for j := range first {
			if first[j].Number != next[j].Number {
				t.Fatalf("ordering drifted at position %d on run %d", j, i)
			}
		}
	}
}

func TestRelativeTimeRendering(t *testing.T) {
	t.Run("ago reads correctly after a verb", func(t *testing.T) {
		cases := map[int]string{-3: "today", 0: "today", 1: "yesterday", 2: "2d ago", 63: "63d ago"}
		for in, want := range cases {
			if got := ago(in); got != want {
				t.Errorf("ago(%d) = %q, want %q", in, got, want)
			}
		}
	})

	t.Run("duration reads correctly after a preposition", func(t *testing.T) {
		cases := map[int]string{-3: "less than a day", 0: "less than a day", 1: "1 day", 2: "2d", 63: "63d"}
		for in, want := range cases {
			if got := duration(in); got != want {
				t.Errorf("duration(%d) = %q, want %q", in, got, want)
			}
		}
	})

	t.Run("no phrase produces today ago", func(t *testing.T) {
		// Regression: the single shared helper produced "mentioned you today ago".
		in := basePR()
		in.Type = TypeIssue
		in.Author = "asker"
		in.Source = SourceMentioned
		in.Events = spoke("asker", 0)
		in.UpdatedAt = now

		got := Rank([]Input{in}, viewer, now)
		if len(got) != 1 {
			t.Fatalf("expected 1 item, got %d", len(got))
		}
		if strings.Contains(got[0].Signal, "today ago") {
			t.Errorf("ungrammatical signal: %q", got[0].Signal)
		}
		if got[0].Signal != "asker mentioned you today and has not had a reply" {
			t.Errorf("signal = %q", got[0].Signal)
		}
	})
}

func TestStaleMentionsAreDropped(t *testing.T) {
	// A mention nobody followed up on for weeks is not blocking anyone.
	mention := func(ageDays int) Input {
		return Input{
			Type: TypeIssue, Number: 1, Repo: "o/r",
			Author: "asker", Source: SourceMentioned, State: "open",
			Events:    spoke("asker", ageDays),
			UpdatedAt: daysAgo(ageDays), CreatedAt: daysAgo(ageDays),
		}
	}

	if got := Rank([]Input{mention(replyFreshDays)}, viewer, now); len(got) != 1 {
		t.Errorf("a %dd mention should surface, got %d items", replyFreshDays, len(got))
	}
	if got := Rank([]Input{mention(replyFreshDays + 1)}, viewer, now); len(got) != 0 {
		t.Errorf("a stale mention should be dropped, got %d items", len(got))
	}
}

func TestAssignmentOutranksMention(t *testing.T) {
	// Nearly every assigned issue also mentions you. Reporting it as a
	// mention misattributes work you already own.
	base := Input{
		Type: TypeIssue, Number: 1939, Repo: "o/r",
		State: "open", Events: spoke("gerarldpaul-dev", 3),
		UpdatedAt: daysAgo(3), CreatedAt: daysAgo(200),
	}

	asMention := base
	asMention.Source = SourceMentioned

	asAssigned := base
	asAssigned.Source = SourceAssigned

	got := Rank([]Input{asMention, asAssigned}, viewer, now)

	if len(got) != 1 {
		t.Fatalf("expected deduplication to 1 item, got %d", len(got))
	}
	if strings.Contains(got[0].Signal, "mentioned you") {
		t.Errorf("assigned work misreported as a mention: %q", got[0].Signal)
	}
	if got[0].Lane != LaneNeedsDecision {
		t.Errorf("lane = %q, want %q", got[0].Lane, LaneNeedsDecision)
	}
}

func TestEmptyInput(t *testing.T) {
	got := Rank(nil, viewer, now)
	if len(got) != 0 {
		t.Errorf("expected empty result, got %d items", len(got))
	}
}

func TestBall(t *testing.T) {
	t.Run("automation is not a reply", func(t *testing.T) {
		// The failure this prevents: a bot comments after a human question,
		// the engine reads the bot as the last word, and the human waits.
		events := []Event{
			{Actor: "charlesong-dev", At: daysAgo(5)},
			{Actor: "gemini-code-assist", At: daysAgo(1)},
			{Actor: "github-actions", At: daysAgo(1)},
			{Actor: "dependabot[bot]", At: now},
		}

		who, at := ball(events, viewer)
		if who != "charlesong-dev" {
			t.Errorf("ball = %q, want charlesong-dev", who)
		}
		if !at.Equal(daysAgo(5)) {
			t.Errorf("ball time = %v, want %v", at, daysAgo(5))
		}
	})

	t.Run("reviews and comments are one conversation", func(t *testing.T) {
		// A review submitted after the last comment is the last word.
		events := []Event{
			{Actor: viewer, At: daysAgo(4)},
			{Actor: "antoniorafaelu-dev", At: daysAgo(2)},
		}

		if who, _ := ball(events, viewer); who != "antoniorafaelu-dev" {
			t.Errorf("ball = %q, want antoniorafaelu-dev", who)
		}
	})

	t.Run("your own last word leaves the ball with you", func(t *testing.T) {
		events := []Event{
			{Actor: "antoniorafaelu-dev", At: daysAgo(6)},
			{Actor: viewer, At: daysAgo(2)},
		}

		if who, _ := ball(events, viewer); who != "" {
			t.Errorf("ball = %q, want empty", who)
		}
	})

	t.Run("silence leaves the ball with you", func(t *testing.T) {
		if who, _ := ball(nil, viewer); who != "" {
			t.Errorf("ball = %q, want empty", who)
		}
	})

	t.Run("undated events are ignored", func(t *testing.T) {
		events := []Event{{Actor: "charlesong-dev"}}
		if who, _ := ball(events, viewer); who != "" {
			t.Errorf("ball = %q, want empty", who)
		}
	})
}

func TestAReplyWaitingOnYouIsNotPassive(t *testing.T) {
	// Regression: with only the latest comment author and no timestamps, a
	// reviewer's question read as "waiting on antoniorafaelu-dev to review"
	// with nothing to do. Somebody was in fact waiting on the viewer.
	in := basePR()
	in.PendingReviewers = []string{"antoniorafaelu-dev"}
	in.Events = spoke("antoniorafaelu-dev", 3)

	got := Rank([]Input{in}, viewer, now)
	if len(got) != 1 {
		t.Fatalf("expected 1 item, got %d", len(got))
	}

	if got[0].Lane != LaneUnblockOthers {
		t.Errorf("lane = %q, want %q", got[0].Lane, LaneUnblockOthers)
	}
	if got[0].Action != "Reply to antoniorafaelu-dev" {
		t.Errorf("action = %q", got[0].Action)
	}
	if got[0].Signal != "antoniorafaelu-dev commented 3d ago and has not had a reply" {
		t.Errorf("signal = %q", got[0].Signal)
	}
	if got[0].Ball != "antoniorafaelu-dev" {
		t.Errorf("ball = %q", got[0].Ball)
	}
}

func TestYourOwnCommentDoesNotRaiseAPR(t *testing.T) {
	in := basePR()
	in.PendingReviewers = []string{"antoniorafaelu-dev"}
	in.Events = spoke(viewer, 1)

	got := Rank([]Input{in}, viewer, now)
	if len(got) != 1 {
		t.Fatalf("expected 1 item, got %d", len(got))
	}
	if got[0].Lane != LaneLandInFlight {
		t.Errorf("lane = %q, want %q", got[0].Lane, LaneLandInFlight)
	}
	if got[0].Action != "" {
		t.Errorf("action = %q, want no next step", got[0].Action)
	}
}

func TestBoardStatusIsReported(t *testing.T) {
	in := Input{
		Type: TypeIssue, Number: 3237, Repo: "o/r",
		Source: SourceAssigned, State: "open",
		ProjectStatus: "In Progress",
		UpdatedAt:     daysAgo(5), CreatedAt: daysAgo(5),
	}

	got := Rank([]Input{in}, viewer, now)[0]

	want := "assigned to you 5d ago with no PR opened, board status In Progress"
	if got.Signal != want {
		t.Errorf("signal\n got: %q\nwant: %q", got.Signal, want)
	}
	if got.ProjectStatus != "In Progress" {
		t.Errorf("project status = %q", got.ProjectStatus)
	}
}

func TestAStaleCommentIsNotSomebodyWaiting(t *testing.T) {
	// Somebody who spoke six weeks ago and never chased it is not blocked on
	// you. The PR is stale, and the staleness rules describe it better.
	in := basePR()
	in.UpdatedAt = daysAgo(45)
	in.Events = spoke("kgreatwood-abc", 45)

	got := Rank([]Input{in}, viewer, now)[0]

	if got.Lane != LaneNeedsDecision {
		t.Errorf("lane = %q, want %q", got.Lane, LaneNeedsDecision)
	}
	if got.Signal != "no review decision in 45d" {
		t.Errorf("signal = %q", got.Signal)
	}

	// The ball is still reported, it just does not drive the lane.
	if got.Ball != "kgreatwood-abc" {
		t.Errorf("ball = %q", got.Ball)
	}
}
