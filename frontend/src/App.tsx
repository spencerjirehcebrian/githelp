import { useState, useRef } from 'react';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useSSE } from './hooks/useSSE';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { NotificationList } from './components/NotificationList';
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
    markAllDone,
    refresh,
  } = useNotifications();

  const { theme, setTheme } = useTheme();

  // Modals & Overlays state
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
  const isModalOpen = Boolean(snoozeModalId || isShortcutsOpen || isSettingsOpen);

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
    onFocusSearch: () => {
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
      {/* Sidebar */}
      <Sidebar
        status={status}
        selectedBucket={selectedBucket}
        onSelectBucket={setSelectedBucket}
        selectedRepo={selectedRepo}
        onSelectRepo={setSelectedRepo}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Auth Warning Banner if offline */}
        <AuthBanner
          auth={status?.auth}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Error Banner */}
        {error && (
          <div className="bg-github-red/15 border-b border-github-red/30 px-6 py-2 text-xs text-github-red flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => refresh()}
              className="underline font-medium hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Filter Bar */}
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
          currentTheme={theme}
          onToggleTheme={handleToggleTheme}
          itemCount={notifications.length}
          searchInputRef={searchInputRef}
        />

        {/* Notification Stream */}
        <div className="flex-1 overflow-y-auto bg-github-dark">
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
      </main>

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
