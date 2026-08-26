import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Volume2, Bell, Shield, Moon, Sun, Monitor, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AppSettings, AuthStatus } from '../types';
import * as api from '../lib/api';
import { playNotificationSound } from '../lib/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authStatus?: AuthStatus;
  onAuthUpdated: () => void;
  currentTheme: 'dark' | 'light' | 'system';
  onThemeChange: (theme: 'dark' | 'light' | 'system') => void;
  onToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  authStatus,
  onAuthUpdated,
  currentTheme,
  onThemeChange,
  onToast,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [patInput, setPatInput] = useState<string>('');
  const [newRepoInput, setNewRepoInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.getSettings().then((s) => {
      setSettings(s);
      setPatInput(s.pat_token || '');
    }).catch(console.error);
    setAuthError(null);
    setAuthSuccess(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !settings) return null;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      onToast('Settings saved successfully');
      onClose();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePAT = async () => {
    if (!patInput) return;
    setIsSaving(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await api.setPAT(patInput);
      setAuthSuccess(`Authenticated as @${res.username}`);
      onAuthUpdated();
      onToast('PAT token configured successfully');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Invalid PAT');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await api.disconnectAuth();
      setPatInput('');
      setAuthSuccess('Reverted to GitHub CLI authentication');
      onAuthUpdated();
      onToast('Switched to gh CLI auth');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setSettings({ ...settings, enable_browser_notifications: true });
        onToast('Browser notifications enabled');
      } else {
        setSettings({ ...settings, enable_browser_notifications: false });
        onToast('Notification permission was denied');
      }
    }
  };

  const handleAddIgnoredRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRepoInput.trim();
    if (!clean) return;
    if (!settings.ignored_repos.includes(clean)) {
      setSettings({
        ...settings,
        ignored_repos: [...settings.ignored_repos, clean],
      });
    }
    setNewRepoInput('');
  };

  const handleRemoveIgnoredRepo = (repo: string) => {
    setSettings({
      ...settings,
      ignored_repos: settings.ignored_repos.filter((r) => r !== repo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-github-text">
      <div className="bg-black border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2 text-white text-xs font-semibold">
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>Preferences & Settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Section: Authentication */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-zinc-400" />
              GitHub Authentication
            </h3>

            <div className="bg-zinc-950 border border-zinc-900 rounded-md p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400">Status: </span>
                  {authStatus?.authenticated ? (
                    <span className="text-emerald-400 font-medium">
                      Connected ({authStatus.auth_mode === 'gh_cli' ? 'GitHub CLI' : 'PAT Token'})
                    </span>
                  ) : (
                    <span className="text-rose-400 font-medium">Not Connected</span>
                  )}
                </div>
                {authStatus?.username && (
                  <span className="text-[11px] font-mono text-zinc-400 bg-black px-1.5 py-0.5 rounded border border-zinc-800">
                    @{authStatus.username}
                  </span>
                )}
              </div>

              {authStatus?.scopes && (
                <div className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-400">OAuth Scopes:</span> {authStatus.scopes}
                </div>
              )}

              {authError && (
                <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-900/40 p-2 rounded">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 p-2 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* PAT Input & Fallback */}
              <div className="pt-2 border-t border-zinc-900 space-y-2">
                <label className="block text-[11px] font-medium text-zinc-300">
                  Personal Access Token (PAT) Fallback
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    className="flex-1 bg-black border border-zinc-800 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700"
                  />
                  <button
                    onClick={handleSavePAT}
                    disabled={isSaving || !patInput}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    Save & Validate
                  </button>
                  {authStatus?.auth_mode === 'pat' && (
                    <button
                      onClick={handleDisconnect}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-md text-xs font-medium transition-colors"
                    >
                      Use gh CLI
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">
                  Required scopes: <code className="text-zinc-400">notifications</code>, <code className="text-zinc-400">repo</code>, <code className="text-zinc-400">read:org</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Section: General Settings */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              Sync & Notifications
            </h3>

            <div className="bg-zinc-950 border border-zinc-900 rounded-md p-3.5 space-y-3">
              {/* Poll interval */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-zinc-200">Background Polling Interval</div>
                  <div className="text-[11px] text-zinc-500">
                    How frequently GitHelp polls GitHub for new notifications
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="15"
                    max="300"
                    step="5"
                    value={settings.poll_interval_sec}
                    onChange={(e) =>
                      setSettings({ ...settings, poll_interval_sec: parseInt(e.target.value, 10) || 60 })
                    }
                    className="w-16 bg-black border border-zinc-800 rounded-md px-2 py-1 text-xs text-right text-zinc-200 focus:outline-none focus:border-zinc-700 tabular-nums"
                  />
                  <span className="text-xs text-zinc-500">sec</span>
                </div>
              </div>

              {/* Sound toggle */}
              <div className="flex items-center justify-between pt-2.5 border-t border-zinc-900">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Sound Alerts</div>
                    <div className="text-[11px] text-zinc-500">
                      Play audio cue when high-priority Action Required items arrive
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playNotificationSound()}
                    className="px-2 py-0.5 text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-zinc-300 transition-colors"
                  >
                    Test
                  </button>
                  <input
                    type="checkbox"
                    checked={settings.enable_sound}
                    onChange={(e) => setSettings({ ...settings, enable_sound: e.target.checked })}
                    className="w-3.5 h-3.5 accent-zinc-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Browser notifications */}
              <div className="flex items-center justify-between pt-2.5 border-t border-zinc-900">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-zinc-400" />
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Desktop Notifications</div>
                    <div className="text-[11px] text-zinc-500">
                      Show desktop notification banners for new triage items
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleRequestNotificationPermission}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-zinc-300 transition-colors"
                  >
                    {settings.enable_browser_notifications ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Appearance */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-zinc-400" />
              Theme & Appearance
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'system', label: 'System', icon: Monitor },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    const themeChoice = id as 'dark' | 'light' | 'system';
                    setSettings({ ...settings, theme: themeChoice });
                    onThemeChange(themeChoice);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-md border text-xs font-medium transition-colors ${
                    currentTheme === id
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Ignored Repositories */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              Ignored Repositories
            </h3>

            <div className="bg-zinc-950 border border-zinc-900 rounded-md p-3.5 space-y-2.5">
              <form onSubmit={handleAddIgnoredRepo} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. owner/noisy-repo"
                  value={newRepoInput}
                  onChange={(e) => setNewRepoInput(e.target.value)}
                  className="flex-1 bg-black border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-md text-xs font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </form>

              {settings.ignored_repos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {settings.ignored_repos.map((repo) => (
                    <span
                      key={repo}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-black border border-zinc-800 text-[11px] text-zinc-300 font-mono"
                    >
                      <span>{repo}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIgnoredRepo(repo)}
                        className="text-zinc-500 hover:text-rose-400 transition-colors ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-600 italic">No repositories ignored.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-900 bg-zinc-950 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

