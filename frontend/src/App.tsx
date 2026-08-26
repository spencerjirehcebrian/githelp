import { useState, useRef } from 'react';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useSSE } from './hooks/useSSE';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import type { AppViewMode } from './types';

import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { NotificationList } from './components/NotificationList';
import { InspectionCockpit } from './components/InspectionCockpit';
import { GitAssistantView } from './components/GitAssistantView';
import { CommandPalette } from './components/CommandPalette';
import { AuthBanner } from './components/AuthBanner';
import { SnoozeModal } from './components/SnoozeModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SettingsModal } from './components/SettingsModal';
import { Toast } from './components/Toast';

export default function App() {
  const {
    status,
    notifications,
    selectedBucket,
    setSelectedBucket,
    selectedRepo,
    setSelectedRepo,
    selectedReason,
    setSelectedReason,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    isSyncing,
    error,
    triggerSync,
    markItemDone,
    snoozeItem,
    togglePin,
    toggleUnread,
    updateNotes,
    markAllDone,
    refresh,
  } = useNotifications();

  const { theme, setTheme } = useTheme();

  // App View Mode (Triage Workstation vs Git Assistant)
  const [currentView, setCurrentView] = useState<AppViewMode>('triage');

  // Modals & Overlays state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [snoozeModalId, setSnoozeModalId] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // SSE real-time updates
  useSSE({
    onSyncCompleted: () => {
      refresh();
    },
    onNotificationUpdated: () => {
      refresh();
    },
    onSnoozeExpired: () => {
      refresh();
      setToastMessage('Snoozed notifications reactivated');
    },
  });

  // Global Keyboard Navigation
  const isModalOpen = Boolean(
    isCommandPaletteOpen || snoozeModalId || isShortcutsOpen || isSettingsOpen
  );

  const selectedItem = notifications[selectedIndex] || null;

  useKeyboardNavigation({
    notifications,
    selectedIndex,
    setSelectedIndex,
    onMarkDone: markItemDone,
    onOpenSnooze: (id) => setSnoozeModalId(id),
    onTogglePin: togglePin,
    onToggleUnread: toggleUnread,
    onSync: triggerSync,
    onOpenShortcuts: () => setIsShortcutsOpen(true),
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    onOpenGitAssistant: () =>
      setCurrentView((prev) => (prev === 'git_assistant' ? 'triage' : 'git_assistant')),
    onFocusSearch: () => {
      if (currentView !== 'triage') setCurrentView('triage');
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onToast: (msg) => setToastMessage(msg),
    isModalOpen,
  });

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-github-dark font-sans text-github-text">
      {/* Sidebar Navigation */}
      <Sidebar
        status={status}
        selectedBucket={selectedBucket}
        onSelectBucket={setSelectedBucket}
        selectedRepo={selectedRepo}
        onSelectRepo={setSelectedRepo}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentView={currentView}
        onSelectView={setCurrentView}
      />

      {/* Main Workstation Container */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Auth Warning Banner if offline */}
        <AuthBanner
          auth={status?.auth}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-950/40 border-b border-rose-900/40 px-5 py-2 text-xs text-rose-300 flex items-center justify-between">
            <span className="font-mono">{error}</span>
            <button
              onClick={() => refresh()}
              className="text-xs font-semibold text-rose-200 hover:text-white underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Filter & Command Bar */}
        <TopBar
          selectedBucket={selectedBucket}
          selectedRepo={selectedRepo}
          selectedReason={selectedReason}
          onSelectReason={setSelectedReason}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSyncing={isSyncing}
          onSync={triggerSync}
          onMarkAllDone={markAllDone}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          currentTheme={theme}
          onToggleTheme={handleToggleTheme}
          itemCount={notifications.length}
          searchInputRef={searchInputRef}
          currentView={currentView}
        />

        {/* View Switcher: Triage Workstation vs Git Assistant */}
        {currentView === 'git_assistant' ? (
          <div className="flex-1 overflow-hidden">
            <GitAssistantView
              onToast={(msg) => setToastMessage(msg)}
              onClose={() => setCurrentView('triage')}
            />
          </div>
        ) : (
          /* 3-Pane Triage & Inspection Workstation */
          <div className="flex-1 flex min-w-0 overflow-hidden bg-github-dark">
            {/* Middle Column: Work Stream List */}
            <div className="w-full lg:w-[440px] xl:w-[480px] shrink-0 border-r border-github-border flex flex-col min-w-0 h-full overflow-y-auto bg-github-dark">
              <NotificationList
                notifications={notifications}
                selectedBucket={selectedBucket}
                selectedIndex={selectedIndex}
                onSelectIndex={setSelectedIndex}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onMarkDone={markItemDone}
                onOpenSnooze={(id) => setSnoozeModalId(id)}
                onTogglePin={togglePin}
                onToggleUnread={toggleUnread}
                onToast={(msg) => setToastMessage(msg)}
              />
            </div>

            {/* Right Column: Git & PR Inspection Cockpit */}
            <div className="hidden lg:flex flex-1 min-w-0 h-full overflow-hidden">
              <InspectionCockpit
                item={selectedItem}
                onMarkDone={markItemDone}
                onOpenSnooze={(id) => setSnoozeModalId(id)}
                onTogglePin={togglePin}
                onToggleUnread={toggleUnread}
                onUpdateNotes={updateNotes}
                onToast={(msg) => setToastMessage(msg)}
              />
            </div>
          </div>
        )}
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        selectedItem={selectedItem}
        onSelectBucket={setSelectedBucket}
        onSelectRepo={setSelectedRepo}
        onMarkDone={markItemDone}
        onOpenSnooze={(id) => setSnoozeModalId(id)}
        onTogglePin={togglePin}
        onSync={triggerSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenGitAssistant={() => setCurrentView('git_assistant')}
        onToggleTheme={handleToggleTheme}
        currentTheme={theme}
        onToast={(msg) => setToastMessage(msg)}
      />

      {/* Modals & Overlays */}
      <SnoozeModal
        isOpen={Boolean(snoozeModalId)}
        notificationId={snoozeModalId}
        onClose={() => setSnoozeModalId(null)}
        onSnooze={snoozeItem}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        authStatus={status?.auth}
        onAuthUpdated={refresh}
        currentTheme={theme}
        onThemeChange={setTheme}
        onToast={(msg) => setToastMessage(msg)}
      />

      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
