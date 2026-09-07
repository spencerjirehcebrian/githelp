package worktree

import (
	"os"
	"path/filepath"
	"strings"
)

// Scanner inspects local directory paths for active git workspaces and their branches.
type Scanner struct {
	searchPaths []string
}

// NewScanner creates a worktree scanner with default or specified search paths.
func NewScanner(paths ...string) *Scanner {
	if len(paths) == 0 {
		home, err := os.UserHomeDir()
		if err == nil {
			paths = []string{filepath.Join(home, "git")}
		}
	}
	return &Scanner{searchPaths: paths}
}

// ScanWorktrees inspects the search paths and returns a map of branch_name -> directory_path.
func (s *Scanner) ScanWorktrees() map[string]string {
	results := make(map[string]string)

	for _, basePath := range s.searchPaths {
		entries, err := os.ReadDir(basePath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			repoDir := filepath.Join(basePath, entry.Name())
			gitDir := filepath.Join(repoDir, ".git")

			branch := detectBranch(gitDir)
			if branch != "" && branch != "HEAD" {
				results[branch] = repoDir
			}
		}
	}

	return results
}

// detectBranch reads the current branch name from .git/HEAD.
func detectBranch(gitPath string) string {
	info, err := os.Stat(gitPath)
	if err != nil {
		return ""
	}

	var headFile string
	if info.IsDir() {
		headFile = filepath.Join(gitPath, "HEAD")
	} else {
		// Git worktree file pointer e.g. "gitdir: /path/to/.git/worktrees/name"
		content, err := os.ReadFile(gitPath)
		if err != nil {
			return ""
		}
		line := strings.TrimSpace(string(content))
		if strings.HasPrefix(line, "gitdir:") {
			realGitDir := strings.TrimSpace(strings.TrimPrefix(line, "gitdir:"))
			if !filepath.IsAbs(realGitDir) {
				realGitDir = filepath.Join(filepath.Dir(gitPath), realGitDir)
			}
			headFile = filepath.Join(realGitDir, "HEAD")
		} else {
			return ""
		}
	}

	content, err := os.ReadFile(headFile)
	if err != nil {
		return ""
	}

	headStr := strings.TrimSpace(string(content))
	if strings.HasPrefix(headStr, "ref: refs/heads/") {
		return strings.TrimPrefix(headStr, "ref: refs/heads/")
	}

	return ""
}
