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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-github-text">
      <div className="bg-black border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-2 text-white text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Snooze Notification</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Presets */}
        <div className="p-4 space-y-3.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Quick Presets
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            <button
              onClick={() => handlePreset('1h')}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-xs text-zinc-200 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>1 Hour</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>{format(addHours(now, 1), 'h:mm a')}</span>
                <kbd className="px-1.5 py-0.2 font-mono text-[9px] bg-black border border-zinc-800 rounded text-zinc-500 group-hover:text-zinc-300">
                  1
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('3h')}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-xs text-zinc-200 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>3 Hours</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>{format(addHours(now, 3), 'h:mm a')}</span>
                <kbd className="px-1.5 py-0.2 font-mono text-[9px] bg-black border border-zinc-800 rounded text-zinc-500 group-hover:text-zinc-300">
                  2
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('tomorrow')}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-xs text-zinc-200 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Moon className="w-3.5 h-3.5 text-purple-400" />
                <span>Tomorrow Morning</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>{format(tomorrow9am, 'EEE, h:mm a')}</span>
                <kbd className="px-1.5 py-0.2 font-mono text-[9px] bg-black border border-zinc-800 rounded text-zinc-500 group-hover:text-zinc-300">
                  3
                </kbd>
              </div>
            </button>

            <button
              onClick={() => handlePreset('monday')}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-xs text-zinc-200 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Next Monday</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>{format(nextMon9am, 'MMM d, h:mm a')}</span>
                <kbd className="px-1.5 py-0.2 font-mono text-[9px] bg-black border border-zinc-800 rounded text-zinc-500 group-hover:text-zinc-300">
                  4
                </kbd>
              </div>
            </button>
          </div>

          {/* Custom Date Form */}
          <form onSubmit={handleCustomSubmit} className="pt-3 border-t border-zinc-900 space-y-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Custom Date & Time
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(now, 'yyyy-MM-dd')}
                className="w-full bg-black border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              disabled={!customDate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 text-white rounded-md text-xs font-medium transition-colors"
            >
              <span>Set Custom Snooze</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

