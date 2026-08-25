export type BucketType =
  | 'action_required'
  | 'waiting_on_others'
  | 'mentions'
  | 'assigned'
  | 'participating'
  | 'done'
  | 'snoozed';

export type NotificationStatus = 'inbox' | 'done' | 'snoozed';

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
}

export interface EnrichedNotification extends NotificationItem {
  triage: TriageState;
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
  theme: 'dark' | 'light' | 'system';
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
