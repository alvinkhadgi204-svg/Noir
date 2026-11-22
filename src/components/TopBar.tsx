import React, { useRef } from 'react';
import { Link2, Menu, PanelRight, Search, Settings, Type, Upload } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { NoirIcon } from './NoirIcon';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeView = usePlayerStore((s) => s.activeView);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const playlists = usePlayerStore((s) => s.playlists);
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const setUrlImportOpen = usePlayerStore((s) => s.setUrlImportOpen);
  const importLocalFiles = usePlayerStore((s) => s.importLocalFiles);
  const rightPanelOpen = usePlayerStore((s) => s.rightPanelOpen);
  const toggleRightPanel = usePlayerStore((s) => s.toggleRightPanel);
  const setThemeEditorOpen = usePlayerStore((s) => s.setThemeEditorOpen);

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  const viewTitleMap: Record<string, string> = {
    home: 'Discover',
    search: 'Global Search',
    library: 'Audio Library',
    local: 'Local File Studio',
    spotify: 'Spotify Sync',
    playlist: activePlaylist?.name || 'Playlist',
    settings: 'Settings',
  };

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-3 border-b border-white/[0.05] bg-[var(--noir-base)] shrink-0">
      {/* Zone 1: Menu toggle (mobile) + View Title */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open navigation"
          className="md:hidden p-2 text-neutral-300 hover:text-white rounded-md hover:bg-white/[0.06]"
        >
          <NoirIcon icon={Menu} className="w-5 h-5" />
        </button>
        <h1 className="text-sm sm:text-base font-semibold text-white truncate whitespace-nowrap tracking-tight">
          {viewTitleMap[activeView]}
        </h1>
      </div>

      {/* Zone 2: Quick Global Search */}
      <div className="hidden sm:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <NoirIcon
            icon={Search}
            className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeView !== 'search' && e.target.value.trim().length > 0) {
                setActiveView('search');
              }
            }}
            onFocus={() => {
              if (activeView !== 'search') setActiveView('search');
            }}
            placeholder="Search tracks or online catalogs..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white/[0.04] border border-transparent focus:border-white/15 noir-btn text-neutral-100 placeholder:text-neutral-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Zone 3: Streamlined Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => setThemeEditorOpen(true)}
          title="Themes, Fonts & CAVA"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] noir-btn transition-colors whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Type} className="w-4 h-4 text-[var(--noir-accent)]" />
          <span className="hidden lg:inline">Appearance</span>
        </button>

        <button
          onClick={() => setUrlImportOpen(true)}
          title="Stream from URL"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] noir-btn transition-colors whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Link2} className="w-4 h-4 text-[var(--noir-accent)]" />
          <span className="hidden lg:inline">URL</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Upload} className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          onClick={() => setActiveView('settings')}
          aria-label="Settings"
          title="Settings"
          className={`p-2 rounded-[var(--noir-btn-radius)] transition-colors ${
            activeView === 'settings'
              ? 'bg-white/10 text-[var(--noir-accent)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <NoirIcon icon={Settings} className="w-4 h-4" />
        </button>

        <button
          onClick={toggleRightPanel}
          aria-label={rightPanelOpen ? 'Hide queue panel' : 'Show queue panel'}
          title="Toggle Queue Panel"
          className={`hidden xl:flex p-2 rounded-[var(--noir-btn-radius)] transition-colors ${
            rightPanelOpen
              ? 'bg-white/10 text-[var(--noir-accent)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <NoirIcon icon={PanelRight} className="w-4 h-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.flac,.ogg,.wav,.m4a,.aac,.opus,audio/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void importLocalFiles(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />
      </div>
    </header>
  );
};
