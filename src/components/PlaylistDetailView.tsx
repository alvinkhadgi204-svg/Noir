import React, { useState } from 'react';
import { ArrowDown, ArrowDownAZ, ArrowUp, Check, Download, Edit3, Pin, Play, Share2, Shuffle, Trash2 } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/music';
import { exportPlaylistM3u, formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';
import { TrackRow } from './TrackRow';

export const PlaylistDetailView: React.FC = () => {
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const playlists = usePlayerStore((s) => s.playlists);
  const tracks = usePlayerStore((s) => s.tracks);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const togglePinPlaylist = usePlayerStore((s) => s.togglePinPlaylist);
  const renamePlaylist = usePlayerStore((s) => s.renamePlaylist);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const reorderPlaylistTracks = usePlayerStore((s) => s.reorderPlaylistTracks);
  const sortPlaylistAZ = usePlayerStore((s) => s.sortPlaylistAZ);
  const getShareUrl = usePlayerStore((s) => s.getShareUrl);
  const showToast = usePlayerStore((s) => s.showToast);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const playlist = playlists.find((p) => p.id === activePlaylistId);
  if (!playlist) {
    return (
      <div className="p-8 text-center text-sm text-neutral-400">
        Playlist not found.
      </div>
    );
  }

  const playlistTracks = playlist.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));

  const totalDuration = playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  const handleShare = async () => {
    const shareUrl = getShareUrl(playlist.id);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Shareable playlist link copied to clipboard', 'success');
        return;
      }
    } catch {
      // Fallback below for older mobile browsers
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Shareable playlist link copied to clipboard', 'success');
    } catch {
      showToast('Unable to copy link on this device', 'info');
    }
  };

  const handleExportM3u = () => {
    const m3u = exportPlaylistM3u(playlist.name, playlistTracks);
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported .m3u playlist file', 'success');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await renamePlaylist(playlist.id, draftName, draftDesc);
    setEditing(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Playlist Header */}
      <div className="noir-card p-6 flex flex-col md:flex-row items-start md:items-end gap-6">
        <CoverArt
          src={playlist.artworkUrl || playlistTracks[0]?.artworkUrl}
          alt={playlist.name}
          size="lg"
        />

        <div className="flex-1 min-w-0 space-y-3">
          {editing ? (
            <form onSubmit={(e) => void handleSaveEdit(e)} className="space-y-2 max-w-md">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full px-3 py-1.5 text-lg font-semibold bg-[var(--noir-base)] border border-white/15 rounded-md text-white focus:outline-none focus:border-[var(--noir-accent)]"
              />
              <input
                type="text"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Description..."
                className="w-full px-3 py-1.5 text-xs bg-[var(--noir-base)] border border-white/15 rounded-md text-neutral-300 focus:outline-none focus:border-[var(--noir-accent)]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--noir-accent)] text-black noir-btn"
              >
                <NoirIcon icon={Check} className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </form>
          ) : (
            <>
              <p className="text-xs font-medium text-[var(--noir-accent)]">
                Playlist · <span className="tabular-nums">{playlistTracks.length}</span> tracks ·{' '}
                <span className="tabular-nums">{formatTime(totalDuration)}</span>
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white truncate">
                {playlist.name}
              </h2>
              {playlist.description && (
                <p className="text-sm text-neutral-400 max-w-2xl">{playlist.description}</p>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={() => playlistTracks[0] && void playTrack(playlistTracks[0], playlistTracks)}
              disabled={playlistTracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 disabled:opacity-40 noir-btn transition-opacity whitespace-nowrap"
            >
              <NoirIcon icon={Play} fillable className="w-3.5 h-3.5" />
              <span>Play All</span>
            </button>

            <button
              onClick={() => {
                if (playlistTracks.length === 0) return;
                if (!shuffle) toggleShuffle();
                const rand = playlistTracks[Math.floor(Math.random() * playlistTracks.length)];
                void playTrack(rand, playlistTracks);
              }}
              disabled={playlistTracks.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 disabled:opacity-40 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={Shuffle} className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={() => void togglePinPlaylist(playlist.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border noir-btn transition-colors whitespace-nowrap ${
                playlist.pinned
                  ? 'border-[var(--noir-accent)] text-[var(--noir-accent)] bg-white/[0.04]'
                  : 'border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <NoirIcon icon={Pin} fillable={playlist.pinned} className="w-3.5 h-3.5" />
              <span>{playlist.pinned ? 'Pinned' : 'Pin'}</span>
            </button>

            <button
              onClick={() => void sortPlaylistAZ(playlist.id)}
              disabled={playlistTracks.length < 2}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 disabled:opacity-40 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={ArrowDownAZ} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
              <span>Sort A–Z</span>
            </button>

            <button
              onClick={() => {
                setDraftName(playlist.name);
                setDraftDesc(playlist.description);
                setEditing((e) => !e);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={Edit3} className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              onClick={() => void handleShare()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={Share2} className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>

            <button
              onClick={handleExportM3u}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={Download} className="w-3.5 h-3.5" />
              <span>Export M3U</span>
            </button>

            <button
              onClick={() => void deletePlaylist(playlist.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={Trash2} className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tracks with Drag & Drop + Button Reordering */}
      {playlistTracks.length === 0 ? (
        <div className="noir-card p-10 text-center space-y-2">
          <p className="text-sm text-neutral-300">This playlist has no tracks yet.</p>
          <p className="text-xs text-neutral-500">
            Use the menu button on any track in Library or Search to add tracks here.
          </p>
        </div>
      ) : (
        <div className="noir-card p-2 space-y-0.5">
          {playlistTracks.map((track, idx) => (
            <div
              key={`${track.id}-${idx}`}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== idx) {
                  void reorderPlaylistTracks(playlist.id, dragIdx, idx);
                }
                setDragIdx(null);
              }}
              className="flex items-center gap-1"
            >
              <div className="hidden sm:flex flex-col shrink-0">
                <button
                  onClick={() => idx > 0 && void reorderPlaylistTracks(playlist.id, idx, idx - 1)}
                  disabled={idx === 0}
                  aria-label="Move track up"
                  className="p-0.5 text-neutral-600 hover:text-neutral-200 disabled:opacity-20"
                >
                  <NoirIcon icon={ArrowUp} className="w-3 h-3" />
                </button>
                <button
                  onClick={() =>
                    idx < playlistTracks.length - 1 &&
                    void reorderPlaylistTracks(playlist.id, idx, idx + 1)
                  }
                  disabled={idx === playlistTracks.length - 1}
                  aria-label="Move track down"
                  className="p-0.5 text-neutral-600 hover:text-neutral-200 disabled:opacity-20"
                >
                  <NoirIcon icon={ArrowDown} className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <TrackRow
                  track={track}
                  index={idx}
                  queueContext={playlistTracks}
                  onRemoveFromPlaylist={() => void removeTrackFromPlaylist(playlist.id, track.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
