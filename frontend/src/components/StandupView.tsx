import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Edit3,
  Save,
  ExternalLink,
  Clock,
  PanelRightOpen,
} from 'lucide-react';
import type { StandupResponse, ClaimableIssue, EnrichedNotification } from '../types';
import { getStandup, saveStandup, getBacklog } from '../lib/api';
import { copyToClipboard } from '../lib/utils';

interface StandupViewProps {
  onToast: (msg: string) => void;
  onInspectItem?: (item: EnrichedNotification) => void;
  trackedRepo?: string;
}

export const StandupView: React.FC<StandupViewProps> = ({
  onToast,
  onInspectItem,
  trackedRepo,
}) => {
  const [standup, setStandup] = useState<StandupResponse | null>(null);
  const [backlog, setBacklog] = useState<ClaimableIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedBacklogIndex, setSelectedBacklogIndex] = useState<number>(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadData();
  }, [trackedRepo]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [standupData, backlogData] = await Promise.all([
        getStandup(todayStr, trackedRepo || undefined),
        getBacklog(trackedRepo || undefined),
      ]);
      setStandup(standupData);
      setEditText(standupData.formatted_text || '');
      setBacklog(backlogData || []);
    } catch (err: any) {
      onToast(`Failed to load standup data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = isEditing ? editText : standup?.formatted_text || '';
    if (!textToCopy) return;

    await copyToClipboard(textToCopy);
    setCopied(true);
    onToast('Rad Standup copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await saveStandup(todayStr, editText);
      setStandup(prev => prev ? { ...prev, formatted_text: editText, is_saved: true } : null);
      setIsEditing(false);
      onToast('Standup saved to local database');
    } catch (err: any) {
      onToast(`Save failed: ${err.message}`);
    }
  };

  const handleInspectIssue = (issue: ClaimableIssue) => {
    if (onInspectItem) {
      const enriched: EnrichedNotification = {
        ...issue,
        triage: {
          notification_id: issue.id,
          bucket: 'action_required',
          status: 'inbox',
          pinned: false,
          notes: '',
          updated_at: issue.updated_at,
        },
      };
      onInspectItem(enriched);
    }
  };

  // Keyboard shortcut listener for 'c' and 'e'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea, unless Cmd+Enter / Ctrl+Enter or Escape
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSaveEdit();
        } else if (e.key === 'Escape') {
          setIsEditing(false);
        }
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleCopy();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setIsEditing(prev => !prev);
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedBacklogIndex(prev => Math.min(prev + 1, Math.max(0, backlog.length - 1)));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedBacklogIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'i') {
        if (backlog[selectedBacklogIndex]) {
          e.preventDefault();
          handleInspectIssue(backlog[selectedBacklogIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [standup, isEditing, editText, backlog, selectedBacklogIndex]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
              Daily Standup Workstation
            </span>
            <span className="text-xs text-zinc-500 font-mono">{todayStr}</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-1">
            Rad Standup & Claimable Backlog
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Single-source daily sync {trackedRepo ? `from ${trackedRepo} ` : ''}(Merged, For Review, Done, Todo).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
            title="Press 'c' to copy"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Rad Standup (c)'}
          </button>

          <button
            onClick={() => {
              if (isEditing) {
                handleSaveEdit();
              } else {
                setIsEditing(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              isEditing
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Press 'e' to edit/save"
          >
            {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditing ? 'Save Standup' : 'Edit (e)'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-xs">
          Loading daily repository state...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Pane: Rad Standup Editor/Viewer (7 cols) */}
          <div className="lg:col-span-7 bg-zinc-950 border border-zinc-800 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Rad Standup Snippet</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    standup?.is_saved
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      : 'bg-blue-950/30 text-blue-400 border-blue-800/30'
                  }`}
                >
                  {standup?.is_saved ? 'Custom Saved' : 'Auto-Drafted'}
                </span>
              </div>

              {isEditing && (
                <button
                  onClick={() => {
                    setEditText(standup?.formatted_text || '');
                    setIsEditing(false);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  Cancel
                </button>
              )}
            </div>

            {isEditing ? (
              <div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full h-[400px] bg-black border border-zinc-700 rounded p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                  placeholder="Draft your standup..."
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2 text-[11px] text-zinc-500">
                  <span>Tip: Press 'Esc' to exit edit mode without saving.</span>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative group">
                <pre className="w-full min-h-[380px] bg-black border border-zinc-800/80 rounded-md p-4 font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-text overflow-x-auto">
                  {standup?.formatted_text || 'No standup data available.'}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                  title="Copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Right Pane: Claimable Backlog (5 cols) */}
          <div className="lg:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Claimable Backlog</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {backlog.length}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Recent unassigned issues {trackedRepo ? `in ${trackedRepo}` : ''}
                </p>
              </div>
            </div>

            {backlog.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No unassigned open issues found in the last 14 days.
              </div>
            ) : (
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {backlog.map((issue, idx) => {
                  const isSelected = idx === selectedBacklogIndex;
                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedBacklogIndex(idx)}
                      onDoubleClick={() => handleInspectIssue(issue)}
                      className={`p-3 rounded-md border text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-950/20'
                          : 'border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-medium text-zinc-400">
                          #{issue.number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {issue.days_open !== undefined && (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {issue.days_open === 0 ? 'today' : `${issue.days_open}d ago`}
                            </span>
                          )}
                          <a
                            href={issue.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-200 font-medium mt-1 line-clamp-2 leading-snug">
                        {issue.title}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
                        <span className="text-[10px] text-zinc-500">
                          by @{issue.author}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleInspectIssue(issue);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <PanelRightOpen className="w-3 h-3" />
                          Inspect (i)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
