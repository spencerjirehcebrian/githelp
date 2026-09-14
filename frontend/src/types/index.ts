/**
 * Types for everything that is not the brief itself.
 *
 * The brief has its own module because it is the product; this is the small
 * amount of configuration around it.
 */

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
  tracked_repos?: string[];
}

export interface StatusResponse {
  auth: AuthStatus;
  server_time: string;
}
