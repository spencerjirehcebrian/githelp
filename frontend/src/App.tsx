import { useState, useRef, useMemo } from 'react';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useSSE } from './hooks/useSSE';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import type {
  DashboardLayoutMode,
  PipelineColumnId,
  EnrichedNotification,
} from './types';
import { computeVisibilityMetrics, computeTaskBurndownMetrics } from './lib/utils';

import { TopBar } from './components/TopBar';
import { TaskSectionList } from './components/TaskSectionList';
import { PipelineBoard } from './components/PipelineBoard';
import { StandupView } from './components/StandupView';
import { InspectionDrawer } from './components/InspectionDrawer';
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

  // Dashboard Layout Mode (Task Sections vs Pipeline Board)
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>('stream');
  const [activeColumnId, setActiveColumnId] =
    useState<PipelineColumnId>('review_required');

  // CI Badges Global Visibility (Hidden by default)
  const [showCI, setShowCI] = useState<boolean>(false);

  // Modals & Overlays state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [snoozeModalId, setSnoozeModalId] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute live visibility and task burndown metrics
  const visibilityMetrics = useMemo(
    () => computeVisibilityMetrics(notifications),
    [notifications]
  );

  const burndownMetrics = useMemo(
    () => computeTaskBurndownMetrics(notifications),
    [notifications]
  );

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
      setToastMessage('Snoozed tasks reactivated');
    },
  });

  // Global Keyboard Navigation
  const isModalOpen = Boolean(
    isCommandPaletteOpen || snoozeModalId || isShortcutsOpen || isSettingsOpen || isDrawerOpen
  );

  const selectedItem = notifications[selectedIndex] || null;

  const handleToggleLayoutMode = () => {
    setLayoutMode((prev) => {
      if (prev === 'stream') return 'board';
      if (prev === 'board') return 'standup';
      return 'stream';
    });
  };

  const handleToggleCI = () => {
    setShowCI((prev) => {
      const next = !prev;
      setToastMessage(next ? 'CI badges visible' : 'CI badges hidden');
      return next;
    });
  };

  const handleInspectItem = (item: EnrichedNotification) => {
    const idx = notifications.findIndex((n) => n.id === item.id);
    if (idx !== -1) setSelectedIndex(idx);
    setIsDrawerOpen(true);
  };

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
    onOpenDrawer: () => setIsDrawerOpen(true),
    onToggleLayoutMode: handleToggleLayoutMode,
    layoutMode,
    activeColumnId,
    onSelectColumn: setActiveColumnId,
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-github-dark font-sans text-github-text">
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

      {/* Unified Top Navigation & Command Header */}
      <TopBar
        status={status}
        selectedBucket={selectedBucket}
        onSelectBucket={setSelectedBucket}
        selectedRepo={selectedRepo}
        onSelectRepo={setSelectedRepo}
        selectedReason={selectedReason}
        onSelectReason={setSelectedReason}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSyncing={isSyncing}
        onSync={triggerSync}
        onMarkAllDone={markAllDone}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentTheme={theme}
        onToggleTheme={handleToggleTheme}
        itemCount={notifications.length}
        searchInputRef={searchInputRef}
        layoutMode={layoutMode}
        onToggleLayoutMode={handleToggleLayoutMode}
        visibilityMetrics={visibilityMetrics}
        burndownMetrics={burndownMetrics}
        showCI={showCI}
        onToggleCI={handleToggleCI}
      />

      {/* Main Single-Feed / Pipeline / Standup Workstation Container */}
      <main className="flex-1 flex min-w-0 overflow-hidden bg-github-dark">
        {layoutMode === 'standup' ? (
          /* Daily Standup & Claimable Backlog Workstation */
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <StandupView
              onToast={(msg) => setToastMessage(msg)}
              onInspectItem={handleInspectItem}
              trackedRepo={selectedRepo || undefined}
            />
          </div>
        ) : layoutMode === 'board' ? (
          /* Pipeline Board Mode (Full Screen) */
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <PipelineBoard
              notifications={notifications}
              selectedItemId={selectedItem?.id || null}
              onSelectItem={(item) => {
                const idx = notifications.findIndex((n) => n.id === item.id);
                if (idx !== -1) setSelectedIndex(idx);
              }}
              activeColumnId={activeColumnId}
              onSelectColumn={setActiveColumnId}
              onMarkDone={markItemDone}
              onOpenSnooze={(id) => setSnoozeModalId(id)}
              onTogglePin={togglePin}
              onToggleUnread={toggleUnread}
              onToast={(msg) => setToastMessage(msg)}
              isLoading={isLoading}
              searchQuery={searchQuery}
              showCI={showCI}
            />
          </div>
        ) : (
          /* Centered Zen Single-Feed Task List */
          <div className="flex-1 flex justify-center min-w-0 h-full overflow-hidden bg-github-dark">
            <TaskSectionList
              notifications={notifications}
              selectedItemId={selectedItem?.id || null}
              onSelectItem={(item) => {
                const idx = notifications.findIndex((n) => n.id === item.id);
                if (idx !== -1) setSelectedIndex(idx);
              }}
              onMarkDone={markItemDone}
              onOpenSnooze={(id) => setSnoozeModalId(id)}
              onTogglePin={togglePin}
              onToggleUnread={toggleUnread}
              onToast={(msg) => setToastMessage(msg)}
              onInspect={handleInspectItem}
              isLoading={isLoading}
              searchQuery={searchQuery}
              showCI={showCI}
            />
          </div>
        )}
      </main>

      {/* On-Demand Slide-over Inspection Drawer */}
      <InspectionDrawer
        isOpen={isDrawerOpen && Boolean(selectedItem)}
        onClose={() => setIsDrawerOpen(false)}
        item={selectedItem}
        onMarkDone={markItemDone}
        onOpenSnooze={(id) => setSnoozeModalId(id)}
        onTogglePin={togglePin}
        onToggleUnread={toggleUnread}
        onUpdateNotes={updateNotes}
        onToast={(msg) => setToastMessage(msg)}
      />

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
