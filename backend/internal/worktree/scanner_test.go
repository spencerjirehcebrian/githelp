package worktree

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorktreeScanner(t *testing.T) {
	tempDir := t.TempDir()

	// Create mock git repo 1
	repo1 := filepath.Join(tempDir, "repo-main")
	git1 := filepath.Join(repo1, ".git")
	_ = os.MkdirAll(git1, 0755)
	_ = os.WriteFile(filepath.Join(git1, "HEAD"), []byte("ref: refs/heads/main\n"), 0644)

	// Create mock git repo 2
	repo2 := filepath.Join(tempDir, "repo-feature")
	git2 := filepath.Join(repo2, ".git")
	_ = os.MkdirAll(git2, 0755)
	_ = os.WriteFile(filepath.Join(git2, "HEAD"), []byte("ref: refs/heads/feature-branch\n"), 0644)

	// Create mock git worktree with relative gitdir pointer
	repo3 := filepath.Join(tempDir, "repo-worktree")
	_ = os.MkdirAll(repo3, 0755)
	wtGitDir := filepath.Join(git1, "worktrees", "wt-3")
	_ = os.MkdirAll(wtGitDir, 0755)
	_ = os.WriteFile(filepath.Join(wtGitDir, "HEAD"), []byte("ref: refs/heads/worktree-branch\n"), 0644)
	_ = os.WriteFile(filepath.Join(repo3, ".git"), []byte("gitdir: ../repo-main/.git/worktrees/wt-3\n"), 0644)

	scanner := NewScanner(tempDir)
	branches := scanner.ScanWorktrees()

	if branches["main"] != repo1 {
		t.Errorf("expected main -> %s, got %s", repo1, branches["main"])
	}
	if branches["feature-branch"] != repo2 {
		t.Errorf("expected feature-branch -> %s, got %s", repo2, branches["feature-branch"])
	}
	if branches["worktree-branch"] != repo3 {
		t.Errorf("expected worktree-branch -> %s, got %s", repo3, branches["worktree-branch"])
	}
}
