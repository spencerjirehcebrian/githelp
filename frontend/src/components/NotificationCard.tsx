import React, { useRef, useEffect } from 'react';
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
  Flame,
  AtSign,
  UserCheck,
  Terminal,
} from 'lucide-react';
import type { EnrichedNotification } from '../types';
import { cn, formatTimeAgo, copyToClipboard } from '../lib/utils';

interface NotificationCardProps {
  item: EnrichedNotification;
  isSelected: boolean;
  onSelect: () => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onToast: (msg: string) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  item,
  isSelected,
  onSelect,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onToast,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copiedBranch, setCopiedBranch] = React.useState(false);

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleCopyCheckout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.branch) {
      const cmd = `git checkout ${item.branch}`;
      await copyToClipboard(cmd);
      setCopiedBranch(true);
      onToast(`Copied: ${cmd}`);
      setTimeout(() => setCopiedBranch(false), 2000);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.html_url) {
      await copyToClipboard(item.html_url);
      onToast('Copied URL');
    }
  };

  // Render Type & State Icon
  const renderTypeIcon = () => {
    const type = item.type;
    const state = (item.state || 'open').toLowerCase();

    if (type === 'PullRequest') {
      if (state === 'merged') {
        return (
          <span title="Merged Pull Request">
            <GitMerge className="w-4 h-4 text-purple-400 shrink-0" />
          </span>
        );
      }
      if (state === 'closed') {
        return (
          <span title="Closed Pull Request">
            <GitPullRequestClosed className="w-4 h-4 text-rose-400 shrink-0" />
          </span>
        );
      }
      if (state === 'draft') {
        return (
          <span title="Draft Pull Request">
            <GitPullRequestDraft className="w-4 h-4 text-zinc-400 shrink-0" />
          </span>
        );
      }
      return (
        <span title="Open Pull Request">
          <GitPullRequest className="w-4 h-4 text-emerald-400 shrink-0" />
        </span>
      );
    }

    if (type === 'Issue') {
      if (state === 'closed') {
        return (
          <span title="Closed Issue">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          </span>
        );
      }
      return (
        <span title="Open Issue">
          <CircleDot className="w-4 h-4 text-emerald-400 shrink-0" />
        </span>
      );
    }

    if (type === 'CheckSuite') {
      if (item.ci_status === 'success') {
        return (
          <span title="CI Passed">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </span>
        );
      }
      return (
        <span title="CI Failed">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
        </span>
      );
    }

    return (
      <span title={type}>
        <CircleDot className="w-4 h-4 text-blue-400 shrink-0" />
      </span>
    );
  };

  // Render Reason Badge
  const renderReasonBadge = () => {
    const r = (item.reason || '').toLowerCase();
    let text = item.reason;
    let style = 'bg-zinc-800 text-zinc-300 border-zinc-700';
    let icon = null;

    if (r === 'review_requested') {
      text = 'Review requested';
      style = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      icon = <Flame className="w-3 h-3 text-amber-400" />;
    } else if (r === 'mention' || r === 'team_mention') {
      text = r === 'team_mention' ? 'Team mention' : 'Mentioned';
      style = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      icon = <AtSign className="w-3 h-3 text-purple-400" />;
    } else if (r === 'assigned') {
      text = 'Assigned';
      style = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      icon = <UserCheck className="w-3 h-3 text-emerald-400" />;
    } else if (r === 'ci_activity') {
      text = 'CI Alert';
      style = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      icon = <XCircle className="w-3 h-3 text-rose-400" />;
    } else if (r === 'author') {
      text = 'Author';
      style = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0',
          style
        )}
      >
        {icon}
        <span>{text}</span>
      </span>
    );
  };

  // Render CI Badge
  const renderCIBadge = () => {
    if (!item.ci_status) return null;
    if (item.ci_status === 'success') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono" title="CI Checks Passed">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Checks passed</span>
        </span>
      );
    }
    if (item.ci_status === 'failure') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-rose-400 font-mono" title="CI Checks Failed">
          <XCircle className="w-3.5 h-3.5" />
          <span>Checks failing</span>
        </span>
      );
    }
    if (item.ci_status === 'pending') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono" title="CI Checks Running">
          <Clock className="w-3.5 h-3.5" />
          <span>Checks pending</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={cn(
        'group relative flex items-start justify-between gap-4 p-3.5 rounded-xl border transition-all cursor-pointer select-none',
        isSelected
          ? 'bg-github-hover/90 border-github-accent shadow-lg shadow-github-accent/5 ring-1 ring-github-accent'
          : 'bg-github-dark/80 border-github-border/80 hover:bg-github-hover/50 hover:border-github-border'
      )}
    >
      {/* Left section: status dot, icon, details */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Unread indicator */}
        <div className="pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleUnread(item.id, item.unread);
            }}
            title={item.unread ? 'Mark as read (u)' : 'Mark as unread (u)'}
            className="group/unread"
          >
            {item.unread ? (
              <span className="block w-2 h-2 rounded-full bg-github-accent group-hover/unread:ring-2 ring-github-accent/40" />
            ) : (
              <span className="block w-2 h-2 rounded-full bg-transparent group-hover/unread:bg-github-muted/40" />
            )}
          </button>
        </div>

        {/* Type Icon */}
        <div className="pt-0.5">{renderTypeIcon()}</div>

        {/* Core details */}
        <div className="space-y-1.5 min-w-0 flex-1">
          {/* Top metadata line: repo, reason badge, pin */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-medium text-github-muted hover:text-github-text truncate">
              {item.repository}
            </span>
            {renderReasonBadge()}
            {item.triage.pinned && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30">
                <Pin className="w-2.5 h-2.5 fill-amber-400" />
                Pinned
              </span>
            )}
            {item.triage.snoozed_until && (
              <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30">
                <Clock className="w-2.5 h-2.5" />
                Snoozed
              </span>
            )}
          </div>

          {/* Title with link */}
          <div className="flex items-start gap-2">
            <a
              href={item.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-sm font-medium leading-snug hover:text-github-accent hover:underline transition-colors line-clamp-2',
                item.unread ? 'text-white font-semibold' : 'text-github-text'
              )}
            >
              {item.title}
              {item.number ? (
                <span className="text-github-muted font-mono font-normal ml-1.5">
                  #{item.number}
                </span>
              ) : null}
            </a>
          </div>

          {/* Bottom metadata: branch checkout, CI status, author, time */}
          <div className="flex items-center gap-3 text-xs text-github-muted flex-wrap pt-0.5">
            {/* PR Branch command */}
            {item.branch && (
              <button
                onClick={handleCopyCheckout}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-github-darker hover:bg-github-border/70 border border-github-border text-[11px] font-mono text-github-text transition-colors group/branch"
                title={`Click to copy: git checkout ${item.branch}`}
              >
                {copiedBranch ? (
                  <Check className="w-3 h-3 text-github-green" />
                ) : (
                  <Terminal className="w-3 h-3 text-github-muted group-hover/branch:text-github-accent" />
                )}
                <span>{item.branch}</span>
              </button>
            )}

            {/* CI Status */}
            {renderCIBadge()}

            {/* Author info */}
            {item.author && (
              <div className="flex items-center gap-1.5">
                {item.author_avatar && (
                  <img
                    src={item.author_avatar}
                    alt={item.author}
                    className="w-4 h-4 rounded-full border border-github-border object-cover"
                  />
                )}
                <span>@{item.author}</span>
              </div>
            )}

            {/* Timestamp */}
            <span>{formatTimeAgo(item.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Right action tools (Hover or Selected) */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone(item.id);
          }}
          className="p-1.5 rounded-lg text-github-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          title="Mark as Done (e)"
        >
          <Archive className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSnooze(item.id);
          }}
          className="p-1.5 rounded-lg text-github-muted hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          title="Snooze (z)"
        >
          <Clock className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(item.id, item.triage.pinned);
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            item.triage.pinned
              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              : 'text-github-muted hover:text-amber-400 hover:bg-amber-500/10'
          )}
          title={item.triage.pinned ? 'Unpin (p)' : 'Pin to top (p)'}
        >
          <Pin className={cn('w-4 h-4', item.triage.pinned && 'fill-amber-400')} />
        </button>

        <button
          onClick={handleCopyLink}
          className="p-1.5 rounded-lg text-github-muted hover:text-github-accent hover:bg-github-accent/10 transition-colors"
          title="Copy Link (c)"
        >
          <Copy className="w-4 h-4" />
        </button>

        <a
          href={item.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-github-muted hover:text-white hover:bg-github-hover transition-colors"
          title="Open in Browser (o / Enter)"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
