import React, { useState, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
  Terminal,
  RotateCcw,
  GitBranch,
  FolderArchive,
  AlertTriangle,
  GitMerge,
  Info,
  X,
} from 'lucide-react';
import { GIT_RECIPES } from '../lib/gitRecipes';
import { cn, copyToClipboard } from '../lib/utils';

interface GitAssistantViewProps {
  onToast: (msg: string) => void;
  onClose?: () => void;
}

export const GitAssistantView: React.FC<GitAssistantViewProps> = ({ onToast, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Recipes', icon: Terminal },
    { id: 'commits', label: 'Commits & Undo', icon: RotateCcw },
    { id: 'branches', label: 'Branch Workflows', icon: GitBranch },
    { id: 'stash', label: 'Stash & Workspace', icon: FolderArchive },
    { id: 'conflicts', label: 'Merge Conflicts', icon: AlertTriangle },
    { id: 'sync', label: 'Upstream & Rebase', icon: GitMerge },
  ];

  const filteredRecipes = useMemo(() => {
    return GIT_RECIPES.filter((recipe) => {
      const matchesCat = selectedCategory === 'all' || recipe.category === selectedCategory;
      if (!matchesCat) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        recipe.title.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.command.toLowerCase().includes(q) ||
        recipe.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, search]);

  const handleCopy = async (id: string, command: string) => {
    const ok = await copyToClipboard(command);
    if (ok) {
      setCopiedId(id);
      onToast(`Copied: ${command}`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="flex-1 h-full bg-github-dark flex flex-col min-w-0 overflow-hidden select-none">
      {/* Header */}
      <div className="p-6 border-b border-github-border bg-github-darker/60 flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-github-accent/15 border border-github-accent/30 flex items-center justify-center text-github-accent">
              <Terminal className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Git Assistant & Workflow Solver</h2>
          </div>
          <p className="text-xs text-github-muted mt-1 leading-relaxed">
            Instant recipes, emergency fixes, and command solutions for common Git dilemmas.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-github-muted hover:text-white hover:bg-github-hover transition-colors"
            title="Close Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 border-b border-github-border bg-github-dark flex items-center justify-between gap-4 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-github-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problem (e.g. undo, wrong branch, squash)..."
            className="w-full bg-github-darker border border-github-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-github-text placeholder:text-github-muted focus:outline-none focus:border-github-accent focus:ring-1 focus:ring-github-accent transition-all"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto bg-github-darker p-1 rounded-lg border border-github-border">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                  isSelected
                    ? 'bg-github-hover text-white shadow-sm font-semibold'
                    : 'text-github-muted hover:text-github-text'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipe Cards Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredRecipes.length === 0 ? (
          <div className="py-12 text-center text-github-muted text-xs">
            No Git recipes match your search query.
          </div>
        ) : (
          filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="p-4 rounded-xl bg-github-darker border border-github-border hover:border-github-border/80 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-github-text mt-1 leading-relaxed">
                    {recipe.description}
                  </p>
                </div>

                <span className="px-2 py-0.5 rounded uppercase text-[10px] font-mono font-semibold bg-github-hover text-github-muted border border-github-border shrink-0">
                  {recipe.category}
                </span>
              </div>

              {/* Command Code Box */}
              <div className="relative group">
                <pre className="p-3 rounded-lg bg-github-dark border border-github-border/90 text-xs font-mono text-emerald-400 overflow-x-auto select-text">
                  {recipe.command}
                </pre>
                <button
                  onClick={() => handleCopy(recipe.id, recipe.command)}
                  className="absolute right-2 top-2 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-github-text hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
                  title="Copy command"
                >
                  {copiedId === recipe.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Explanation Note */}
              <div className="flex items-start gap-2 text-[11px] text-github-muted bg-github-dark/40 p-2.5 rounded-lg border border-github-border/40 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 text-github-accent mt-0.5" />
                <span>{recipe.explanation}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
