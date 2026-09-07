export type BucketType =
  | 'action_required'
  | 'waiting_on_others'
  | 'mentions'
  | 'assigned'
  | 'participating'
  | 'done'
  | 'snoozed';

export type NotificationStatus = 'inbox' | 'done' | 'snoozed';

export type AppViewMode = 'tasks' | 'triage';

export type DashboardLayoutMode = 'stream' | 'board' | 'standup';

export type TaskSectionId =
  | 'today'
  | 'reviews'
  | 'authored'
  | 'issues'
  | 'completed';

export interface TaskSection {
  id: TaskSectionId;
  title: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  items: EnrichedNotification[];
}

export interface TaskBurndownMetrics {
  todayTotal: number;
  todayCompleted: number;
  reviewsCount: number;
  authoredCount: number;
  issuesCount: number;
  completedCount: number;
}

export type PipelineColumnId =
  | 'review_required'
  | 'ci_failing'
  | 'ready_to_merge'
  | 'waiting';

export interface VisibilityMetrics {
  blockersCount: number;
  ciFailingCount: number;
  readyToMergeCount: number;
  staleCount: number;
}

export interface PipelineColumn {
  id: PipelineColumnId;
  title: string;
  description: string;
  items: EnrichedNotification[];
}

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CIDetail {
  name: string;
  status: 'success' | 'failure' | 'pending' | 'error' | string;
  description?: string;
  url?: string;
}

export interface LabelInfo {
  name: string;
  color: string;
}

export interface UserInfo {
  login: string;
  avatar_url?: string;
}

export interface PRMetadata {
  body?: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  comments_count?: number;
  labels?: LabelInfo[];
  assignees?: UserInfo[];
  reviewers?: UserInfo[];
  head_branch?: string;
  base_branch?: string;
  files?: FileDiff[];
  ci_details?: CIDetail[];
}

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Actions' | 'Navigation' | 'System';
  shortcut?: string;
  iconName: string;
  perform: () => void;
}

export interface TriageState {
  notification_id: string;
  bucket: BucketType;
  status: NotificationStatus;
  snoozed_until?: string | null;
  pinned: boolean;
  notes: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  github_id: string;
  repository: string;
  title: string;
  type: string; // 'PullRequest' | 'Issue' | 'Commit' | 'Discussion' | 'Release' | 'CheckSuite'
  reason: string; // 'review_requested' | 'mention' | 'assigned' | 'author' | 'comment' | 'subscribed' | 'state_change' | 'ci_activity'
  url: string;
  html_url: string;
  state: string; // 'open' | 'closed' | 'merged' | 'draft'
  ci_status: string; // 'success' | 'failure' | 'pending' | ''
  author: string;
  author_avatar: string;
  branch?: string;
  number?: number;
  unread: boolean;
  updated_at: string;
  last_read_at?: string | null;
  raw_data?: string;
  approvers?: string[];
  pending_reviewers?: string[];
  changes_requested_by?: string[];
  ball_in_court?: 'you' | 'reviewer' | 'none';
  latest_comment_author?: string;
  latest_comment_body?: string;
  local_worktree_path?: string;
}

export interface EnrichedNotification extends NotificationItem {
  triage: TriageState;
}

export interface StandupResponse {
  date: string;
  formatted_text: string;
  is_saved: boolean;
  merged: string[];
  for_review: string[];
  done: string[];
  todo: string[];
}

export interface ClaimableIssue extends NotificationItem {
  days_open: number;
  subsystem?: string;
}

export interface WorktreesResponse {
  worktrees: Record<string, string>;
}

export interface AuthStatus {
  authenticated: boolean;
  auth_mode: 'gh_cli' | 'pat';
  username?: string;
  name?: string;
  avatar_url?: string;
  scopes?: string;
  error_message?: string;
}

export interface AppSettings {
  auth_mode: 'gh_cli' | 'pat';
  pat_token?: string;
  poll_interval_sec: number;
  enable_browser_notifications: boolean;
  enable_sound: boolean;
  ignored_repos: string[];
  tracked_repos?: string[];
  theme: 'dark' | 'light' | 'system';
  preferred_editor?: 'cursor' | 'vscode' | 'zed' | 'terminal';
}

export interface StatusResponse {
  auth: AuthStatus;
  bucket_counts: Record<string, number>;
  repo_counts: Record<string, number>;
  server_time: string;
}

export interface SyncResponse {
  synced_count: number;
  bucket_counts: Record<string, number>;
  repo_counts: Record<string, number>;
}
