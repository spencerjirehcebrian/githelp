package db

// AppSettings is everything the user can configure.
//
// Poll intervals, browser notifications, sound, ignored repositories, and
// theme all described behaviour this application no longer has: the brief is
// generated on request and follows the operating system for colour.
type AppSettings struct {
	AuthMode     string   `json:"auth_mode"` // "gh_cli" or "pat"
	PATToken     string   `json:"pat_token,omitempty"`
	TrackedRepos []string `json:"tracked_repos"`
}

// AuthStatus reports the current connection and user profile.
type AuthStatus struct {
	Authenticated bool   `json:"authenticated"`
	AuthMode      string `json:"auth_mode"`
	Username      string `json:"username,omitempty"`
	Name          string `json:"name,omitempty"`
	AvatarURL     string `json:"avatar_url,omitempty"`
	Scopes        string `json:"scopes,omitempty"`
	ErrorMessage  string `json:"error_message,omitempty"`
}
