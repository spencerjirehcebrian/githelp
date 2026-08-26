import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Terminal,
  ExternalLink,
  Archive,
  Clock,
  RotateCw,
  Sun,
  Moon,
  Settings,
  Keyboard,
  FileDiff,
  Flame,
  Code2,
  Star,
  CheckSquare,
} from 'lucide-react';
import type { EnrichedNotification, BucketType } from '../types';
import { cn, copyToClipboard, generateGitCommands } from '../lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: EnrichedNotification | null;
  onSelectBucket: (bucket: BucketType) => void;
  onSelectRepo: (repo: string) => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onSync: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onToggleTheme: () => void;
  currentTheme: 'dark' | 'light' | 'system';
  onToast: (msg: string) => void;
}

interface PaletteCommand {
  id: string;
  category: 'Task Actions' | 'Navigation' | 'System';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  selectedItem,
  onSelectBucket,
  onSelectRepo,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onSync,
  onOpenSettings,
  onOpenShortcuts,
  onToggleTheme,
  currentTheme,
  onToast,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];

    // 1. Current Task Actions
    if (selectedItem) {
      const gitCmds = generateGitCommands(selectedItem);
      const isPinned = selectedItem.triage?.pinned || false;
      const isDone = selectedItem.triage?.status === 'done';

      list.push({
        id: 'item-complete',
        category: 'Task Actions',
        title: isDone ? 'Mark task as incomplete' : 'Complete Task',
        shortcut: 'Space / e',
        icon: CheckSquare,
        perform: () => {
          onMarkDone(selectedItem.id);
        },
      });

      list.push({
        id: 'item-focus-pin',
        category: 'Task Actions',
        title: isPinned ? "Remove from Today's Focus" : "Pin to Today's Focus",
        shortcut: 't',
        icon: Star,
        perform: () => {
          onTogglePin(selectedItem.id, isPinned);
        },
      });

      if (selectedItem.branch) {
        list.push({
          id: 'item-checkout',
          category: 'Task Actions',
          title: `Checkout branch: ${selectedItem.branch}`,
          subtitle: gitCmds.gitCheckout,
          shortcut: 'c',
          icon: Terminal,
          perform: async () => {
            await copyToClipboard(gitCmds.gitCheckout);
            onToast(`Copied: ${gitCmds.gitCheckout}`);
          },
        });
      }

      if (selectedItem.number) {
        list.push({
          id: 'item-gh-checkout',
          category: 'Task Actions',
          title: `Checkout PR with gh CLI: #${selectedItem.number}`,
          subtitle: gitCmds.ghPrCheckout,
          icon: Terminal,
          perform: async () => {
            await copyToClipboard(gitCmds.ghPrCheckout);
            onToast(`Copied: ${gitCmds.ghPrCheckout}`);
          },
        });

        list.push({
          id: 'item-gh-diff',
          category: 'Task Actions',
          title: `Copy gh pr diff command for #${selectedItem.number}`,
          subtitle: gitCmds.ghPrDiff,
          shortcut: 'd',
          icon: FileDiff,
          perform: async () => {
            await copyToClipboard(gitCmds.ghPrDiff);
            onToast(`Copied: ${gitCmds.ghPrDiff}`);
          },
        });
      }

      list.push({
        id: 'item-browser',
        category: 'Task Actions',
        title: `Open "${selectedItem.title}" in GitHub`,
        subtitle: selectedItem.html_url,
        shortcut: 'Enter',
        icon: ExternalLink,
        perform: () => {
          if (selectedItem.html_url) window.open(selectedItem.html_url, '_blank');
        },
      });

      list.push({
        id: 'item-cursor',
        category: 'Task Actions',
        title: 'Open repository in Cursor IDE',
        subtitle: gitCmds.openCursor,
        icon: Code2,
        perform: async () => {
          await copyToClipboard(gitCmds.openCursor);
          onToast('Copied Cursor URI');
        },
      });

      list.push({
        id: 'item-snooze',
        category: 'Task Actions',
        title: 'Snooze task...',
        shortcut: 'z',
        icon: Clock,
        perform: () => {
          onOpenSnooze(selectedItem.id);
        },
      });
    }

    // 2. Navigation
    list.push({
      id: 'nav-active-tasks',
      category: 'Navigation',
      title: 'Go to Active Tasks Queue',
      icon: Flame,
      perform: () => {
        onSelectBucket('action_required');
        onSelectRepo('');
      },
    });

    list.push({
      id: 'nav-snoozed',
      category: 'Navigation',
      title: 'Go to Snoozed Tasks',
      icon: Clock,
      perform: () => {
        onSelectBucket('snoozed');
        onSelectRepo('');
      },
    });

    list.push({
      id: 'nav-done',
      category: 'Navigation',
      title: 'Go to Completed Archive',
      icon: Archive,
      perform: () => {
        onSelectBucket('done');
        onSelectRepo('');
      },
    });

    // 3. System
    list.push({
      id: 'sys-sync',
      category: 'System',
      title: 'Sync tasks from GitHub',
      shortcut: 'r',
      icon: RotateCw,
      perform: () => {
        onSync();
      },
    });

    list.push({
      id: 'sys-theme',
      category: 'System',
      title: currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      icon: currentTheme === 'dark' ? Sun : Moon,
      perform: () => {
        onToggleTheme();
      },
    });

    list.push({
      id: 'sys-settings',
      category: 'System',
      title: 'Open Preferences & Settings',
      shortcut: 's',
      icon: Settings,
      perform: () => {
        onOpenSettings();
      },
    });

    list.push({
      id: 'sys-shortcuts',
      category: 'System',
      title: 'View Keyboard Shortcuts',
      shortcut: '?',
      icon: Keyboard,
      perform: () => {
        onOpenShortcuts();
      },
    });

    return list;
  }, [
    selectedItem,
    currentTheme,
    onMarkDone,
    onOpenSnooze,
    onTogglePin,
    onSelectBucket,
    onSelectRepo,
    onSync,
    onToggleTheme,
    onOpenSettings,
    onOpenShortcuts,
    onToast,
  ]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredCommands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        filteredCommands[activeIndex].perform();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4 animate-fade-in text-github-text">
      <div
        className="w-full max-w-xl bg-black border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3 border-b border-zinc-900 flex items-center gap-2.5 bg-zinc-950">
          <Search className="w-4 h-4 text-zinc-500 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions... (Esc to exit)"
            className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.2 text-[9px] font-mono text-zinc-500 bg-black border border-zinc-800 rounded">
            Esc
          </kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No commands found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = activeIndex === idx;

              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.perform();
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-colors select-none group',
                    isSelected
                      ? 'bg-zinc-900 border border-zinc-800 text-white'
                      : 'text-zinc-300 hover:bg-zinc-900/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-6 h-6 rounded flex items-center justify-center shrink-0 border transition-colors',
                        isSelected
                          ? 'bg-black border-zinc-700 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-zinc-200 truncate">
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.2">
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[9px] uppercase font-mono text-zinc-500 px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.2 text-[9px] font-mono text-zinc-400 bg-black border border-zinc-800 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-3.5 py-2 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span>Navigate:</span>
            <kbd className="px-1 py-0.2 bg-black border border-zinc-800 rounded text-[9px] font-mono">↑</kbd>
            <kbd className="px-1 py-0.2 bg-black border border-zinc-800 rounded text-[9px] font-mono">↓</kbd>
            <span className="ml-1">Execute:</span>
            <kbd className="px-1 py-0.2 bg-black border border-zinc-800 rounded text-[9px] font-mono">Enter</kbd>
          </div>
          <span>Command Palette</span>
        </div>
      </div>
    </div>
  );
};
