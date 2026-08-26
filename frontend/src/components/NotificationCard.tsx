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
  Terminal,
  Square,
  CheckSquare,
  Star,
  Flame,
  AtSign,
  UserCheck,
  PanelRightOpen,
  Check,
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
  onInspect?: (item: EnrichedNotification) => void;
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
  onInspect,
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

  // Urgency left accent stripe
  const getUrgencyBorder = () => {
    if (isDone) return 'border-l-2 border-l-zinc-800 opacity-60';
    if (isPinned) return 'border-l-2 border-l-amber-500';

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

    if (isCiFailed) return 'border-l-2 border-l-rose-500';
    if (isReviewReq) return 'border-l-2 border-l-amber-500';
    if (isReady) return 'border-l-2 border-l-emerald-500';
    if (isMerged) return 'border-l-2 border-l-purple-500';
    if (item.reason === 'mention' || item.reason === 'team_mention')
      return 'border-l-2 border-l-indigo-500';
    return 'border-l-2 border-l-zinc-800';
  };

  // Render Type & State Icon
  const renderTypeIcon = () => {
    const type = item.type;
    const state = (item.state || 'open').toLowerCase();

    if (type === 'PullRequest') {
      if (state === 'merged') {
        return <GitMerge className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      }
      if (state === 'closed') {
        return <GitPullRequestClosed className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      }
      if (state === 'draft') {
        return <GitPullRequestDraft className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
      }
      return <GitPullRequest className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }

    if (type === 'Issue') {
      if (state === 'closed') {
        return <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      }
      return <CircleDot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }

    return <CircleDot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  // Render Reason Badge
  const renderReasonBadge = () => {
    const r = (item.reason || '').toLowerCase();
    if (r === 'review_requested') {
      return (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border bg-amber-950/40 text-amber-300 border-amber-800/40 shrink-0">
          <Flame className="w-2.5 h-2.5 text-amber-400" />
          <span>Review</span>
        </span>
      );
    }
    if (r === 'mention' || r === 'team_mention') {
      return (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border bg-purple-950/40 text-purple-300 border-purple-800/40 shrink-0">
          <AtSign className="w-2.5 h-2.5 text-purple-400" />
          <span>Mention</span>
        </span>
      );
    }
    if (r === 'assigned') {
      return (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border bg-emerald-950/40 text-emerald-300 border-emerald-800/40 shrink-0">
          <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
          <span>Assigned</span>
        </span>
      );
    }
    return null;
  };

  // Render CI Badge (Only if showCI is true or failure)
  const renderCIBadge = () => {
    if (!item.ci_status) return null;

    if (item.ci_status === 'failure') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono shrink-0" title="Checks failing">
          <XCircle className="w-3 h-3" />
        </span>
      );
    }

    if (!showCI) return null;

    if (item.ci_status === 'success') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono shrink-0" title="Checks passed">
          <CheckCircle2 className="w-3 h-3" />
          <span className="hidden md:inline">Checks passed</span>
        </span>
      );
    }

    if (item.ci_status === 'pending') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono shrink-0" title="Checks pending">
          <Clock className="w-3 h-3" />
        </span>
      );
    }

    return null;
  };

  const handleRowClick = () => {
    onSelect();
    if (onInspect) {
      onInspect(item);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleRowClick}
      data-testid="notification-card"
      data-selected={isSelected ? 'true' : 'false'}
      className={cn(
        'group relative flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer select-none text-xs',
        getUrgencyBorder(),
        isSelected
          ? 'bg-zinc-900 border-zinc-700 shadow-sm ring-1 ring-zinc-500/80'
          : 'bg-zinc-950/70 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800'
      )}
    >
      {/* Left: Checkbox + Unread + Type + Repo + Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        {/* Interactive Task Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone(item.id);
          }}
          title={isDone ? 'Mark task incomplete' : 'Complete task (Space / e)'}
          className="text-zinc-500 hover:text-emerald-400 transition-colors focus:outline-none shrink-0"
        >
          {isDone ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4 text-zinc-600 hover:text-emerald-400" />
          )}
        </button>

        {/* Unread indicator */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleUnread(item.id, item.unread);
          }}
          title={item.unread ? 'Mark as read (u)' : 'Mark as unread (u)'}
          className="group/unread p-0.5 shrink-0"
        >
          {item.unread ? (
            <span className="block w-1.5 h-1.5 rounded-full bg-blue-500 group-hover/unread:ring-2 ring-blue-500/30" />
          ) : (
            <span className="block w-1.5 h-1.5 rounded-full bg-transparent group-hover/unread:bg-zinc-700" />
          )}
        </button>

        {/* Type Icon */}
        <div className="shrink-0">{renderTypeIcon()}</div>

        {/* Repo Badge */}
        <span
          className="font-mono text-[10px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/80 truncate max-w-[120px] shrink-0"
          title={item.repository}
        >
          {item.repository.split('/')[1] || item.repository}
        </span>

        {/* Title */}
        <span
          className={cn(
            'truncate min-w-0 font-medium',
            isDone ? 'line-through text-zinc-500' : item.unread ? 'text-white font-semibold' : 'text-zinc-200 group-hover:text-white'
          )}
        >
          {item.title}
        </span>

        {/* PR/Issue Number */}
        {item.number && (
          <span className="text-zinc-500 font-mono text-[10px] shrink-0">
            #{item.number}
          </span>
        )}

        {/* Branch tag snippet */}
        {item.branch && (
          <button
            onClick={handleCopyCheckout}
            className="hidden md:flex items-center gap-1 px-1.5 py-0.2 rounded bg-black/60 hover:bg-zinc-800 border border-zinc-800/80 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 group/branch"
            title={`Copy checkout: git checkout ${item.branch}`}
          >
            {copiedBranch ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <Terminal className="w-2.5 h-2.5 text-zinc-500 group-hover/branch:text-zinc-300" />
            )}
            <span className="max-w-[100px] truncate">{item.branch}</span>
          </button>
        )}

        {/* Diff stats pill */}
        {(meta?.additions !== undefined || meta?.deletions !== undefined) && (
          <span className="hidden lg:flex items-center gap-1 text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 border border-zinc-800/80 shrink-0">
            {meta.additions !== undefined && meta.additions > 0 && (
              <span className="text-emerald-400 font-semibold">+{meta.additions}</span>
            )}
            {meta.deletions !== undefined && meta.deletions > 0 && (
              <span className="text-rose-400 font-semibold">-{meta.deletions}</span>
            )}
          </span>
        )}
      </div>

      {/* Right: Badges, Time, and Quick Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Reason Badge */}
        {renderReasonBadge()}

        {/* CI Badge */}
        {renderCIBadge()}

        {/* Today's Focus badge */}
        {isPinned && (
          <span className="flex items-center gap-1 text-[9px] text-amber-300 font-medium px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-800/40 shrink-0">
            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
            <span className="hidden sm:inline">Today</span>
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {formatTimeAgo(item.updated_at)}
        </span>

        {/* Quick action buttons (Hover or Selected) */}
        <div
          className={cn(
            'flex items-center gap-0.5 transition-opacity',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          {/* Inspect Drawer button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              if (onInspect) onInspect(item);
            }}
            className="p-1 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-850 transition-colors"
            title="Inspect Details (Enter / i)"
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>

          {/* Today's Focus star pin */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(item.id, isPinned);
            }}
            className={cn(
              'p-1 rounded transition-colors',
              isPinned
                ? 'text-amber-400 hover:text-amber-300 hover:bg-zinc-850'
                : 'text-zinc-500 hover:text-amber-400 hover:bg-zinc-850'
            )}
            title={isPinned ? "Remove from Today's Focus (t)" : "Add to Today's Focus (t)"}
          >
            <Star className={cn('w-3.5 h-3.5', isPinned && 'fill-amber-400')} />
          </button>

          {/* Mark Complete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkDone(item.id);
            }}
            className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-850 transition-colors"
            title="Complete Task (Space / e)"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          {/* Snooze */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSnooze(item.id);
            }}
            className="p-1 rounded text-zinc-500 hover:text-indigo-400 hover:bg-zinc-850 transition-colors"
            title="Snooze (z)"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* Open in GitHub */}
          <a
            href={item.html_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-850 transition-colors"
            title="Open in GitHub (o)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
