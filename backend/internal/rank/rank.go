// Package rank turns raw GitHub work items into a ranked daily brief.
//
// The engine is deterministic and pure: given the same inputs, viewer, and
// clock it always produces the same ordering, signals, and actions. It
// performs no I/O so every rule is directly unit-testable.
//
// Each item is placed in exactly one lane, scored, and given two strings:
//
//	Signal - why this item is in front of you, stated as fact.
//	Action - the single next step, stated as an imperative, or empty when
//	         there is no step you can take.
//
// An action is never advice. It does not suggest closing, handing off,
// claiming, or abandoning anything, and it never estimates effort or value.
//
// Both strings are computed here and shipped to the client verbatim so the
// on-screen text and the agent export can never disagree.
package rank

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Lane is a priority band. Lanes are rendered in the order declared here.
type Lane string

const (
	// LaneUnblockOthers holds work where another person is actively waiting.
	LaneUnblockOthers Lane = "unblock_others"
	// LaneLandInFlight holds your own work that is close to done.
	LaneLandInFlight Lane = "land_in_flight"
	// LaneNeedsDecision holds stalled work that must be revived or killed.
	LaneNeedsDecision Lane = "needs_decision"
	// LanePickUpNext holds unassigned work available to claim.
	LanePickUpNext Lane = "pick_up_next"
)

// laneOrder defines render order. Lower sorts first.
var laneOrder = map[Lane]int{
	LaneUnblockOthers: 0,
	LaneLandInFlight:  1,
	LaneNeedsDecision: 2,
	LanePickUpNext:    3,
}

// Source identifies which GitHub search surfaced an item. An item may be
// returned by several searches; the caller is responsible for deduplicating
// and keeping the most specific source.
type Source string

const (
	SourceAuthored        Source = "authored"
	SourceReviewRequested Source = "review_requested"
	SourceReviewedBy      Source = "reviewed_by"
	SourceMentioned       Source = "mentioned"
	SourceAssigned        Source = "assigned"
	SourceUnassigned      Source = "unassigned"
)

// sourceSpecificity ranks sources when the same item appears in several
// searches. Higher wins, because a more specific source carries a stronger
// signal about what you are expected to do.
//
// Assignment deliberately outranks a mention: nearly every assigned issue
// also mentions you somewhere in its thread, and reporting "so-and-so
// mentioned you" for work you already own is both wrong and noisy.
var sourceSpecificity = map[Source]int{
	SourceUnassigned:      0,
	SourceAuthored:        1,
	SourceMentioned:       2,
	SourceAssigned:        3,
	SourceReviewedBy:      4,
	SourceReviewRequested: 5,
}

// Item type constants.
const (
	TypePullRequest = "pull_request"
	TypeIssue       = "issue"
)

// Review decision constants, mirroring GitHub's reviewDecision enum.
const (
	DecisionApproved         = "APPROVED"
	DecisionChangesRequested = "CHANGES_REQUESTED"
	DecisionReviewRequired   = "REVIEW_REQUIRED"
)

// Merge state constants. These are normalized by the caller from GitHub's
// separate mergeable and mergeStateStatus fields into a single value.
const (
	MergeClean       = "CLEAN"
	MergeBehind      = "BEHIND"
	MergeConflicting = "CONFLICTING"
	MergeBlocked     = "BLOCKED"
	MergeUnknown     = "UNKNOWN"
)

// CI status constants.
const (
	CISuccess = "success"
	CIFailure = "failure"
	CIPending = "pending"
)

// Staleness thresholds in days.
const (
	nudgeAfterDays = 7
	staleAfterDays = 30

	// mentionFreshDays bounds how long an unanswered mention counts as
	// blocking somebody. Past this, nobody is waiting on a reply.
	mentionFreshDays = 7
)

// Event is one entry in an item's conversation: a comment or a review.
//
// Both are folded into a single timeline because, to the person waiting, a
// review and a comment are the same act of speaking.
type Event struct {
	Actor string
	At    time.Time
}

// Input is one raw work item as fetched from GitHub, before ranking.
type Input struct {
	Type   string
	Number int
	Title  string
	URL    string
	Repo   string
	Branch string
	Author string
	Source Source

	State          string
	IsDraft        bool
	ReviewDecision string
	Mergeable      string
	CI             string

	Approvers          []string
	ChangesRequestedBy []string
	PendingReviewers   []string

	// Events is the merged comment and review timeline in any order.
	Events []Event
	Labels []string

	// ProjectStatus is the item's column on a project board, empty when the
	// item is not on one.
	ProjectStatus string

	CreatedAt time.Time
	UpdatedAt time.Time

	// HasLinkedPR reports whether an assigned issue already has a PR against
	// it, which is what separates "needs starting" from "already in flight".
	HasLinkedPR bool

	// LocalWorktreePath is set when the branch is already checked out locally.
	LocalWorktreePath string

	// Ball and BallAt are derived from Events by build. Callers do not set
	// them; anything they put here is overwritten.
	Ball   string
	BallAt time.Time
}

// Item is a ranked work item ready for display or export.
type Item struct {
	Lane  Lane `json:"lane"`
	Score int  `json:"score"`

	Type   string `json:"type"`
	Number int    `json:"number"`
	Title  string `json:"title"`
	URL    string `json:"url"`
	Repo   string `json:"repo"`
	Branch string `json:"branch,omitempty"`
	Author string `json:"author,omitempty"`

	State          string `json:"state"`
	ReviewDecision string `json:"review_decision,omitempty"`
	Mergeable      string `json:"mergeable,omitempty"`
	CI             string `json:"ci,omitempty"`

	AgeDays      int       `json:"age_days"`
	LastActivity time.Time `json:"last_activity"`

	// Ball is the last person other than you to speak, empty when that was
	// you or when nobody has.
	Ball string `json:"ball,omitempty"`

	// ProjectStatus is the board column, empty when the item is not on one.
	ProjectStatus string `json:"project_status,omitempty"`

	Signal string `json:"signal"`

	// Action is the next step, empty when there is none. Empty is a fact
	// about the item rather than a verdict on whether it matters.
	Action string `json:"action"`

	Checkout string `json:"checkout,omitempty"`
	Local    string `json:"local,omitempty"`
}

// Rank classifies, scores, and orders a set of work items.
//
// Items that match no rule are dropped rather than shown without a reason:
// an item with no explanation is noise, and noise is what this replaces.
func Rank(inputs []Input, viewer string, now time.Time) []Item {
	deduped := dedupe(inputs)

	items := make([]Item, 0, len(deduped))
	for _, in := range deduped {
		item, ok := build(in, viewer, now)
		if !ok {
			continue
		}
		items = append(items, item)
	}

	sort.SliceStable(items, func(i, j int) bool {
		if laneOrder[items[i].Lane] != laneOrder[items[j].Lane] {
			return laneOrder[items[i].Lane] < laneOrder[items[j].Lane]
		}
		if items[i].Score != items[j].Score {
			return items[i].Score > items[j].Score
		}
		// Stable tiebreak so output is byte-identical across runs.
		return items[i].Number < items[j].Number
	})

	return items
}

// dedupe collapses items that appear in more than one search, keeping the
// most specific source and merging review metadata across duplicates.
func dedupe(inputs []Input) []Input {
	byKey := make(map[string]Input, len(inputs))
	order := make([]string, 0, len(inputs))

	for _, in := range inputs {
		key := fmt.Sprintf("%s#%s#%d", in.Repo, in.Type, in.Number)
		existing, seen := byKey[key]
		if !seen {
			byKey[key] = in
			order = append(order, key)
			continue
		}

		merged := existing
		if sourceSpecificity[in.Source] > sourceSpecificity[existing.Source] {
			merged.Source = in.Source
		}
		// Prefer whichever copy carries richer review metadata, since not
		// every search selects the same fields.
		if len(in.ChangesRequestedBy) > len(merged.ChangesRequestedBy) {
			merged.ChangesRequestedBy = in.ChangesRequestedBy
		}
		if len(in.Approvers) > len(merged.Approvers) {
			merged.Approvers = in.Approvers
		}
		if len(in.PendingReviewers) > len(merged.PendingReviewers) {
			merged.PendingReviewers = in.PendingReviewers
		}
		if merged.ReviewDecision == "" {
			merged.ReviewDecision = in.ReviewDecision
		}
		if merged.Mergeable == "" || merged.Mergeable == MergeUnknown {
			merged.Mergeable = in.Mergeable
		}
		if merged.CI == "" {
			merged.CI = in.CI
		}
		if len(in.Events) > len(merged.Events) {
			merged.Events = in.Events
		}
		if merged.ProjectStatus == "" {
			merged.ProjectStatus = in.ProjectStatus
		}
		if merged.LocalWorktreePath == "" {
			merged.LocalWorktreePath = in.LocalWorktreePath
		}
		merged.HasLinkedPR = merged.HasLinkedPR || in.HasLinkedPR
		byKey[key] = merged
	}

	out := make([]Input, 0, len(order))
	for _, k := range order {
		out = append(out, byKey[k])
	}
	return out
}

// build classifies one input and assembles the display item.
func build(in Input, viewer string, now time.Time) (Item, bool) {
	// Derived before classification because half the rule table turns on it.
	in.Ball, in.BallAt = ball(in.Events, viewer)

	lane, base, signal, action, ok := classify(in, viewer, now)
	if !ok {
		return Item{}, false
	}

	age := ageDays(in.UpdatedAt, now)

	item := Item{
		Lane:           lane,
		Score:          score(lane, base, in, age),
		Type:           in.Type,
		Number:         in.Number,
		Title:          in.Title,
		URL:            in.URL,
		Repo:           in.Repo,
		Branch:         in.Branch,
		Author:         in.Author,
		State:          in.State,
		ReviewDecision: in.ReviewDecision,
		Mergeable:      in.Mergeable,
		CI:             in.CI,
		AgeDays:        age,
		LastActivity:   in.UpdatedAt,
		Ball:           in.Ball,
		ProjectStatus:  in.ProjectStatus,
		Signal:         signal,
		Action:         action,
		Local:          in.LocalWorktreePath,
	}

	if in.Type == TypePullRequest {
		item.Checkout = fmt.Sprintf("gh pr checkout %d", in.Number)
	}

	return item, true
}

// score applies modifiers on top of a lane base weight.
//
// Staleness is capped so that an ancient low-value item can never outrank a
// fresh blocker, which is the failure mode of plain recency sorting.
func score(lane Lane, base int, in Input, age int) int {
	s := base

	// Claimable work is the one place where age is not urgency. An issue that
	// has sat unclaimed for a year is usually stale because nobody wants it,
	// so newer issues, which tend to be smaller and more relevant, sort first.
	if lane == LanePickUpNext {
		openFor := age
		if openFor > staleCapDays {
			openFor = staleCapDays
		}
		return s + (staleCapDays - openFor)
	}

	if age > staleCapDays {
		s += staleCapDays
	} else if age > 0 {
		s += age
	}

	if in.CI == CIFailure {
		s += 15
	}

	// Work already checked out locally is cheaper to resume.
	if in.LocalWorktreePath != "" {
		s += 10
	}

	return s
}

const staleCapDays = 20

// classify applies the rule table. The first matching rule wins, so ordering
// within this function is the priority policy.
//
// An action is the next step and nothing else. It never suggests closing,
// handing off, claiming, or abandoning anything, and it is empty when there
// is no step to take. An empty action is a fact about the item, not a verdict
// on whether it deserves your time.
func classify(in Input, viewer string, now time.Time) (Lane, int, string, string, bool) {
	age := ageDays(in.UpdatedAt, now)
	isMine := equalUser(in.Author, viewer)
	ballAge := ageDays(in.BallAt, now)

	// Claimable work is terminal: it is never anything else.
	if in.Source == SourceUnassigned {
		openFor := ageDays(in.CreatedAt, now)
		signal := fmt.Sprintf("open and unassigned for %s", duration(openFor))
		if len(in.Labels) > 0 {
			signal = fmt.Sprintf("%s, labelled %s", signal, strings.Join(in.Labels, ", "))
		}
		return LanePickUpNext, 10, signal, "", true
	}

	// Someone explicitly asked for your review. Strongest possible signal
	// that another person is blocked on you.
	if in.Source == SourceReviewRequested && !isMine {
		who := in.Author
		if who == "" {
			who = "someone"
		}
		return LaneUnblockOthers, 100,
			fmt.Sprintf("%s requested your review %s", who, ago(age)),
			"Review it",
			true
	}

	// You blocked this PR and the author has since responded. GitHub does not
	// re-request review in this case, so it silently falls off most dashboards.
	if !isMine && contains(in.ChangesRequestedBy, viewer) && in.Ball != "" {
		return LaneUnblockOthers, 95,
			fmt.Sprintf("you requested changes, %s replied %s", in.Ball, ago(ballAge)),
			"Re-review",
			true
	}

	// An unanswered mention. Someone asked you a direct question.
	//
	// Gated by age on purpose. A mention nobody followed up on for weeks is
	// not blocking anyone; treating it as urgent buries the things that are.
	if in.Source == SourceMentioned {
		switch {
		case in.Ball == "":
			// You spoke last, so the ball is not in your court.
			return "", 0, "", "", false
		case ballAge > mentionFreshDays:
			return "", 0, "", "", false
		default:
			return LaneUnblockOthers, 85,
				fmt.Sprintf("%s mentioned you %s and has not had a reply", in.Ball, ago(ballAge)),
				fmt.Sprintf("Reply to %s", in.Ball),
				true
		}
	}

	// Issues assigned to you.
	if in.Type == TypeIssue && in.Source == SourceAssigned {
		if label, ok := priorityLabel(in.Labels); ok {
			return LaneUnblockOthers, 90,
				withStatus(fmt.Sprintf("assigned to you and labelled %s", label), in.ProjectStatus),
				"Start it",
				true
		}
		if in.HasLinkedPR {
			return LaneLandInFlight, 45,
				withStatus("assigned to you, work already open against it", in.ProjectStatus),
				"Finish the open PR",
				true
		}
		return LaneNeedsDecision, 35,
			withStatus(fmt.Sprintf("assigned to you %s with no PR opened", ago(age)), in.ProjectStatus),
			"Scope it",
			true
	}

	// A PR someone else opened but assigned to you. Ownership is ambiguous,
	// which is precisely why these rot untouched for months.
	if in.Type == TypePullRequest && !isMine && in.Source == SourceAssigned {
		author := in.Author
		if author == "" {
			author = "someone else"
		}
		if in.Mergeable == MergeConflicting {
			return LaneNeedsDecision, 52,
				fmt.Sprintf("opened by %s, assigned to you, conflicting for %s", author, duration(age)),
				"Resolve conflicts",
				true
		}
		return LaneNeedsDecision, 40,
			fmt.Sprintf("opened by %s and assigned to you", author),
			"",
			true
	}

	// Everything below concerns pull requests you authored.
	if in.Type != TypePullRequest || !isMine {
		return "", 0, "", "", false
	}

	// Conflicts on an old branch are a decision, not a task. Checked before
	// the approval rules because a stale conflicted PR is often dead work.
	if in.Mergeable == MergeConflicting && age > staleAfterDays {
		return LaneNeedsDecision, 55,
			fmt.Sprintf("conflicting and untouched for %s", duration(age)),
			"Resolve conflicts",
			true
	}

	if in.ReviewDecision == DecisionApproved {
		approver := firstOr(in.Approvers, "a reviewer")
		switch in.Mergeable {
		case MergeConflicting:
			return LaneLandInFlight, 78,
				fmt.Sprintf("approved by %s, but the branch has conflicts", approver),
				"Resolve conflicts",
				true
		case MergeBehind:
			return LaneLandInFlight, 75,
				fmt.Sprintf("approved by %s, branch is behind main", approver),
				"Update branch, then merge",
				true
		case MergeBlocked:
			return LaneLandInFlight, 72,
				fmt.Sprintf("approved by %s, but merging is blocked", approver),
				"Clear the merge block",
				true
		default:
			return LaneLandInFlight, 80,
				fmt.Sprintf("approved by %s and mergeable", approver),
				"Merge",
				true
		}
	}

	if in.CI == CIFailure {
		return LaneLandInFlight, 70,
			"CI is failing on your branch",
			"Fix the failing checks",
			true
	}

	if in.ReviewDecision == DecisionChangesRequested {
		reviewer := firstOr(in.ChangesRequestedBy, "a reviewer")
		return LaneLandInFlight, 65,
			fmt.Sprintf("%s requested changes", reviewer),
			"Address review",
			true
	}

	// Somebody who is not you spoke last. GitHub surfaces this nowhere, and
	// it is the most common reason a PR with no review decision sits: the
	// author is waiting on the reviewer while the reviewer waits on a reply.
	if in.Ball != "" {
		return LaneUnblockOthers, 88,
			fmt.Sprintf("%s commented %s and has not had a reply", in.Ball, ago(ballAge)),
			fmt.Sprintf("Reply to %s", in.Ball),
			true
	}

	if in.IsDraft {
		return LaneLandInFlight, 40,
			fmt.Sprintf("still a draft after %s", duration(age)),
			"Finish draft",
			true
	}

	// No review decision yet. How long it has sat decides whether this is a
	// gentle nudge or a real decision about whether the work is still alive.
	noReviewer := len(in.PendingReviewers) == 0
	switch {
	case age > staleAfterDays:
		return LaneNeedsDecision, 45,
			fmt.Sprintf("no review decision in %s", duration(age)),
			"Chase a reviewer",
			true
	case age > nudgeAfterDays && noReviewer:
		return LaneNeedsDecision, 50,
			fmt.Sprintf("no reviewer engaged in %s", duration(age)),
			"Request a reviewer",
			true
	}

	reviewer := firstOr(in.PendingReviewers, "a reviewer")
	return LaneLandInFlight, 30,
		fmt.Sprintf("waiting on %s to review", reviewer),
		"",
		true
}

// ball reports who an item is waiting on, and when they last spoke.
//
// Comments and reviews are one conversation, so they are merged into a single
// timeline and the last human to speak wins. An empty login means the ball is
// in your court: either you spoke last, or nobody has spoken at all.
func ball(events []Event, viewer string) (string, time.Time) {
	var last Event
	for _, e := range events {
		if e.Actor == "" || e.At.IsZero() || isBot(e.Actor) {
			continue
		}
		if last.At.IsZero() || e.At.After(last.At) {
			last = e
		}
	}

	if last.Actor == "" || equalUser(last.Actor, viewer) {
		return "", time.Time{}
	}
	return last.Actor, last.At
}

// botActors are the automations that comment on nearly every pull request.
// Counting their output as a reply would leave the ball in your court forever
// and hide the humans actually waiting on you.
var botActors = map[string]bool{
	"gemini-code-assist": true,
	"github-actions":     true,
	"codecov":            true,
}

func isBot(login string) bool {
	lower := strings.ToLower(strings.TrimSpace(login))
	return strings.HasSuffix(lower, "[bot]") || botActors[lower]
}

// withStatus appends a project board status to a signal, when the issue is on
// a board at all.
func withStatus(signal, status string) string {
	if status == "" {
		return signal
	}
	return fmt.Sprintf("%s, board status %s", signal, status)
}

// priorityLabel reports whether any label marks the item as elevated.
func priorityLabel(labels []string) (string, bool) {
	for _, l := range labels {
		lower := strings.ToLower(l)
		switch {
		case strings.Contains(lower, "priority"),
			strings.Contains(lower, "urgent"),
			strings.Contains(lower, "critical"),
			lower == "p0", lower == "p1":
			return l, true
		}
	}
	return "", false
}

// ageDays returns whole days between t and now, floored at zero.
func ageDays(t time.Time, now time.Time) int {
	if t.IsZero() {
		return 0
	}
	d := int(now.Sub(t).Hours() / 24)
	if d < 0 {
		return 0
	}
	return d
}

// ago renders a point in the past. Reads correctly after a verb:
// "mentioned you 3d ago", "mentioned you today".
func ago(d int) string {
	switch {
	case d <= 0:
		return "today"
	case d == 1:
		return "yesterday"
	default:
		return fmt.Sprintf("%dd ago", d)
	}
}

// duration renders an elapsed span. Reads correctly after a preposition:
// "unassigned for 3d", "unassigned for less than a day".
func duration(d int) string {
	switch {
	case d <= 0:
		return "less than a day"
	case d == 1:
		return "1 day"
	default:
		return fmt.Sprintf("%dd", d)
	}
}

func equalUser(a, b string) bool {
	return a != "" && b != "" && strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

func contains(list []string, target string) bool {
	for _, v := range list {
		if equalUser(v, target) {
			return true
		}
	}
	return false
}

func firstOr(list []string, fallback string) string {
	if len(list) > 0 && list[0] != "" {
		return list[0]
	}
	return fallback
}
