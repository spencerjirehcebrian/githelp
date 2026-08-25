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
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-xl backdrop-blur bg-github-dark/95 border-github-border text-sm text-github-text animate-fade-in">
      {type === 'error' ? (
        <AlertCircle className="w-4 h-4 text-github-red" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-github-green" />
      )}
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-github-muted hover:text-github-text transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
