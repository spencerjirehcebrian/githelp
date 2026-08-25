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
    <div className="bg-github-amber/15 border-b border-github-amber/30 px-4 py-3 flex items-center justify-between text-sm">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-github-amber shrink-0" />
        <div>
          <span className="font-semibold text-white">GitHub Authentication Required: </span>
          <span className="text-github-text">
            {auth?.error_message || 'No GitHub credentials found.'} Run{' '}
            <code className="bg-github-darker px-1.5 py-0.5 rounded text-github-accent font-mono text-xs">
              gh auth login
            </code>{' '}
            in your terminal or configure a Personal Access Token.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1 bg-github-amber/20 hover:bg-github-amber/30 text-amber-200 border border-github-amber/40 rounded-md text-xs font-medium transition-colors"
        >
          <Key className="w-3.5 h-3.5" />
          Configure Token
        </button>
      </div>
    </div>
  );
};
