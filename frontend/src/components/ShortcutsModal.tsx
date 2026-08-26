import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Task Execution & Actions',
      items: [
        { key: 'Enter / i / d', desc: 'Inspect PR / Diffs Drawer' },
        { key: 'Space / e', desc: 'Complete Task (Mark Done)' },
        { key: 't', desc: "Pin / Toggle Today's Focus" },
        { key: 'c', desc: 'Copy git checkout / branch' },
        { key: 'o', desc: 'Open in GitHub' },
        { key: 'z', desc: 'Snooze task' },
        { key: 'u', desc: 'Toggle read / unread' },
      ],
    },
    {
      title: 'Workstation & Navigation',
      items: [
        { key: '⌘K / Ctrl+K', desc: 'Open Command Palette' },
        { key: 'v', desc: 'Toggle Task Sections / Board View' },
        { key: 'h / l / ← / →', desc: 'Switch Board Columns (in Board mode)' },
        { key: 'j / k / ↓ / ↑', desc: 'Navigate Tasks / Cards' },
        { key: '/', desc: 'Focus search bar' },
        { key: 'Esc', desc: 'Close drawer / modal' },
      ],
    },
    {
      title: 'General',
      items: [
        { key: 'r', desc: 'Sync tasks with GitHub' },
        { key: 's', desc: 'Open Preferences & Settings' },
        { key: '?', desc: 'Show keyboard shortcuts' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-github-text">
      <div className="bg-black border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-2 text-white text-xs font-semibold">
            <Keyboard className="w-4 h-4 text-zinc-400" />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {shortcutGroups.map((group, i) => (
            <div key={i} className="space-y-1.5">
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 gap-1">
                {group.items.map((item, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-zinc-950 border border-zinc-900 text-xs"
                  >
                    <span className="text-zinc-300">{item.desc}</span>
                    <kbd className="px-1.5 py-0.2 text-[10px] font-mono font-medium bg-black border border-zinc-800 rounded text-zinc-400">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-900 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
