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
  }, [isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-github-darker border border-github-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-github-border bg-github-dark shrink-0">
          <div className="flex items-center gap-2 text-white font-medium">
            <Settings className="w-5 h-5 text-github-accent" />
            <span>Preferences & Settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-github-muted hover:text-github-text transition-colors p-1 rounded hover:bg-github-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section: Authentication */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-github-muted flex items-center gap-2">
              <Key className="w-4 h-4 text-github-accent" />
              GitHub Authentication
            </h3>

            <div className="bg-github-dark border border-github-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-white">Status: </span>
                  {authStatus?.authenticated ? (
                    <span className="text-github-green font-semibold">
                      Connected ({authStatus.auth_mode === 'gh_cli' ? 'GitHub CLI' : 'PAT Token'})
                    </span>
                  ) : (
                    <span className="text-github-red font-semibold">Not Connected</span>
                  )}
                </div>
                {authStatus?.username && (
                  <span className="text-xs font-mono text-github-muted bg-github-darker px-2 py-1 rounded border border-github-border">
                    @{authStatus.username}
                  </span>
                )}
              </div>

              {authStatus?.scopes && (
                <div className="text-xs text-github-muted">
                  <span className="font-medium text-github-text">OAuth Scopes:</span> {authStatus.scopes}
                </div>
              )}

              {authError && (
                <div className="flex items-center gap-2 text-xs text-github-red bg-github-red/10 border border-github-red/30 p-2 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="flex items-center gap-2 text-xs text-github-green bg-github-green/10 border border-github-green/30 p-2 rounded">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* PAT Input & Fallback */}
              <div className="pt-2 border-t border-github-border/60 space-y-2">
                <label className="block text-xs font-medium text-github-text">
                  Personal Access Token (PAT) Fallback
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    className="flex-1 bg-github-darker border border-github-border rounded-lg px-3 py-2 text-xs font-mono text-github-text focus:outline-none focus:border-github-accent"
                  />
                  <button
                    onClick={handleSavePAT}
                    disabled={isSaving || !patInput}
                    className="px-3 py-2 bg-github-accent hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    Save & Validate
                  </button>
                  {authStatus?.auth_mode === 'pat' && (
                    <button
                      onClick={handleDisconnect}
                      disabled={isSaving}
                      className="px-3 py-2 bg-github-hover hover:bg-github-border border border-github-border text-github-muted hover:text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Use gh CLI
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-github-muted">
                  Required scopes for PAT: <code className="text-github-accent">notifications</code>,{' '}
                  <code className="text-github-accent">repo</code>,{' '}
                  <code className="text-github-accent">read:org</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Section: General Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-github-muted flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Sync & Notifications
            </h3>

            <div className="bg-github-dark border border-github-border rounded-lg p-4 space-y-4">
              {/* Poll interval */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Background Polling Interval</div>
                  <div className="text-xs text-github-muted">
                    How frequently GitHelp polls GitHub for new notifications
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="300"
                    step="5"
                    value={settings.poll_interval_sec}
                    onChange={(e) =>
                      setSettings({ ...settings, poll_interval_sec: parseInt(e.target.value, 10) || 60 })
                    }
                    className="w-20 bg-github-darker border border-github-border rounded-lg px-2.5 py-1.5 text-xs text-right text-github-text focus:outline-none focus:border-github-accent"
                  />
                  <span className="text-xs text-github-muted">sec</span>
                </div>
              </div>

              {/* Sound toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-github-border/60">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-github-accent" />
                  <div>
                    <div className="text-sm font-medium text-white">Sound Alerts</div>
                    <div className="text-xs text-github-muted">
                      Play gentle audio cue when high-priority Action Required items arrive
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playNotificationSound()}
                    className="px-2.5 py-1 text-xs bg-github-hover hover:bg-github-border border border-github-border rounded text-github-text transition-colors"
                  >
                    Test Chime
                  </button>
                  <input
                    type="checkbox"
                    checked={settings.enable_sound}
                    onChange={(e) => setSettings({ ...settings, enable_sound: e.target.checked })}
                    className="w-4 h-4 accent-github-accent rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Browser notifications */}
              <div className="flex items-center justify-between pt-3 border-t border-github-border/60">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium text-white">Desktop Notifications</div>
                    <div className="text-xs text-github-muted">
                      Show OS desktop notification banners for new triage items
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleRequestNotificationPermission}
                    className="px-3 py-1 bg-github-hover hover:bg-github-border border border-github-border rounded text-xs text-github-text transition-colors"
                  >
                    {settings.enable_browser_notifications ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Appearance */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-github-muted flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              Theme & Appearance
            </h3>

            <div className="grid grid-cols-3 gap-3">
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
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
                    currentTheme === id
                      ? 'bg-github-accent/15 border-github-accent text-github-accent'
                      : 'bg-github-dark border-github-border hover:border-github-muted text-github-text'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Ignored Repositories */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-github-muted flex items-center gap-2">
              <Shield className="w-4 h-4 text-github-red" />
              Ignored Repositories
            </h3>

            <div className="bg-github-dark border border-github-border rounded-lg p-4 space-y-3">
              <form onSubmit={handleAddIgnoredRepo} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. owner/noisy-repo"
                  value={newRepoInput}
                  onChange={(e) => setNewRepoInput(e.target.value)}
                  className="flex-1 bg-github-darker border border-github-border rounded-lg px-3 py-1.5 text-xs text-github-text focus:outline-none focus:border-github-accent"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-1.5 bg-github-hover hover:bg-github-border border border-github-border text-github-text rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </form>

              {settings.ignored_repos.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {settings.ignored_repos.map((repo) => (
                    <span
                      key={repo}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-github-darker border border-github-border text-xs text-github-text"
                    >
                      <span>{repo}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIgnoredRepo(repo)}
                        className="text-github-muted hover:text-github-red transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-github-muted italic">No repositories ignored.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-github-border bg-github-dark flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-github-muted hover:text-github-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-5 py-2 bg-github-accent hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
