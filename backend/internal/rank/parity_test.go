package rank

import (
	"strings"
	"testing"
	"time"
)

// This file replays a real daily-gh brief through the engine and asserts the
// engine reaches the same conclusions a human-guided agent did.
//
// Source: daily-gh run against theteamatx/x-benjamin-repo on 2026-09-11.
// If a rule change regresses parity with that brief, these tests fail.

var briefDay = time.Date(2026, 9, 11, 12, 10, 0, 0, time.UTC)

func on(y, m, d int) time.Time {
	return time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
}

const me = "spencerjirehcebrian"

// realBrief returns the work items as they stood on the morning of the run.
func realBrief() []Input {
	repo := "theteamatx/x-benjamin-repo"

	return []Input{
		// daily-gh Priority 1: you requested changes, author has replied twice.
		{
			Type: TypePullRequest, Number: 3152, Repo: repo,
			Title:  "Update Images.AvailableProtoFields by join on BQ object_ext",
			Author: "charlesong-dev", Source: SourceReviewedBy,
			State: "open", ReviewDecision: DecisionChangesRequested,
			ChangesRequestedBy: []string{me},
			Events:             []Event{{Actor: "charlesong-dev", At: on(2026, 9, 11)}},
			Mergeable:          MergeClean, CI: CISuccess,
			UpdatedAt: on(2026, 9, 11), CreatedAt: on(2026, 8, 30),
		},
		// daily-gh Priority 1: priority raised, sync job timing out.
		{
			Type: TypeIssue, Number: 3321, Repo: repo,
			Title:  "Update sync itemsets script to skip discarded runs",
			Source: SourceAssigned, State: "open",
			Labels:    []string{"priority-high"},
			UpdatedAt: on(2026, 9, 10), CreatedAt: on(2026, 9, 5),
		},
		// daily-gh Priority 2: approved, behind main.
		{
			Type: TypePullRequest, Number: 3130, Repo: repo,
			Title:  "replace itemset continue run logic with warning dialog",
			Author: me, Source: SourceAuthored,
			State: "open", ReviewDecision: DecisionApproved,
			Approvers: []string{"antoniorafaelu-dev"},
			Mergeable: MergeBehind, CI: CISuccess,
			UpdatedAt: on(2026, 9, 9), CreatedAt: on(2026, 8, 28),
		},
		// daily-gh Priority 2: draft, behind main.
		{
			Type: TypePullRequest, Number: 3347, Repo: repo,
			Title:  "update QC batch definition",
			Author: me, Source: SourceAuthored,
			State: "draft", IsDraft: true,
			Mergeable: MergeBehind,
			UpdatedAt: on(2026, 9, 10), CreatedAt: on(2026, 9, 8),
		},
		// daily-gh Priority 2: no reviewer engaged, last activity 2026-09-01.
		{
			Type: TypePullRequest, Number: 2865, Repo: repo,
			Title:  "DSC status dropdown for Braddock and is50",
			Author: me, Source: SourceAuthored,
			State: "open", ReviewDecision: DecisionReviewRequired,
			Mergeable: MergeClean,
			UpdatedAt: on(2026, 9, 1), CreatedAt: on(2026, 8, 10),
		},
		// daily-gh Priority 3: 39d stale, no decision.
		{
			Type: TypePullRequest, Number: 2862, Repo: repo,
			Title:  "make HVP selectable in thermo_is50",
			Author: me, Source: SourceAuthored,
			State: "open", Mergeable: MergeClean,
			UpdatedAt: on(2026, 8, 20), CreatedAt: on(2026, 8, 3),
		},
		// daily-gh Priority 3: 45d stale, no decision.
		{
			Type: TypePullRequest, Number: 2803, Repo: repo,
			Title:  "gemini auto-labeling benchmark framework",
			Author: me, Source: SourceAuthored,
			State: "open", Mergeable: MergeClean,
			UpdatedAt: on(2026, 8, 6), CreatedAt: on(2026, 7, 28),
		},
		// daily-gh Priority 3: 63d, conflicting, authored by someone else but
		// assigned to you. Ownership genuinely unclear.
		{
			Type: TypePullRequest, Number: 2682, Repo: repo,
			Title:  "integrate dino backbone",
			Author: "gerarldpaul-dev", Source: SourceAssigned,
			State: "open", ReviewDecision: DecisionChangesRequested,
			Mergeable: MergeConflicting,
			UpdatedAt: on(2026, 7, 10), CreatedAt: on(2026, 6, 1),
		},
		// daily-gh Priority 4: assigned issues with no PR.
		{
			Type: TypeIssue, Number: 3333, Repo: repo,
			Title:  "Update Readmes to reflect Spanner DB",
			Source: SourceAssigned, State: "open",
			UpdatedAt: on(2026, 9, 9), CreatedAt: on(2026, 9, 9),
		},
		{
			Type: TypeIssue, Number: 3237, Repo: repo,
			Title:  "ItemSet App architecture refactor",
			Source: SourceAssigned, State: "open",
			UpdatedAt: on(2026, 9, 1), CreatedAt: on(2026, 9, 1),
		},
		{
			Type: TypeIssue, Number: 1939, Repo: repo,
			Title:  "Monitor Performance of Viewer (Flutter)",
			Source: SourceAssigned, State: "open",
			UpdatedAt: on(2026, 1, 28), CreatedAt: on(2026, 1, 28),
		},
		// daily-gh Mentions: a direct question awaiting your answer.
		{
			Type: TypeIssue, Number: 3287, Repo: repo,
			Title:  "QC_FORM_FACTOR batch handling",
			Author: "kgreatwood-abc", Source: SourceMentioned,
			State:     "open",
			Events:    []Event{{Actor: "kgreatwood-abc", At: on(2026, 9, 9)}},
			UpdatedAt: on(2026, 9, 9), CreatedAt: on(2026, 9, 2),
		},
		// daily-gh Claimable backlog.
		{
			Type: TypeIssue, Number: 3162, Repo: repo,
			Title:  "Gemini bottle pre-filter prompt ablation",
			Source: SourceUnassigned, State: "open",
			UpdatedAt: on(2026, 8, 25), CreatedAt: on(2026, 8, 25),
		},
		{
			Type: TypeIssue, Number: 2229, Repo: repo,
			Title:  "Extend ItemSet Data Config Generator to attributes",
			Source: SourceUnassigned, State: "open",
			UpdatedAt: on(2026, 4, 14), CreatedAt: on(2026, 4, 14),
		},
		{
			Type: TypeIssue, Number: 3331, Repo: repo,
			Title:  "Fix halved retinanet-sourced labels",
			Source: SourceUnassigned, State: "open",
			UpdatedAt: on(2026, 9, 9), CreatedAt: on(2026, 9, 9),
		},
	}
}

// TestParityWithDailyGH asserts every item lands in the lane the daily-gh
// brief assigned it to.
func TestParityWithDailyGH(t *testing.T) {
	want := map[int]Lane{
		3152: LaneUnblockOthers, // P1 re-review
		3321: LaneUnblockOthers, // P1 priority-bumped issue
		3287: LaneUnblockOthers, // unanswered mention
		3130: LaneLandInFlight,  // P2 approved, rebase and merge
		3347: LaneLandInFlight,  // P2 draft
		2865: LaneNeedsDecision, // P2 no reviewer, 10d
		2862: LaneNeedsDecision, // P3 39d
		2803: LaneNeedsDecision, // P3 45d
		2682: LaneNeedsDecision, // P3 ownership unclear
		3333: LaneNeedsDecision, // P4 assigned, no PR
		3237: LaneNeedsDecision, // P4 assigned, no PR
		1939: LaneNeedsDecision, // P4 assigned, no PR
		3162: LanePickUpNext,    // claimable
		2229: LanePickUpNext,    // claimable
		3331: LanePickUpNext,    // claimable
	}

	got := Rank(realBrief(), me, briefDay)

	if len(got) != len(want) {
		t.Fatalf("engine returned %d items, daily-gh listed %d", len(got), len(want))
	}

	byNumber := make(map[int]Item, len(got))
	for _, it := range got {
		byNumber[it.Number] = it
	}

	for number, wantLane := range want {
		it, ok := byNumber[number]
		if !ok {
			t.Errorf("#%d missing from the brief entirely", number)
			continue
		}
		if it.Lane != wantLane {
			t.Errorf("#%d: got lane %q, daily-gh put it in %q (signal: %s)",
				number, it.Lane, wantLane, it.Signal)
		}
	}
}

// TestParityTopOfBrief asserts the engine agrees with daily-gh about which two
// items block other people, and surfaces them before anything else.
func TestParityTopOfBrief(t *testing.T) {
	got := Rank(realBrief(), me, briefDay)

	if len(got) < 2 {
		t.Fatalf("expected a populated brief, got %d items", len(got))
	}

	// daily-gh: "Two things block others right now: PR #3152 ... and issue #3321".
	topTwo := map[int]bool{got[0].Number: true, got[1].Number: true}
	for _, n := range []int{3152, 3321} {
		if !topTwo[n] {
			t.Errorf("#%d should be in the top two, got #%d and #%d",
				n, got[0].Number, got[1].Number)
		}
	}
}

// TestParityEveryItemExplainsItself asserts no item reaches the user without
// an explanation. An item with no stated reason is the noise this product
// exists to remove.
//
// An action is not required. Some items genuinely have no next step, and
// inventing one for them is how a report turns into advice.
func TestParityEveryItemExplainsItself(t *testing.T) {
	for _, it := range Rank(realBrief(), me, briefDay) {
		if it.Signal == "" {
			t.Errorf("#%d has no signal", it.Number)
		}
	}
}

// TestActionsNeverAdvise pins the one rule the vocabulary must keep: an action
// states the next step and never suggests giving the work up.
func TestActionsNeverAdvise(t *testing.T) {
	banned := []string{
		"hand it off", "unassign", "close it", "claim it",
		"if it fits", "abandon", "worth", "quick",
	}

	for _, it := range Rank(realBrief(), me, briefDay) {
		lower := strings.ToLower(it.Action)
		for _, phrase := range banned {
			if strings.Contains(lower, phrase) {
				t.Errorf("#%d action %q contains banned advice %q", it.Number, it.Action, phrase)
			}
		}
	}
}

// TestParityOwnershipAmbiguity pins the specific judgement daily-gh made about
// PR #2682, which the engine originally dropped on the floor.
func TestParityOwnershipAmbiguity(t *testing.T) {
	got := Rank(realBrief(), me, briefDay)

	for _, it := range got {
		if it.Number != 2682 {
			continue
		}
		wantSignal := "opened by gerarldpaul-dev, assigned to you, conflicting for 63d"
		if it.Signal != wantSignal {
			t.Errorf("signal\n got: %q\nwant: %q", it.Signal, wantSignal)
		}
		wantAction := "Resolve conflicts"
		if it.Action != wantAction {
			t.Errorf("action\n got: %q\nwant: %q", it.Action, wantAction)
		}
		return
	}
	t.Fatal("#2682 missing from the brief")
}

// TestParityLanesAreContiguous asserts lanes never interleave, so the rendered
// brief can group by lane in a single pass.
func TestParityLanesAreContiguous(t *testing.T) {
	got := Rank(realBrief(), me, briefDay)

	seen := map[Lane]bool{}
	var current Lane
	for i, it := range got {
		if i == 0 || it.Lane != current {
			if seen[it.Lane] {
				t.Fatalf("lane %q reappears at position %d after being closed", it.Lane, i)
			}
			seen[it.Lane] = true
			current = it.Lane
		}
	}
}
