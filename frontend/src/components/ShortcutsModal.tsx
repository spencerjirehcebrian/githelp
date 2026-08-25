import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Navigation & Launcher',
      items: [
        { key: 'j / ↓', desc: 'Select next notification' },
        { key: 'k / ↑', desc: 'Select previous notification' },
        { key: 'o / Enter', desc: 'Open in browser' },
        { key: '/', desc: 'Focus search bar' },
        { key: 'Esc', desc: 'Close modal / Clear focus' },
      ],
    },
    {
      title: 'Triage Actions',
      items: [
        { key: 'e', desc: 'Mark as Done (Archive)' },
        { key: 'z', desc: 'Snooze notification' },
        { key: 'c', desc: 'Copy git checkout / link' },
        { key: 'u', desc: 'Toggle read / unread' },
        { key: 'p', desc: 'Pin / Unpin to top' },
      ],
    },
    {
      title: 'General',
      items: [
        { key: 'r', desc: 'Sync with GitHub' },
        { key: '?', desc: 'Show keyboard shortcuts' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-github-darker border border-github-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-github-border bg-github-dark">
          <div className="flex items-center gap-2 text-white font-medium">
            <Keyboard className="w-5 h-5 text-github-accent" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="text-github-muted hover:text-github-text transition-colors p-1 rounded hover:bg-github-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {shortcutGroups.map((group, i) => (
            <div key={i} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-github-muted">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {group.items.map((item, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-github-dark/50 border border-github-border/40 hover:border-github-border text-sm"
                  >
                    <span className="text-github-text">{item.desc}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-github-hover border border-github-border rounded text-github-accent shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-github-border bg-github-dark flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-github-hover hover:bg-github-border border border-github-border text-xs font-medium text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
