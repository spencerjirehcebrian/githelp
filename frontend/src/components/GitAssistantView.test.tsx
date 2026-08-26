import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GitAssistantView } from './GitAssistantView';

describe('components/GitAssistantView', () => {
  it('renders heading and default recipes', () => {
    render(<GitAssistantView onToast={vi.fn()} />);

    expect(screen.getByText('Git Assistant & Workflow Solver')).toBeInTheDocument();
    expect(screen.getByText('Undo last commit (keep changes staged/modified)')).toBeInTheDocument();
    expect(screen.getByText('git reset --soft HEAD~1')).toBeInTheDocument();
  });

  it('filters recipes by search query', () => {
    render(<GitAssistantView onToast={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Search problem/i);
    fireEvent.change(searchInput, { target: { value: 'rebase' } });

    expect(screen.getByText('Rebase current branch on top of latest main')).toBeInTheDocument();
    expect(screen.queryByText('Undo last commit and discard all changes permanently')).not.toBeInTheDocument();
  });

  it('filters recipes by category', () => {
    render(<GitAssistantView onToast={vi.fn()} />);

    const stashCategoryBtn = screen.getByRole('button', { name: /Stash & Workspace/i });
    fireEvent.click(stashCategoryBtn);

    expect(screen.getByText('Stash all tracked AND untracked / new files')).toBeInTheDocument();
    expect(screen.queryByText('Undo last commit (keep changes staged/modified)')).not.toBeInTheDocument();
  });
});
