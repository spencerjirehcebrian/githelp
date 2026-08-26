import React, { useEffect, useRef } from 'react';
import { X, PanelRightClose } from 'lucide-react';
import type { EnrichedNotification } from '../types';
import { InspectionCockpit } from './InspectionCockpit';

interface InspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: EnrichedNotification | null;
  onMarkDone: (id: string) => void;
  onOpenSnooze: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onToggleUnread: (id: string, currentUnread: boolean) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onToast: (msg: string) => void;
}

export const InspectionDrawer: React.FC<InspectionDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onMarkDone,
  onOpenSnooze,
  onTogglePin,
  onToggleUnread,
  onUpdateNotes,
  onToast,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or q when drawer is focused
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !item) {
    return null;
  }

  return (
    <div
      data-testid="inspection-drawer-overlay"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop Scrim */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Slide-over Drawer Panel */}
      <div
        ref={drawerRef}
        data-testid="inspection-drawer"
        className="relative z-10 w-full sm:w-[580px] md:w-[680px] lg:w-[760px] xl:w-[820px] h-screen bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header Bar */}
        <div className="h-11 px-4 border-b border-zinc-850 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <PanelRightClose className="w-4 h-4 text-zinc-400" />
            <span>Inspection Details</span>
            <span className="text-[11px] font-mono text-zinc-500">
              {item.repository} #{item.number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
              Press Esc to close
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded Inspection Cockpit */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <InspectionCockpit
            item={item}
            onMarkDone={onMarkDone}
            onOpenSnooze={onOpenSnooze}
            onTogglePin={onTogglePin}
            onToggleUnread={onToggleUnread}
            onUpdateNotes={onUpdateNotes}
            onToast={onToast}
          />
        </div>
      </div>
    </div>
  );
};
