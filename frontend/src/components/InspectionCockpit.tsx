import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  CircleDot,
  CheckCircle2,
  XCircle,
  Clock,
  Pin,
  ExternalLink,
  Archive,
  Copy,
  Check,
  Terminal,
  FileCode2,
  FileDiff as FileDiffIcon,
  Flame,
  AtSign,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Code2,
  Save,
  Tag,
  Users,
} from 'lucide-react';
import type { EnrichedNotification } from '../types';
import { cn, formatTimeAgo, copyToClipboard, parsePRMetadata, generateGitCommands } from '../lib/utils';

interface InspectionCockpitProps {
  item: EnrichedNotification | null;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onToast: (msg: string) => void;
}

type TabType = 'overview' | 'files' | 'git_actions' | 'ci_checks' | 'notes';

export const InspectionCockpit: React.FC<InspectionCockpitProps> = ({
  item,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onUpdateNotes,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [localNotes, setLocalNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  useEffect(() => {
    if (item) {
      setLocalNotes(item.triage?.notes || '');
      setExpandedFiles({});
    }
  }, [item?.id]);

  if (!item) {
    return (
      <section 
        data-testid="inspection-cockpit-empty"
        aria-label="Git and PR Inspection Cockpit"
        className="flex-1 h-full bg-github-dark flex flex-col items-center justify-center p-8 text-center select-none"
      >
        <div className="w-12 h-12 rounded-2xl bg-github-hover border border-github-border flex items-center justify-center text-github-muted mb-4 shadow-sm">
          <Terminal className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">No Notification Selected</h3>
        <p className="text-xs text-github-muted max-w-sm leading-relaxed">
          Select an item from the work stream using <kbd className="px-1.5 py-0.5 bg-github-hover border border-github-border rounded text-[10px] font-mono text-github-text">j</kbd> / <kbd className="px-1.5 py-0.5 bg-github-hover border border-github-border rounded text-[10px] font-mono text-github-text">k</kbd> or click to inspect PR metadata, file diffs, and execute Git commands.
        </p>
      </section>
    );
  }

  const meta = parsePRMetadata(item.raw_data);
  const gitCmds = generateGitCommands(item);

  const handleCopy = async (key: string, text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      onToast(`Copied: ${label}`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const toggleFileExpand = (filename: string) => {
    setExpandedFiles((prev) => ({ ...prev, [filename]: !prev[filename] }));
  };

  const handleSaveNotes = () => {
    if (onUpdateNotes && item) {
      setIsSavingNotes(true);
      onUpdateNotes(item.id, localNotes);
      onToast('Notes saved');
      setTimeout(() => setIsSavingNotes(false), 800);
    }
  };

  const renderStateBadge = () => {
    const s = (item.state || 'open').toLowerCase();
    if (item.type === 'PullRequest') {
      if (s === 'merged') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <GitMerge className="w-3.5 h-3.5" />
            Merged
          </span>
        );
      }
      if (s === 'draft') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            <GitPullRequestDraft className="w-3.5 h-3.5" />
            Draft
          </span>
        );
      }
      if (s === 'closed') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <GitPullRequestClosed className="w-3.5 h-3.5" />
            Closed
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <GitPullRequest className="w-3.5 h-3.5" />
          Open PR
        </span>
      );
    }

    if (item.type === 'Issue') {
      if (s === 'closed') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Closed Issue
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CircleDot className="w-3.5 h-3.5" />
          Open Issue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
        {item.type}
      </span>
    );
  };

  const renderReasonTag = () => {
    const r = (item.reason || '').toLowerCase();
    if (r === 'review_requested') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
          <Flame className="w-3 h-3" />
          Review Requested
        </span>
      );
    }
    if (r === 'mention' || r === 'team_mention') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400">
          <AtSign className="w-3 h-3" />
          Mentioned
        </span>
      );
    }
    if (r === 'assigned') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
          <UserCheck className="w-3 h-3" />
          Assigned
        </span>
      );
    }
    return <span className="text-[11px] text-github-muted">{item.reason}</span>;
  };

  const filesList = meta?.files || [];
  const ciDetails = meta?.ci_details || [];

  return (
    <section 
      data-testid="inspection-cockpit"
      aria-label="Git and PR Inspection Cockpit"
      className="flex-1 h-full bg-github-dark border-l border-github-border flex flex-col min-w-0 overflow-hidden"
    >
      {/* Cockpit Header */}
      <header className="p-4 border-b border-github-border bg-github-darker/60 flex flex-col gap-3 shrink-0">
        {/* Top line: repo, number, state, reason, actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-mono font-medium text-github-accent bg-github-accent/10 px-2 py-0.5 rounded border border-github-accent/20">
              {item.repository}
            </span>
            {item.number ? (
              <span className="text-xs font-mono font-semibold text-white">
                #{item.number}
              </span>
            ) : null}
            {renderStateBadge()}
            {renderReasonTag()}
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleUnread(item.id, item.unread)}
              className="p-1.5 rounded-lg text-github-muted hover:text-github-accent hover:bg-github-accent/10 border border-transparent hover:border-github-accent/20 transition-all"
              title={item.unread ? 'Mark as Read (u)' : 'Mark as Unread (u)'}
            >
              <CircleDot className={cn('w-4 h-4', item.unread && 'text-github-accent')} />
            </button>
            <button
              onClick={() => onMarkDone(item.id)}
              className="p-1.5 rounded-lg text-github-muted hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all"
              title="Mark as Done (e)"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenSnooze(item.id)}
              className="p-1.5 rounded-lg text-github-muted hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
              title="Snooze (z)"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTogglePin(item.id, item.triage?.pinned || false)}
              className={cn(
                'p-1.5 rounded-lg border border-transparent transition-all',
                item.triage?.pinned
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-github-muted hover:text-amber-400 hover:bg-amber-500/10'
              )}
              title={item.triage?.pinned ? 'Unpin (p)' : 'Pin to top (p)'}
            >
              <Pin className={cn('w-4 h-4', item.triage?.pinned && 'fill-amber-400')} />
            </button>
            <a
              href={item.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-github-muted hover:text-white hover:bg-github-hover border border-transparent hover:border-github-border transition-all"
              title="Open in GitHub (o / Enter)"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-white leading-snug tracking-tight">
          {item.title}
        </h2>

        {/* Author metadata & branch info */}
        <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-github-muted pt-0.5 border-t border-github-border/40">
          <div className="flex items-center gap-2">
            {item.author_avatar ? (
              <img
                src={item.author_avatar}
                alt={item.author}
                className="w-5 h-5 rounded-full border border-github-border object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-github-hover flex items-center justify-center font-mono text-[10px] text-github-text">
                {item.author ? item.author.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <span className="text-github-text font-medium">@{item.author}</span>
            <span>updated {formatTimeAgo(item.updated_at)}</span>
          </div>

          {/* Quick branch pill */}
          {item.branch && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy('header-branch', gitCmds.gitCheckout, `git checkout ${item.branch}`)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border border border-github-border font-mono text-[11px] text-github-text transition-colors"
                title="Click to copy checkout command"
              >
                {copiedKey === 'header-branch' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Terminal className="w-3 h-3 text-github-accent" />
                )}
                <span>{item.branch}</span>
              </button>
            </div>
          )}
        </div>

        {/* Git Quick-Action Command Bar */}
        <div className="bg-github-darker p-2 rounded-lg border border-github-border flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-semibold uppercase text-github-muted shrink-0 px-1">
            Git Actions:
          </span>

          {item.branch && (
            <button
              onClick={() => handleCopy('git-checkout', gitCmds.gitCheckout, gitCmds.gitCheckout)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-white transition-colors"
              title="Copy: git checkout <branch>"
            >
              {copiedKey === 'git-checkout' ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3 text-github-accent" />}
              <span>Checkout</span>
            </button>
          )}

          {item.number ? (
            <button
              onClick={() => handleCopy('gh-checkout', gitCmds.ghPrCheckout, gitCmds.ghPrCheckout)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-white transition-colors"
              title="Copy: gh pr checkout <num>"
            >
              {copiedKey === 'gh-checkout' ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3 text-indigo-400" />}
              <span>gh pr checkout</span>
            </button>
          ) : null}

          {item.number ? (
            <button
              onClick={() => handleCopy('gh-diff', gitCmds.ghPrDiff, gitCmds.ghPrDiff)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-white transition-colors"
              title="Copy: gh pr diff <num>"
            >
              {copiedKey === 'gh-diff' ? <Check className="w-3 h-3 text-emerald-400" /> : <FileDiffIcon className="w-3 h-3 text-amber-400" />}
              <span>gh pr diff</span>
            </button>
          ) : null}

          <button
            onClick={() => handleCopy('cursor-link', gitCmds.openCursor, `Cursor open link: ${gitCmds.openCursor}`)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-white transition-colors"
            title="Copy Cursor IDE URI"
          >
            {copiedKey === 'cursor-link' ? <Check className="w-3 h-3 text-emerald-400" /> : <Code2 className="w-3 h-3 text-emerald-400" />}
            <span>Cursor</span>
          </button>

          <button
            onClick={() => handleCopy('vscode-link', gitCmds.openVSCode, `VS Code open link: ${gitCmds.openVSCode}`)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-github-hover hover:bg-github-border border border-github-border text-xs font-mono text-white transition-colors"
            title="Copy VS Code URI"
          >
            {copiedKey === 'vscode-link' ? <Check className="w-3 h-3 text-emerald-400" /> : <FileCode2 className="w-3 h-3 text-blue-400" />}
            <span>VS Code</span>
          </button>
        </div>
      </header>

      {/* Cockpit Navigation Tabs */}
      <nav aria-label="Cockpit Tabs" className="px-4 bg-github-darker/40 border-b border-github-border flex items-center gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
            activeTab === 'overview'
              ? 'border-github-accent text-white font-semibold'
              : 'border-transparent text-github-muted hover:text-github-text'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        {filesList.length > 0 && (
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
              activeTab === 'files'
                ? 'border-github-accent text-white font-semibold'
                : 'border-transparent text-github-muted hover:text-github-text'
            )}
          >
            <FileDiffIcon className="w-3.5 h-3.5" />
            <span>Files Changed</span>
            <span className="px-1.5 py-0.2 bg-github-hover text-[10px] font-mono rounded-full text-github-text">
              {filesList.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('git_actions')}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
            activeTab === 'git_actions'
              ? 'border-github-accent text-white font-semibold'
              : 'border-transparent text-github-muted hover:text-github-text'
          )}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Git Recipes</span>
        </button>

        {ciDetails.length > 0 && (
          <button
            onClick={() => setActiveTab('ci_checks')}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
              activeTab === 'ci_checks'
                ? 'border-github-accent text-white font-semibold'
                : 'border-transparent text-github-muted hover:text-github-text'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>CI Checks</span>
            <span className="px-1.5 py-0.2 bg-github-hover text-[10px] font-mono rounded-full text-github-text">
              {ciDetails.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
            activeTab === 'notes'
              ? 'border-github-accent text-white font-semibold'
              : 'border-transparent text-github-muted hover:text-github-text'
          )}
        >
          <Save className="w-3.5 h-3.5" />
          <span>Notes</span>
          {localNotes && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      </nav>

      {/* Cockpit Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Diff stats banner */}
            {(meta?.additions !== undefined || meta?.deletions !== undefined || meta?.changed_files !== undefined) && (
              <div className="flex items-center gap-4 p-3 bg-github-darker rounded-xl border border-github-border text-xs font-mono">
                {meta.changed_files !== undefined && (
                  <div>
                    <span className="text-github-muted">Files: </span>
                    <span className="font-semibold text-white">{meta.changed_files}</span>
                  </div>
                )}
                {meta.additions !== undefined && (
                  <div className="text-emerald-400 font-semibold">
                    +{meta.additions}
                  </div>
                )}
                {meta.deletions !== undefined && (
                  <div className="text-rose-400 font-semibold">
                    -{meta.deletions}
                  </div>
                )}
                {meta.comments_count !== undefined && (
                  <div className="text-github-muted ml-auto">
                    {meta.comments_count} {meta.comments_count === 1 ? 'comment' : 'comments'}
                  </div>
                )}
              </div>
            )}

            {/* Labels */}
            {meta?.labels && meta.labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-github-muted" />
                {meta.labels.map((lbl) => (
                  <span
                    key={lbl.name}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-full border border-github-border"
                    style={{
                      backgroundColor: `#${lbl.color}22`,
                      color: `#${lbl.color}`,
                      borderColor: `#${lbl.color}44`,
                    }}
                  >
                    {lbl.name}
                  </span>
                ))}
              </div>
            )}

            {/* Reviewers & Assignees */}
            {(meta?.reviewers?.length || meta?.assignees?.length) ? (
              <div className="flex items-center gap-4 p-3 bg-github-darker rounded-lg border border-github-border text-xs">
                <Users className="w-4 h-4 text-github-muted shrink-0" />
                {meta.reviewers && meta.reviewers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-github-muted">Reviewers:</span>
                    {meta.reviewers.map((r) => (
                      <span key={r.login} className="text-github-text font-medium bg-github-hover px-1.5 py-0.5 rounded border border-github-border">
                        @{r.login}
                      </span>
                    ))}
                  </div>
                )}
                {meta.assignees && meta.assignees.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-github-muted">Assignees:</span>
                    {meta.assignees.map((a) => (
                      <span key={a.login} className="text-github-text font-medium bg-github-hover px-1.5 py-0.5 rounded border border-github-border">
                        @{a.login}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Description Body */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-github-muted">
                Description
              </div>
              {meta?.body ? (
                <div className="p-4 bg-github-darker rounded-xl border border-github-border text-xs text-github-text leading-relaxed whitespace-pre-wrap font-sans space-y-2">
                  {meta.body}
                </div>
              ) : (
                <div className="p-4 bg-github-darker/60 rounded-xl border border-github-border/60 text-xs text-github-muted italic">
                  No description provided for this item.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FILES & DIFF */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                {filesList.length} Changed {filesList.length === 1 ? 'File' : 'Files'}
              </span>
              <button
                onClick={() => handleCopy('tab-gh-diff', gitCmds.ghPrDiff, gitCmds.ghPrDiff)}
                className="text-[11px] text-github-accent hover:underline font-mono flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                Copy gh pr diff
              </button>
            </div>

            <div className="space-y-2">
              {filesList.map((file) => {
                const isExpanded = expandedFiles[file.filename];
                return (
                  <div
                    key={file.filename}
                    className="border border-github-border rounded-xl bg-github-darker overflow-hidden"
                  >
                    <div
                      onClick={() => toggleFileExpand(file.filename)}
                      className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-github-hover/60 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs text-white truncate min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-github-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-github-muted shrink-0" />
                        )}
                        <FileCode2 className="w-3.5 h-3.5 text-github-accent shrink-0" />
                        <span className="truncate">{file.filename}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                        {file.status && (
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded uppercase text-[9px] font-semibold border',
                              file.status === 'added'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : file.status === 'deleted'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            )}
                          >
                            {file.status}
                          </span>
                        )}
                        <span className="text-emerald-400 font-semibold">+{file.additions}</span>
                        <span className="text-rose-400 font-semibold">-{file.deletions}</span>
                      </div>
                    </div>

                    {/* Diff snippet */}
                    {isExpanded && file.patch && (
                      <div className="p-3 border-t border-github-border bg-github-dark text-[11px] font-mono overflow-x-auto leading-relaxed">
                        {file.patch.split('\n').map((line, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'px-2 py-0.5 whitespace-pre',
                              line.startsWith('+')
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : line.startsWith('-')
                                ? 'bg-rose-500/10 text-rose-300'
                                : line.startsWith('@@')
                                ? 'text-github-muted bg-github-hover/40'
                                : 'text-github-text'
                            )}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: GIT ACTIONS & RECIPES */}
        {activeTab === 'git_actions' && (
          <div className="space-y-3">
            <div className="text-xs text-github-muted">
              Pre-configured Git commands specifically formatted for this branch and PR:
            </div>

            <div className="space-y-2.5">
              {/* Recipe 1: Checkout branch */}
              <div className="p-3 rounded-xl bg-github-darker border border-github-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">1. Checkout & Switch to Branch</span>
                  <button
                    onClick={() => handleCopy('recipe-co', gitCmds.gitCheckout, gitCmds.gitCheckout)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border text-xs font-mono text-github-accent transition-colors"
                  >
                    {copiedKey === 'recipe-co' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-2 rounded bg-github-dark border border-github-border/80 text-xs font-mono text-github-text overflow-x-auto">
                  {gitCmds.gitCheckout}
                </pre>
              </div>

              {/* Recipe 2: GitHub CLI Checkout */}
              {item.number ? (
                <div className="p-3 rounded-xl bg-github-darker border border-github-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">2. GitHub CLI One-Step Checkout</span>
                    <button
                      onClick={() => handleCopy('recipe-gh-co', gitCmds.ghPrCheckout, gitCmds.ghPrCheckout)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border text-xs font-mono text-github-accent transition-colors"
                    >
                      {copiedKey === 'recipe-gh-co' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-github-dark border border-github-border/80 text-xs font-mono text-github-text overflow-x-auto">
                    {gitCmds.ghPrCheckout}
                  </pre>
                </div>
              ) : null}

              {/* Recipe 3: Quick Approve */}
              {item.number && gitCmds.ghPrApprove ? (
                <div className="p-3 rounded-xl bg-github-darker border border-github-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">3. Fast Approve via gh CLI</span>
                    <button
                      onClick={() => handleCopy('recipe-approve', gitCmds.ghPrApprove, gitCmds.ghPrApprove)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border text-xs font-mono text-emerald-400 transition-colors"
                    >
                      {copiedKey === 'recipe-approve' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-github-dark border border-github-border/80 text-xs font-mono text-github-text overflow-x-auto">
                    {gitCmds.ghPrApprove}
                  </pre>
                </div>
              ) : null}

              {/* Recipe 4: Quick Squash & Merge */}
              {item.number && gitCmds.ghPrMerge ? (
                <div className="p-3 rounded-xl bg-github-darker border border-github-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">4. Squash & Merge PR</span>
                    <button
                      onClick={() => handleCopy('recipe-merge', gitCmds.ghPrMerge, gitCmds.ghPrMerge)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border text-xs font-mono text-purple-400 transition-colors"
                    >
                      {copiedKey === 'recipe-merge' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-github-dark border border-github-border/80 text-xs font-mono text-github-text overflow-x-auto">
                    {gitCmds.ghPrMerge}
                  </pre>
                </div>
              ) : null}

              {/* Recipe 5: Apply Patch */}
              {item.number && gitCmds.gitApplyPatch ? (
                <div className="p-3 rounded-xl bg-github-darker border border-github-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">5. Apply PR Patch Locally</span>
                    <button
                      onClick={() => handleCopy('recipe-patch', gitCmds.gitApplyPatch, gitCmds.gitApplyPatch)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-hover hover:bg-github-border text-xs font-mono text-amber-400 transition-colors"
                    >
                      {copiedKey === 'recipe-patch' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-github-dark border border-github-border/80 text-xs font-mono text-github-text overflow-x-auto">
                    {gitCmds.gitApplyPatch}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 4: CI DIAGNOSTICS */}
        {activeTab === 'ci_checks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                CI Check Runs
              </span>
              <button
                onClick={() => handleCopy('ci-rerun', `gh run rerun`, 'gh run rerun')}
                className="text-[11px] text-github-accent hover:underline font-mono flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                gh run rerun
              </button>
            </div>

            <div className="space-y-2">
              {ciDetails.map((ci, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-github-darker border border-github-border flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="pt-0.5">
                      {ci.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : ci.status === 'failure' || ci.status === 'error' ? (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {ci.name}
                      </div>
                      {ci.description && (
                        <div className="text-[11px] text-github-muted leading-relaxed mt-0.5">
                          {ci.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold shrink-0 border',
                      ci.status === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : ci.status === 'failure'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    )}
                  >
                    {ci.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: LOCAL NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                Developer Notes & Scratchpad
              </span>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="flex items-center gap-1.5 px-3 py-1 bg-github-accent hover:bg-github-accent/80 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>

            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Write your private review notes, TODOs, or checklist for this PR..."
              rows={8}
              className="w-full bg-github-darker border border-github-border rounded-xl p-3 text-xs text-white placeholder:text-github-muted focus:outline-none focus:border-github-accent focus:ring-1 focus:ring-github-accent font-sans leading-relaxed transition-all"
            />
          </div>
        )}
      </div>
    </section>
  );
};
