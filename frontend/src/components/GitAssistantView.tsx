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
    <div className="flex-1 h-full bg-black flex flex-col min-w-0 overflow-hidden select-none text-github-text">
      {/* Header */}
      <div className="p-4 border-b border-github-border bg-black/70 flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Git Assistant & Workflow Solver</h2>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
            Instant recipes, emergency fixes, and command solutions for common Git dilemmas.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 border-b border-github-border bg-black/40 flex items-center justify-between gap-3 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problem (e.g. undo, wrong branch, squash)..."
            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-0.5 overflow-x-auto bg-zinc-900/60 p-0.5 rounded-md border border-zinc-800">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap',
                  isSelected
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipe Cards Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredRecipes.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No Git recipes match your search query.
          </div>
        ) : (
          filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="p-3.5 rounded-md bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">
                    {recipe.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    {recipe.description}
                  </p>
                </div>

                <span className="px-1.5 py-0.2 rounded uppercase text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 shrink-0">
                  {recipe.category}
                </span>
              </div>

              {/* Command Code Box */}
              <div className="relative group">
                <pre className="p-2.5 rounded bg-black border border-zinc-900 text-xs font-mono text-emerald-400 overflow-x-auto select-text">
                  {recipe.command}
                </pre>
                <button
                  onClick={() => handleCopy(recipe.id, recipe.command)}
                  className="absolute right-2 top-2 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                  title="Copy command"
                >
                  {copiedId === recipe.id ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Explanation Note */}
              <div className="flex items-start gap-2 text-[11px] text-zinc-500 bg-black/30 p-2 rounded border border-zinc-900 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 text-zinc-400 mt-0.5" />
                <span>{recipe.explanation}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

