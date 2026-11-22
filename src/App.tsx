import React, { useEffect, useState } from 'react';
import { HardDrive, Home, Library, Radio, Search, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalDropOverlay } from './components/GlobalDropOverlay';
import { LibraryView } from './components/LibraryView';
import { LocalStudioView } from './components/LocalStudioView';
import { MainHome } from './components/MainHome';
import { NoirIcon } from './components/NoirIcon';
import { NowPlayingOverlay } from './components/NowPlayingOverlay';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistDetailView } from './components/PlaylistDetailView';
import { RightPanel } from './components/RightPanel';
import { SearchView } from './components/SearchView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { SpotifySyncView } from './components/SpotifySyncView';
import { ThemeEditorDrawer } from './components/ThemeEditorDrawer';
import { ToastBanner } from './components/ToastBanner';
import { TopBar } from './components/TopBar';
import { UrlImportModal } from './components/UrlImportModal';
import { UselessEffectsLayer } from './components/UselessEffectsLayer';
import { UsernameOnboardingModal } from './components/UsernameOnboardingModal';
import { usePlayerStore } from './store/usePlayerStore';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const init = usePlayerStore((s) => s.init);
  const initialized = usePlayerStore((s) => s.initialized);
  const activeView = usePlayerStore((s) => s.activeView);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const sidebarPosition = usePlayerStore((s) => s.theme.sidebarPosition);
  const animationSpeed = usePlayerStore((s) => s.theme.animationSpeed);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const completeSpotifyAuth = usePlayerStore((s) => s.completeSpotifyAuth);
  const showToast = usePlayerStore((s) => s.showToast);
  const spotifyConnected = usePlayerStore((s) => s.spotifyConnected);
  const spotifyWatchEnabled = usePlayerStore((s) => s.spotifyWatchEnabled);
  const watchedPlaylistIds = usePlayerStore((s) => s.watchedPlaylistIds);
  const syncWatchedPlaylists = usePlayerStore((s) => s.syncWatchedPlaylists);
  const autoUpdateEnabled = usePlayerStore((s) => s.autoUpdateEnabled);
  const checkForAppUpdate = usePlayerStore((s) => s.checkForAppUpdate);

  useEffect(() => {
    void init();
  }, [init]);

  // Self-updater background check once initialized
  useEffect(() => {
    if (!initialized || !autoUpdateEnabled) return;
    const timer = window.setTimeout(() => {
      void checkForAppUpdate(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [initialized, autoUpdateEnabled, checkForAppUpdate]);

  // Listen for Spotify OAuth popup postMessage callback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const trustedOrigin =
        event.origin === window.location.origin ||
        event.origin.endsWith('.run.app') ||
        event.origin.startsWith('http://localhost');
      if (!trustedOrigin) return;

      const payload = event.data as { type?: string; sessionToken?: string; error?: string };
      if (payload.type === 'SPOTIFY_AUTH_SUCCESS' && payload.sessionToken) {
        void completeSpotifyAuth(payload.sessionToken);
      } else if (payload.type === 'SPOTIFY_AUTH_ERROR') {
        showToast(payload.error || 'Spotify authorization failed', 'error');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [completeSpotifyAuth, showToast]);

  // Poll watched Spotify playlists every 30 seconds for newly added songs
  useEffect(() => {
    if (!spotifyConnected || !spotifyWatchEnabled || watchedPlaylistIds.length === 0) return;

    void syncWatchedPlaylists(false);
    const id = window.setInterval(() => {
      void syncWatchedPlaylists(false);
    }, 30_000);

    return () => window.clearInterval(id);
  }, [spotifyConnected, spotifyWatchEnabled, watchedPlaylistIds.length, syncWatchedPlaylists]);

  // Global keyboard shortcuts (Space: play/pause, Arrows: seek ±5s, Cmd/Ctrl+K: search)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveView('search');
        return;
      }

      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        void togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = usePlayerStore.getState().currentTime;
        seek(cur + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = usePlayerStore.getState().currentTime;
        seek(Math.max(0, cur - 5));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, seek, setActiveView]);

  const renderMainView = () => {
    switch (activeView) {
      case 'search':
        return <SearchView />;
      case 'library':
        return <LibraryView />;
      case 'local':
        return <LocalStudioView />;
      case 'spotify':
        return <SpotifySyncView />;
      case 'playlist':
        return <PlaylistDetailView />;
      case 'settings':
        return <SettingsView />;
      case 'home':
      default:
        return <MainHome />;
    }
  };

  const mobileTabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'search' as const, label: 'Search', icon: Search },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'local' as const, label: 'Local', icon: HardDrive },
    { id: 'spotify' as const, label: 'Spotify', icon: Radio },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const transitionDuration = animationSpeed <= 0 ? 0 : Math.max(0.08, 0.18 * (1 / Math.max(animationSpeed, 0.25)));

  return (
    <div className="noir-app-shell w-screen flex flex-col bg-[var(--noir-base)] text-neutral-100 overflow-hidden relative">
      {/* Settings-only Experimental Visual Layer */}
      <UselessEffectsLayer />

      {/* Main Workspace Row */}
      <div
        className={`flex-1 min-h-0 flex overflow-hidden relative z-10 ${
          sidebarPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          {/* Compact mobile quick-switch strip (works across 320px+ older & modern phones) */}
          <nav
            aria-label="Mobile quick navigation"
            className="md:hidden flex items-center justify-around border-b border-white/[0.06] bg-[var(--noir-surface)] px-1 shrink-0"
          >
            {mobileTabs.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex-1 min-h-[42px] flex items-center justify-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <NoirIcon icon={item.icon} fillable={active} className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden min-[400px]:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <main className="flex-1 min-h-0 overflow-y-auto bg-[var(--noir-base)]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${activeView}-${activePlaylistId || ''}`}
                initial={animationSpeed > 0 ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={animationSpeed > 0 ? { opacity: 0, y: -6 } : undefined}
                transition={{ duration: transitionDuration, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-full"
              >
                {renderMainView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <RightPanel />
      </div>

      {/* Persistent Player Bar (Bottom or Floating) */}
      <PlayerBar />

      {/* Overlays & Modals */}
      <NowPlayingOverlay />
      <ThemeEditorDrawer />
      <UrlImportModal />
      <UsernameOnboardingModal />
      <GlobalDropOverlay />
      <ToastBanner />
      <OfflineIndicator />
    </div>
  );
}
