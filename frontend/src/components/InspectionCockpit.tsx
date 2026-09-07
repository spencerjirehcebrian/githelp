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
  FolderGit2,
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

type TabType = 'overview' | 'files' | 'ci_checks' | 'notes';

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
        <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-sm">
          <Terminal className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-medium text-zinc-200 mb-1">No Notification Selected</h3>
        <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
          Select an item from the triage list with <kbd className="px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-300">j</kbd> / <kbd className="px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-300">k</kbd> to inspect PR metadata, file diffs, and Git commands.
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
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-950/40 text-purple-300 border border-purple-800/40">
            <GitMerge className="w-3 h-3" />
            Merged
          </span>
        );
      }
      if (s === 'draft') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
            <GitPullRequestDraft className="w-3 h-3" />
            Draft
          </span>
        );
      }
      if (s === 'closed') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-950/40 text-rose-300 border border-rose-800/40">
            <GitPullRequestClosed className="w-3 h-3" />
            Closed
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
          <GitPullRequest className="w-3 h-3" />
          Open PR
        </span>
      );
    }

    if (item.type === 'Issue') {
      if (s === 'closed') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-950/40 text-purple-300 border border-purple-800/40">
            <CheckCircle2 className="w-3 h-3" />
            Closed Issue
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
          <CircleDot className="w-3 h-3" />
          Open Issue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-950/40 text-blue-300 border border-blue-800/40">
        {item.type}
      </span>
    );
  };

  const renderReasonTag = () => {
    const r = (item.reason || '').toLowerCase();
    if (r === 'review_requested') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
          <Flame className="w-2.5 h-2.5" />
          Review Requested
        </span>
      );
    }
    if (r === 'mention' || r === 'team_mention') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-400">
          <AtSign className="w-2.5 h-2.5" />
          Mentioned
        </span>
      );
    }
    if (r === 'assigned') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
          <UserCheck className="w-2.5 h-2.5" />
          Assigned
        </span>
      );
    }
    return <span className="text-[10px] text-zinc-500">{item.reason}</span>;
  };

  const filesList = meta?.files || [];
  const ciDetails = meta?.ci_details || [];

  return (
    <section 
      data-testid="inspection-cockpit"
      aria-label="Git and PR Inspection Cockpit"
      className="flex-1 h-full bg-github-dark border-l border-github-border flex flex-col min-w-0 overflow-hidden text-github-text"
    >
      {/* Cockpit Header */}
      <header className="p-3.5 border-b border-github-border bg-black/60 flex flex-col gap-2.5 shrink-0">
        {/* Top line: repo, number, state, reason, actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] font-mono font-medium text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              {item.repository}
            </span>
            {item.number ? (
              <span className="text-[11px] font-mono font-semibold text-white">
                #{item.number}
              </span>
            ) : null}
            {renderStateBadge()}
            {renderReasonTag()}
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onToggleUnread(item.id, item.unread)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              title={item.unread ? 'Mark as Read (u)' : 'Mark as Unread (u)'}
            >
              <CircleDot className={cn('w-3.5 h-3.5', item.unread && 'text-blue-400')} />
            </button>
            <button
              onClick={() => onMarkDone(item.id)}
              className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition-colors"
              title="Mark as Done (e)"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenSnooze(item.id)}
              className="p-1 rounded text-zinc-400 hover:text-indigo-400 hover:bg-zinc-900 transition-colors"
              title="Snooze (z)"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onTogglePin(item.id, item.triage?.pinned || false)}
              className={cn(
                'p-1 rounded transition-colors',
                item.triage?.pinned
                  ? 'text-amber-400 bg-zinc-900'
                  : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-900'
              )}
              title={item.triage?.pinned ? 'Unpin (p)' : 'Pin to top (p)'}
            >
              <Pin className={cn('w-3.5 h-3.5', item.triage?.pinned && 'fill-amber-400')} />
            </button>
            <a
              href={item.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              title="Open in GitHub (o / Enter)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold text-white leading-snug tracking-tight">
          {item.title}
        </h2>

        {/* Author metadata & branch info */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] text-zinc-500 pt-1 border-t border-zinc-900">
          <div className="flex items-center gap-1.5">
            {item.author_avatar ? (
              <img
                src={item.author_avatar}
                alt={item.author}
                className="w-4 h-4 rounded-full border border-zinc-800 object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center font-mono text-[9px] text-zinc-400">
                {item.author ? item.author.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <span className="text-zinc-300 font-medium">@{item.author}</span>
            <span>updated {formatTimeAgo(item.updated_at)}</span>
          </div>

          {/* Quick branch pill */}
          {item.branch && (
            <button
              onClick={() => handleCopy('header-branch', gitCmds.gitCheckout, `git checkout ${item.branch}`)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-mono text-[10px] text-zinc-300 transition-colors"
              title="Click to copy checkout command"
            >
              {copiedKey === 'header-branch' ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Terminal className="w-2.5 h-2.5 text-zinc-400" />
              )}
              <span>{item.branch}</span>
            </button>
          )}
        </div>

        {/* Local Worktree Location Banner */}
        {item.local_worktree_path && (
          <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-zinc-300 truncate">
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-zinc-500 shrink-0">Local Worktree:</span>
              <span className="text-blue-400 font-semibold truncate">{item.local_worktree_path}</span>
            </div>
            <button
              onClick={() => handleCopy('local-worktree', item.local_worktree_path!, 'Worktree Path')}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] shrink-0"
            >
              {copiedKey === 'local-worktree' ? <Check className="w-2.5 h-2.5 text-emerald-400 inline mr-1" /> : null}
              Copy Path
            </button>
          </div>
        )}

        {/* Review Roster & Ball-in-Court Card */}
        {((item.approvers && item.approvers.length > 0) ||
          (item.pending_reviewers && item.pending_reviewers.length > 0) ||
          (item.changes_requested_by && item.changes_requested_by.length > 0)) && (
          <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Review Status</span>
              {item.ball_in_court && item.ball_in_court !== 'none' && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium border',
                    item.ball_in_court === 'you'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                      : 'bg-blue-950/30 text-blue-300 border-blue-800/30'
                  )}
                >
                  {item.ball_in_court === 'you' ? 'Action Required on You' : 'Waiting on Reviewers'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              {item.approvers?.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                  <Check className="w-3 h-3 text-emerald-400" /> Approved by @{a}
                </span>
              ))}
              {item.pending_reviewers?.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40">
                  <Clock className="w-3 h-3 text-amber-400" /> Pending review from @{r}
                </span>
              ))}
              {item.changes_requested_by?.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40">
                  <XCircle className="w-3 h-3 text-rose-400" /> Changes requested by @{c}
                </span>
              ))}
            </div>
            {item.latest_comment_author && (
              <div className="mt-1 pt-1.5 border-t border-zinc-800/50 text-[11px] text-zinc-400">
                <span className="text-zinc-500">Latest review comment by @{item.latest_comment_author}:</span>
                <p className="font-mono text-zinc-300 mt-0.5 line-clamp-2">{item.latest_comment_body}</p>
              </div>
            )}
          </div>
        )}

        {/* Git Quick-Action Command Bar */}
        <div className="bg-black/50 p-1.5 rounded-md border border-zinc-900 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-zinc-500 shrink-0 px-1">
            Git:
          </span>

          {item.branch && (
            <button
              onClick={() => handleCopy('git-checkout', gitCmds.gitCheckout, gitCmds.gitCheckout)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
              title="Copy: git checkout <branch>"
            >
              {copiedKey === 'git-checkout' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Terminal className="w-2.5 h-2.5 text-zinc-400" />}
              <span>Checkout</span>
            </button>
          )}

          {item.number ? (
            <button
              onClick={() => handleCopy('gh-checkout', gitCmds.ghPrCheckout, gitCmds.ghPrCheckout)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
              title="Copy: gh pr checkout <num>"
            >
              {copiedKey === 'gh-checkout' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Terminal className="w-2.5 h-2.5 text-zinc-400" />}
              <span>gh pr checkout</span>
            </button>
          ) : null}

          {item.number ? (
            <button
              onClick={() => handleCopy('gh-diff', gitCmds.ghPrDiff, gitCmds.ghPrDiff)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
              title="Copy: gh pr diff <num>"
            >
              {copiedKey === 'gh-diff' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <FileDiffIcon className="w-2.5 h-2.5 text-zinc-400" />}
              <span>gh pr diff</span>
            </button>
          ) : null}

          <button
            onClick={() => handleCopy('cursor-link', gitCmds.openCursor, `Cursor open link: ${gitCmds.openCursor}`)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
            title="Copy Cursor IDE URI"
          >
            {copiedKey === 'cursor-link' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Code2 className="w-2.5 h-2.5 text-zinc-400" />}
            <span>Cursor</span>
          </button>

          <button
            onClick={() => handleCopy('vscode-link', gitCmds.openVSCode, `VS Code open link: ${gitCmds.openVSCode}`)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
            title="Copy VS Code URI"
          >
            {copiedKey === 'vscode-link' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <FileCode2 className="w-2.5 h-2.5 text-zinc-400" />}
            <span>VS Code</span>
          </button>
        </div>
      </header>

      {/* Cockpit Navigation Tabs */}
      <nav aria-label="Cockpit Tabs" className="px-3 bg-black border-b border-github-border flex items-center gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium border-b transition-colors flex items-center gap-1.5',
            activeTab === 'overview'
              ? 'border-zinc-200 text-white font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        {filesList.length > 0 && (
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium border-b transition-colors flex items-center gap-1.5',
              activeTab === 'files'
                ? 'border-zinc-200 text-white font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <FileDiffIcon className="w-3.5 h-3.5" />
            <span>Files Changed</span>
            <span className="px-1 py-0.2 bg-zinc-900 text-[9px] font-mono rounded text-zinc-400 border border-zinc-800">
              {filesList.length}
            </span>
          </button>
        )}


        {ciDetails.length > 0 && (
          <button
            onClick={() => setActiveTab('ci_checks')}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium border-b transition-colors flex items-center gap-1.5',
              activeTab === 'ci_checks'
                ? 'border-zinc-200 text-white font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>CI Checks</span>
            <span className="px-1 py-0.2 bg-zinc-900 text-[9px] font-mono rounded text-zinc-400 border border-zinc-800">
              {ciDetails.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium border-b transition-colors flex items-center gap-1.5',
            activeTab === 'notes'
              ? 'border-zinc-200 text-white font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
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
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Diff stats banner */}
            {(meta?.additions !== undefined || meta?.deletions !== undefined || meta?.changed_files !== undefined) && (
              <div className="flex items-center gap-3 p-2.5 bg-zinc-950 rounded-md border border-zinc-900 text-[11px] font-mono">
                {meta.changed_files !== undefined && (
                  <div>
                    <span className="text-zinc-500">Files: </span>
                    <span className="font-semibold text-zinc-200">{meta.changed_files}</span>
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
                  <div className="text-zinc-500 ml-auto">
                    {meta.comments_count} {meta.comments_count === 1 ? 'comment' : 'comments'}
                  </div>
                )}
              </div>
            )}

            {/* Labels */}
            {meta?.labels && meta.labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3 h-3 text-zinc-500" />
                {meta.labels.map((lbl) => (
                  <span
                    key={lbl.name}
                    className="px-1.5 py-0.2 text-[10px] font-medium rounded border border-zinc-800"
                    style={{
                      backgroundColor: `#${lbl.color}15`,
                      color: `#${lbl.color}`,
                      borderColor: `#${lbl.color}30`,
                    }}
                  >
                    {lbl.name}
                  </span>
                ))}
              </div>
            )}

            {/* Reviewers & Assignees */}
            {(meta?.reviewers?.length || meta?.assignees?.length) ? (
              <div className="flex items-center gap-3 p-2.5 bg-zinc-950 rounded-md border border-zinc-900 text-xs">
                <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                {meta.reviewers && meta.reviewers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-500 text-[11px]">Reviewers:</span>
                    {meta.reviewers.map((r) => (
                      <span key={r.login} className="text-zinc-300 font-mono text-[11px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        @{r.login}
                      </span>
                    ))}
                  </div>
                )}
                {meta.assignees && meta.assignees.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-500 text-[11px]">Assignees:</span>
                    {meta.assignees.map((a) => (
                      <span key={a.login} className="text-zinc-300 font-mono text-[11px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        @{a.login}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Description Body */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Description
              </div>
              {meta?.body ? (
                <div className="p-3 bg-zinc-950 rounded-md border border-zinc-900 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {meta.body}
                </div>
              ) : (
                <div className="p-3 bg-zinc-950/60 rounded-md border border-zinc-900/60 text-xs text-zinc-600 italic">
                  No description provided for this item.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FILES & DIFF */}
        {activeTab === 'files' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                {filesList.length} Changed {filesList.length === 1 ? 'File' : 'Files'}
              </span>
              <button
                onClick={() => handleCopy('tab-gh-diff', gitCmds.ghPrDiff, gitCmds.ghPrDiff)}
                className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                Copy gh pr diff
              </button>
            </div>

            <div className="space-y-1.5">
              {filesList.map((file) => {
                const isExpanded = expandedFiles[file.filename];
                return (
                  <div
                    key={file.filename}
                    className="border border-zinc-900 rounded-md bg-zinc-950 overflow-hidden"
                  >
                    <div
                      onClick={() => toggleFileExpand(file.filename)}
                      className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs text-zinc-200 truncate min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                        )}
                        <FileCode2 className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="truncate">{file.filename}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                        {file.status && (
                          <span
                            className={cn(
                              'px-1 py-0.2 rounded uppercase text-[9px] font-semibold border',
                              file.status === 'added'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                                : file.status === 'deleted'
                                ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                                : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
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
                      <div className="p-2.5 border-t border-zinc-900 bg-black text-[11px] font-mono overflow-x-auto leading-relaxed">
                        {file.patch.split('\n').map((line, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'px-1.5 py-0.2 whitespace-pre',
                              line.startsWith('+')
                                ? 'bg-emerald-950/30 text-emerald-300'
                                : line.startsWith('-')
                                ? 'bg-rose-950/30 text-rose-300'
                                : line.startsWith('@@')
                                ? 'text-zinc-500 bg-zinc-900/40'
                                : 'text-zinc-400'
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

        {/* TAB 3: CI DIAGNOSTICS */}
        {activeTab === 'ci_checks' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                CI Check Runs
              </span>
              <button
                onClick={() => handleCopy('ci-rerun', `gh run rerun`, 'gh run rerun')}
                className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                gh run rerun
              </button>
            </div>

            <div className="space-y-1.5">
              {ciDetails.map((ci, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-md bg-zinc-950 border border-zinc-900 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="pt-0.5">
                      {ci.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : ci.status === 'failure' || ci.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-200">
                        {ci.name}
                      </div>
                      {ci.description && (
                        <div className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">
                          {ci.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold shrink-0 border',
                      ci.status === 'success'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                        : ci.status === 'failure'
                        ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                        : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                    )}
                  >
                    {ci.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LOCAL NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Developer Notes & Scratchpad
              </span>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>

            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Write your private review notes, TODOs, or checklist for this PR..."
              rows={8}
              className="w-full bg-zinc-950 border border-zinc-900 rounded-md p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-sans leading-relaxed transition-colors"
            />
          </div>
        )}
      </div>
    </section>
  );
};

