import React, { useState } from 'react';
import {
  HardDrive,
  Home,
  Library,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Radio,
  Search,
  Settings,
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { NoirIcon } from './NoirIcon';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const activeView = usePlayerStore((s) => s.activeView);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const playlists = usePlayerStore((s) => s.playlists);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const togglePinPlaylist = usePlayerStore((s) => s.togglePinPlaylist);
  const sidebarCollapsed = usePlayerStore((s) => s.sidebarCollapsed);
  const toggleSidebar = usePlayerStore((s) => s.toggleSidebar);
  const sidebarPosition = usePlayerStore((s) => s.theme.sidebarPosition);
  const setThemeEditorOpen = usePlayerStore((s) => s.setThemeEditorOpen);
  const username = usePlayerStore((s) => s.username);

  const sortedPlaylists = [...playlists].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const pl = await createPlaylist(newName);
    setNewName('');
    setCreating(false);
    setActiveView('playlist', pl.id);
    onCloseMobile();
  };

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'search' as const, label: 'Search', icon: Search },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'local' as const, label: 'Local Studio', icon: HardDrive },
    { id: 'spotify' as const, label: 'Spotify Sync', icon: Radio },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const borderClass = sidebarPosition === 'right' ? 'border-l border-white/[0.07]' : 'border-r border-white/[0.07]';

  const content = (
    <aside
      className={`flex flex-col h-full bg-[var(--noir-surface)] ${borderClass} select-none transition-[width] duration-200 ${
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06] shrink-0">
        <button
          onClick={() => {
            setActiveView('home');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left min-w-0"
        >
          <div className="w-8 h-8 rounded-[var(--noir-btn-radius)] bg-[#0f0f0f] border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
            <img src="/pwa-192x192.png" alt="Aurora Vibes" className="w-full h-full object-cover" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-white whitespace-nowrap truncate">
                Aurora Vibes
              </span>
              {username && (
                <span className="block text-[10px] text-neutral-400 truncate">
                  {username}
                </span>
              )}
            </div>
          )}
        </button>

        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
        >
          <NoirIcon icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose} className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="px-2.5 py-3 space-y-1 shrink-0">
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                onCloseMobile();
              }}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium noir-btn transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]'
              }`}
            >
              <NoirIcon
                icon={item.icon}
                fillable={active}
                className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--noir-accent)]' : ''}`}
              />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Playlists Section */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          {!sidebarCollapsed ? (
            <span className="text-xs font-medium text-neutral-400">Playlists</span>
          ) : (
            <span className="sr-only">Playlists</span>
          )}
          <button
            onClick={() => {
              if (sidebarCollapsed) toggleSidebar();
              setCreating((c) => !c);
            }}
            aria-label="Create playlist"
            title="Create Playlist"
            className="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-white/10 transition-colors mx-auto md:mx-0"
          >
            <NoirIcon icon={Plus} className="w-4 h-4" />
          </button>
        </div>

        {creating && !sidebarCollapsed && (
          <form onSubmit={(e) => void handleCreatePlaylist(e)} className="px-3 pb-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              autoFocus
              className="w-full px-3 py-1.5 text-xs bg-[var(--noir-base)] border border-white/15 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)]"
            />
          </form>
        )}

        <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5">
          {sortedPlaylists.map((pl) => {
            const isSelected = activeView === 'playlist' && activePlaylistId === pl.id;
            return (
              <div
                key={pl.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-[var(--noir-btn-radius)] transition-colors ${
                  isSelected
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveView('playlist', pl.id);
                    onCloseMobile();
                  }}
                  title={pl.name}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                >
                  <div className="w-7 h-7 rounded-md bg-[var(--noir-elevated)] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-medium text-neutral-300">
                    {pl.artworkUrl ? (
                      <img
                        src={pl.artworkUrl}
                        alt={pl.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      pl.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{pl.name}</p>
                      <p className="text-[11px] text-neutral-500 tabular-nums">
                        {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  )}
                </button>

                {!sidebarCollapsed && (
                  <button
                    onClick={() => void togglePinPlaylist(pl.id)}
                    aria-label={pl.pinned ? 'Unpin playlist' : 'Pin playlist'}
                    className={`p-1 rounded transition-opacity ${
                      pl.pinned
                        ? 'text-[var(--noir-accent)] opacity-100'
                        : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'
                    }`}
                  >
                    <NoirIcon icon={Pin} fillable={pl.pinned} className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions: PWA Install + Theme Editor */}
      <div className="p-3 border-t border-white/[0.06] space-y-2 shrink-0">
        <PWAInstallButton collapsed={sidebarCollapsed} />

        <button
          onClick={() => {
            setThemeEditorOpen(true);
            onCloseMobile();
          }}
          title="Theme Studio"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn transition-colors whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Palette} className="w-3.5 h-3.5 text-[var(--noir-accent)] shrink-0" />
          {!sidebarCollapsed && <span>Theme Studio</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:flex h-full shrink-0">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
