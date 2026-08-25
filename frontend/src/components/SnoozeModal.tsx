import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Moon, Sun, ArrowRight } from 'lucide-react';
import { addHours, setHours, setMinutes, addDays, nextMonday, format } from 'date-fns';

interface SnoozeModalProps {
  isOpen: boolean;
  notificationId: string | null;
  onClose: () => void;
  onSnooze: (id: string, until: Date) => void;
}

export const SnoozeModal: React.FC<SnoozeModalProps> = ({
  isOpen,
  notificationId,
  onClose,
  onSnooze,
}) => {
  const [customDate, setCustomDate] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('09:00');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (notificationId) {
        if (e.key === '1') {
          handlePreset('1h');
        } else if (e.key === '2') {
          handlePreset('3h');
        } else if (e.key === '3') {
          handlePreset('tomorrow');
        } else if (e.key === '4') {
          handlePreset('monday');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, notificationId]);

  if (!isOpen || !notificationId) return null;

  const now = new Date();

  const handlePreset = (preset: '1h' | '3h' | 'tomorrow' | 'monday') => {
    let target: Date;
    switch (preset) {
      case '1h':
        target = addHours(now, 1);
        break;
      case '3h':
        target = addHours(now, 3);
        break;
      case 'tomorrow':
        target = setMinutes(setHours(addDays(now, 1), 9), 0);
        break;
      case 'monday':
        target = setMinutes(setHours(nextMonday(now), 9), 0);
        break;
    }
    onSnooze(notificationId, target);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate) return;
    try {
      const [year, month, day] = customDate.split('-').map(Number);
      const [hours, minutes] = (customTime || '09:00').split(':').map(Number);
      const target = new Date(year, month - 1, day, hours, minutes);
      onSnooze(notificationId, target);
      onClose();
    } catch (err) {
      console.error('Invalid custom date/time', err);
    }
  };

  const tomorrow9am = setMinutes(setHours(addDays(now, 1), 9), 0);
  const nextMon9am = setMinutes(setHours(nextMonday(now), 9), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-github-darker border border-github-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-github-border bg-github-dark">
          <div className="flex items-center gap-2 text-white font-medium">
            <Clock className="w-5 h-5 text-github-accent" />
            <span>Snooze Notification</span>
          </div>
          <button
            onClick={onClose}
            className="text-github-muted hover:text-github-text transition-colors p-1 rounded hover:bg-github-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets */}
        <div className="p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-github-muted">
            Quick Presets
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handlePreset('1h')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-github-dark hover:bg-github-hover border border-github-border hover:border-github-accent/40 text-sm text-github-text transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-github-accent" />
                <span>1 Hour</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-github-muted">
                <span>{format(addHours(now, 1), 'h:mm a')}</span>
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-github-darker border border-github-border rounded text-github-muted group-hover:text-github-accent">
                  1
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('3h')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-github-dark hover:bg-github-hover border border-github-border hover:border-github-accent/40 text-sm text-github-text transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>3 Hours</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-github-muted">
                <span>{format(addHours(now, 3), 'h:mm a')}</span>
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-github-darker border border-github-border rounded text-github-muted group-hover:text-github-accent">
                  2
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('tomorrow')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-github-dark hover:bg-github-hover border border-github-border hover:border-github-accent/40 text-sm text-github-text transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-purple-400" />
                <span>Tomorrow Morning</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-github-muted">
                <span>{format(tomorrow9am, 'EEE, h:mm a')}</span>
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-github-darker border border-github-border rounded text-github-muted group-hover:text-github-accent">
                  3
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('monday')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-github-dark hover:bg-github-hover border border-github-border hover:border-github-accent/40 text-sm text-github-text transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Next Monday</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-github-muted">
                <span>{format(nextMon9am, 'MMM d, h:mm a')}</span>
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-github-darker border border-github-border rounded text-github-muted group-hover:text-github-accent">
                  4
                </kbd>
              </div>
            </button>
          </div>

          {/* Custom Date Form */}
          <form onSubmit={handleCustomSubmit} className="pt-3 border-t border-github-border space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-github-muted">
              Custom Date & Time
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(now, 'yyyy-MM-dd')}
                className="w-full bg-github-dark border border-github-border rounded-lg px-3 py-2 text-xs text-github-text focus:outline-none focus:border-github-accent"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full bg-github-dark border border-github-border rounded-lg px-3 py-2 text-xs text-github-text focus:outline-none focus:border-github-accent"
              />
            </div>
            <button
              type="submit"
              disabled={!customDate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-github-accent/20 hover:bg-github-accent/30 disabled:opacity-40 disabled:cursor-not-allowed border border-github-accent/40 text-github-accent rounded-lg text-xs font-medium transition-colors"
            >
              <span>Set Custom Snooze</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
