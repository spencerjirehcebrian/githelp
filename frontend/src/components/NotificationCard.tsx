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
  ExternalLink,
  Archive,
  Copy,
  Check,
  Flame,
  AtSign,
  UserCheck,
  Terminal,
  Square,
  CheckSquare,
  Star,
} from 'lucide-react';
import type { EnrichedNotification } from '../types';
import { cn, formatTimeAgo, copyToClipboard, parsePRMetadata } from '../lib/utils';

interface NotificationCardProps {
  item: EnrichedNotification;
  isSelected: boolean;
  onSelect: () => void;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onToast: (msg: string) => void;
  showCI?: boolean;
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
  showCI = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copiedBranch, setCopiedBranch] = React.useState(false);
  const meta = parsePRMetadata(item.raw_data);
  const isDone = item.triage?.status === 'done';
  const isPinned = item.triage?.pinned === true;

  useEffect(() => {
    if (isSelected && cardRef.current?.scrollIntoView) {
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

  // Urgency left accent stripe
  const getUrgencyBorder = () => {
    if (isDone) return 'border-l-[3px] border-l-zinc-800 opacity-60';
    if (isPinned) return 'border-l-[3px] border-l-amber-500';

    const isCiFailed =
      item.ci_status === 'failure' ||
      item.ci_status === 'error' ||
      item.reason === 'ci_activity';
    const isReviewReq =
      item.reason === 'review_requested' || item.triage?.bucket === 'action_required';
    const state = (item.state || 'open').toLowerCase();
    const isMerged = item.type === 'PullRequest' && state === 'merged';
    const isReady =
      item.type === 'PullRequest' && state === 'open' && item.ci_status === 'success';

    if (isCiFailed) return 'border-l-[3px] border-l-rose-500';
    if (isReviewReq) return 'border-l-[3px] border-l-amber-500';
    if (isReady) return 'border-l-[3px] border-l-emerald-500';
    if (isMerged) return 'border-l-[3px] border-l-purple-500';
    if (item.reason === 'mention' || item.reason === 'team_mention')
      return 'border-l-[3px] border-l-indigo-500';
    return 'border-l-[3px] border-l-zinc-800';
  };

  // Render Type & State Icon
  const renderTypeIcon = () => {
    const type = item.type;
    const state = (item.state || 'open').toLowerCase();

    if (type === 'PullRequest') {
      if (state === 'merged') {
        return (
          <span title="Merged Pull Request">
            <GitMerge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          </span>
        );
      }
      if (state === 'closed') {
        return (
          <span title="Closed Pull Request">
            <GitPullRequestClosed className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </span>
        );
      }
      if (state === 'draft') {
        return (
          <span title="Draft Pull Request">
            <GitPullRequestDraft className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          </span>
        );
      }
      return (
        <span title="Open Pull Request">
          <GitPullRequest className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </span>
      );
    }

    if (type === 'Issue') {
      if (state === 'closed') {
        return (
          <span title="Closed Issue">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          </span>
        );
      }
      return (
        <span title="Open Issue">
          <CircleDot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </span>
      );
    }

    return (
      <span title={type}>
        <CircleDot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      </span>
    );
  };

  // Render Reason Badge
  const renderReasonBadge = () => {
    const r = (item.reason || '').toLowerCase();
    let text = item.reason;
    let style = 'bg-zinc-900 text-zinc-400 border-zinc-800';
    let icon = null;

    if (r === 'review_requested') {
      text = 'Review requested';
      style = 'bg-amber-950/40 text-amber-300 border-amber-800/40';
      icon = <Flame className="w-2.5 h-2.5 text-amber-400" />;
    } else if (r === 'mention' || r === 'team_mention') {
      text = r === 'team_mention' ? 'Team mention' : 'Mentioned';
      style = 'bg-purple-950/40 text-purple-300 border-purple-800/40';
      icon = <AtSign className="w-2.5 h-2.5 text-purple-400" />;
    } else if (r === 'assigned') {
      text = 'Assigned';
      style = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40';
      icon = <UserCheck className="w-2.5 h-2.5 text-emerald-400" />;
    } else if (r === 'ci_activity') {
      text = 'CI Alert';
      style = 'bg-rose-950/40 text-rose-300 border-rose-800/40';
      icon = <XCircle className="w-2.5 h-2.5 text-rose-400" />;
    } else if (r === 'author') {
      text = 'Author';
      style = 'bg-blue-950/40 text-blue-300 border-blue-800/40';
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0',
          style
        )}
      >
        {icon}
        <span>{text}</span>
      </span>
    );
  };

  // Render CI Badge (Only if showCI is true or failure)
  const renderCIBadge = () => {
    if (!item.ci_status) return null;

    if (item.ci_status === 'failure') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono" title="CI Checks Failed">
          <XCircle className="w-3 h-3" />
          <span>Checks failing</span>
        </span>
      );
    }

    if (!showCI) return null;

    if (item.ci_status === 'success') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono" title="CI Checks Passed">
          <CheckCircle2 className="w-3 h-3" />
          <span>Checks passed</span>
        </span>
      );
    }

    if (item.ci_status === 'pending') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono" title="CI Checks Running">
          <Clock className="w-3 h-3" />
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
      data-testid="notification-card"
      data-selected={isSelected ? 'true' : 'false'}
      className={cn(
        'group relative flex items-start justify-between gap-3 p-3 rounded-lg border transition-all duration-150 cursor-pointer select-none',
        getUrgencyBorder(),
        isSelected
          ? 'bg-zinc-900/90 border-zinc-700 shadow-sm ring-1 ring-zinc-500/80'
          : 'bg-zinc-950/70 border-zinc-900 hover:bg-zinc-900/50 hover:border-zinc-800'
      )}
    >
      {/* Left section: checkbox, type icon, details */}
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {/* Interactive Task Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone(item.id);
          }}
          title={isDone ? 'Mark task incomplete' : 'Complete task (Space / e)'}
          className="pt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors focus:outline-none shrink-0"
        >
          {isDone ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4 text-zinc-600 hover:text-emerald-400" />
          )}
        </button>

        {/* Unread indicator */}
        <div className="pt-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleUnread(item.id, item.unread);
            }}
            title={item.unread ? 'Mark as read (u)' : 'Mark as unread (u)'}
            className="group/unread p-0.5"
          >
            {item.unread ? (
              <span className="block w-1.5 h-1.5 rounded-full bg-blue-500 group-hover/unread:ring-2 ring-blue-500/30" />
            ) : (
              <span className="block w-1.5 h-1.5 rounded-full bg-transparent group-hover/unread:bg-zinc-700" />
            )}
          </button>
        </div>

        {/* Type Icon */}
        <div className="pt-0.5">{renderTypeIcon()}</div>

        {/* Core details */}
        <div className="space-y-1 min-w-0 flex-1">
          {/* Top metadata line: repo, reason badge, pin */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono font-medium text-zinc-400 hover:text-zinc-200 truncate">
              {item.repository}
            </span>
            {renderReasonBadge()}
            {isPinned && (
              <span className="flex items-center gap-1 text-[9px] text-amber-300 font-medium px-1 py-0.2 rounded bg-amber-950/40 border border-amber-800/40">
                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                Today's Focus
              </span>
            )}
            {item.triage.snoozed_until && (
              <span className="flex items-center gap-1 text-[9px] text-indigo-300 font-medium px-1 py-0.2 rounded bg-indigo-950/40 border border-indigo-800/40">
                <Clock className="w-2 h-2" />
                Snoozed
              </span>
            )}
          </div>

          {/* Title with link */}
          <div className="flex items-start gap-1.5">
            <a
              href={item.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-xs font-medium leading-snug hover:text-blue-400 hover:underline transition-colors line-clamp-2',
                isDone ? 'line-through text-zinc-500' : item.unread ? 'text-white font-semibold' : 'text-zinc-300'
              )}
            >
              {item.title}
              {item.number ? (
                <span className="text-zinc-500 font-mono font-normal ml-1 text-[11px]">
                  #{item.number}
                </span>
              ) : null}
            </a>
          </div>

          {/* Bottom metadata: branch checkout, CI status, diff pill, author, time */}
          <div className="flex items-center gap-2.5 text-[11px] text-zinc-500 flex-wrap pt-0.5">
            {/* PR Branch command */}
            {item.branch && (
              <button
                onClick={handleCopyCheckout}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300 transition-colors group/branch"
                title={`Click to copy: git checkout ${item.branch}`}
              >
                {copiedBranch ? (
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                ) : (
                  <Terminal className="w-2.5 h-2.5 text-zinc-500 group-hover/branch:text-zinc-300" />
                )}
                <span>{item.branch}</span>
              </button>
            )}

            {/* CI Status */}
            {renderCIBadge()}

            {/* Diff stats pill */}
            {(meta?.additions !== undefined || meta?.deletions !== undefined) && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 border border-zinc-800/80 shrink-0">
                {meta.additions !== undefined && meta.additions > 0 && (
                  <span className="text-emerald-400 font-semibold">+{meta.additions}</span>
                )}
                {meta.deletions !== undefined && meta.deletions > 0 && (
                  <span className="text-rose-400 font-semibold">-{meta.deletions}</span>
                )}
              </span>
            )}

            {/* Author info */}
            {item.author && (
              <div className="flex items-center gap-1">
                {item.author_avatar && (
                  <img
                    src={item.author_avatar}
                    alt={item.author}
                    className="w-3.5 h-3.5 rounded-full border border-zinc-800 object-cover"
                  />
                )}
                <span className="text-zinc-400">@{item.author}</span>
              </div>
            )}

            {/* Timestamp */}
            <span className="tabular-nums text-zinc-500">{formatTimeAgo(item.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Right action tools (Hover or Selected) */}
      <div
        className={cn(
          'flex items-center gap-0.5 shrink-0 pt-0.5 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(item.id, isPinned);
          }}
          className={cn(
            'p-1 rounded transition-colors',
            isPinned
              ? 'text-amber-400 hover:text-amber-300 hover:bg-zinc-900'
              : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-900'
          )}
          title={isPinned ? "Remove from Today's Focus (t)" : "Add to Today's Focus (t)"}
        >
          <Star className={cn('w-3.5 h-3.5', isPinned && 'fill-amber-400')} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone(item.id);
          }}
          className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition-colors"
          title="Complete Task (Space / e)"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSnooze(item.id);
          }}
          className="p-1 rounded text-zinc-400 hover:text-indigo-400 hover:bg-zinc-900 transition-colors"
          title="Snooze (z)"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleCopyLink}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Copy Link (c)"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <a
          href={item.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Open in Browser (o / Enter)"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
