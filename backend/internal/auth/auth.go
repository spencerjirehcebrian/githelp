package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

type Manager struct {
	db      *db.DB
	client  *http.Client
	baseURL string
	mu      sync.RWMutex
	cached  *db.AuthStatus
	token   string
}

func NewManager(database *db.DB) *Manager {
	return &Manager{
		db: database,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: "https://api.github.com",
	}
}

// SetBaseURL allows overriding the GitHub API base URL (useful for testing).
func (m *Manager) SetBaseURL(url string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.baseURL = url
}

// SetHTTPClient allows overriding the HTTP client (useful for testing).
func (m *Manager) SetHTTPClient(client *http.Client) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.client = client
}

// GetToken resolves the active GitHub token based on settings (PAT vs gh CLI).
func (m *Manager) GetToken(ctx context.Context) (string, string, error) {
	settings, err := m.db.GetSettings()
	if err != nil {
		return "", "", fmt.Errorf("failed to get settings: %w", err)
	}

	// 1. If user explicitly configured PAT mode and provided a PAT token
	if settings.AuthMode == "pat" && strings.TrimSpace(settings.PATToken) != "" {
		return strings.TrimSpace(settings.PATToken), "pat", nil
	}

	// 2. Otherwise try gh CLI
	token, err := m.getGhCliToken(ctx)
	if err == nil && token != "" {
		return token, "gh_cli", nil
	}

	// 3. Fallback to PAT if available even if auth_mode wasn't explicitly set to pat
	if strings.TrimSpace(settings.PATToken) != "" {
		return strings.TrimSpace(settings.PATToken), "pat", nil
	}

	return "", "", errors.New("no GitHub authentication found (gh CLI not authenticated and no PAT provided)")
}

func (m *Manager) getGhCliToken(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "gh", "auth", "token")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(out))
	if token == "" {
		return "", errors.New("gh auth token returned empty string")
	}
	return token, nil
}

type gitHubUserResponse struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// ValidateToken checks if a token is valid by querying GitHub API.
func (m *Manager) ValidateToken(ctx context.Context, token string) (*db.AuthStatus, error) {
	if strings.TrimSpace(token) == "" {
		return &db.AuthStatus{
			Authenticated: false,
			ErrorMessage:  "Token is empty",
		}, nil
	}

	m.mu.RLock()
	base := m.baseURL
	httpClient := m.client
	m.mu.RUnlock()

	req, err := http.NewRequestWithContext(ctx, "GET", base+"/user", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "GitHelp-App/1.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		return &db.AuthStatus{
			Authenticated: false,
			ErrorMessage:  fmt.Sprintf("Failed to connect to GitHub: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &db.AuthStatus{
			Authenticated: false,
			ErrorMessage:  fmt.Sprintf("GitHub API returned status %d", resp.StatusCode),
		}, nil
	}

	scopes := resp.Header.Get("X-OAuth-Scopes")

	var user gitHubUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode GitHub user response: %w", err)
	}

	return &db.AuthStatus{
		Authenticated: true,
		Username:      user.Login,
		Name:          user.Name,
		AvatarURL:     user.AvatarURL,
		Scopes:        scopes,
	}, nil
}

// GetStatus checks current authentication status.
func (m *Manager) GetStatus(ctx context.Context) (*db.AuthStatus, error) {
	token, mode, err := m.GetToken(ctx)
	if err != nil {
		return &db.AuthStatus{
			Authenticated: false,
			AuthMode:      mode,
			ErrorMessage:  err.Error(),
		}, nil
	}

	status, err := m.ValidateToken(ctx, token)
	if err != nil {
		return nil, err
	}

	status.AuthMode = mode
	m.mu.Lock()
	m.cached = status
	m.token = token
	m.mu.Unlock()

	return status, nil
}

// SetPAT saves a personal access token and switches auth_mode to 'pat'.
func (m *Manager) SetPAT(ctx context.Context, pat string) (*db.AuthStatus, error) {
	cleanPAT := strings.TrimSpace(pat)
	status, err := m.ValidateToken(ctx, cleanPAT)
	if err != nil {
		return nil, err
	}
	if !status.Authenticated {
		return status, errors.New("invalid personal access token: " + status.ErrorMessage)
	}

	settings, err := m.db.GetSettings()
	if err != nil {
		return nil, err
	}

	settings.AuthMode = "pat"
	settings.PATToken = cleanPAT
	if err := m.db.SaveSettings(settings); err != nil {
		return nil, fmt.Errorf("failed to save settings: %w", err)
	}

	status.AuthMode = "pat"
	m.mu.Lock()
	m.cached = status
	m.token = cleanPAT
	m.mu.Unlock()

	return status, nil
}

// Disconnect clears the custom PAT and reverts to gh CLI mode.
func (m *Manager) Disconnect(ctx context.Context) (*db.AuthStatus, error) {
	settings, err := m.db.GetSettings()
	if err != nil {
		return nil, err
	}

	settings.AuthMode = "gh_cli"
	settings.PATToken = ""
	if err := m.db.SaveSettings(settings); err != nil {
		return nil, fmt.Errorf("failed to save settings: %w", err)
	}

	m.mu.Lock()
	m.cached = nil
	m.token = ""
	m.mu.Unlock()

	return m.GetStatus(ctx)
}
