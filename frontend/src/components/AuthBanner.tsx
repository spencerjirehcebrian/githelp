import React from 'react';
import { AlertTriangle, Key } from 'lucide-react';
import type { AuthStatus } from '../types';

interface AuthBannerProps {
  auth?: AuthStatus;
  onOpenSettings: () => void;
}

export const AuthBanner: React.FC<AuthBannerProps> = ({ auth, onOpenSettings }) => {
  if (auth?.authenticated) return null;

  return (
    <div className="bg-amber-950/20 border-b border-amber-900/30 px-3.5 py-2 flex items-center justify-between text-xs text-zinc-300">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="truncate">
          <span className="font-semibold text-zinc-200">GitHub Authentication Required: </span>
          <span className="text-zinc-400">
            {auth?.error_message || 'No credentials found.'} Run{' '}
            <code className="bg-black px-1.5 py-0.5 rounded text-zinc-200 border border-zinc-800 font-mono text-[10px]">
              gh auth login
            </code>{' '}
            in terminal or configure a Personal Access Token.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-md text-xs font-medium transition-colors"
        >
          <Key className="w-3 h-3 text-amber-400" />
          <span>Configure Token</span>
        </button>
      </div>
    </div>
  );
};

