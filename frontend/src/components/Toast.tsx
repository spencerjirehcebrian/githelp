import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'info' | 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 rounded-md border shadow-2xl backdrop-blur-md bg-black/95 border-zinc-800 text-xs text-zinc-200 animate-fade-in">
      {type === 'error' ? (
        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      )}
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

