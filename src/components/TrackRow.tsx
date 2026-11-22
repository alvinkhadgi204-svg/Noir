import React, { useState } from 'react';
import { Heart, ListPlus, MoreHorizontal, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/music';
import { formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';

interface TrackRowProps {
  track: Track;
  index: number;
  queueContext?: Track[];
  onRemoveFromPlaylist?: () => void;
  showSourceMeta?: boolean;
}

const SOURCE_LABELS: Record<Track['source'], string> = {
  local: 'Local File',
  url: 'Direct URL',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  spotify: 'Spotify Link',
  audius: 'Audius',
  itunes: 'Catalog Preview',
};

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  queueContext,
  onRemoveFromPlaylist,
  showSourceMeta = true,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNextInQueue = usePlayerStore((s) => s.playNextInQueue);
  const playlists = usePlayerStore((s) => s.playlists);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const removeTrack = usePlayerStore((s) => s.removeTrack);

  const isCurrent = currentTrackId === track.id;

  const handlePrimaryClick = () => {
    if (isCurrent) {
      void togglePlay();
    } else {
      void playTrack(track, queueContext);
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.992 }}
      transition={{ duration: 0.12 }}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-[var(--noir-btn-radius)] transition-colors duration-150 ${
        isCurrent
          ? 'bg-white/[0.08] shadow-[inset_2px_0_0_var(--noir-accent)]'
          : 'hover:bg-white/[0.04]'
      }`}
    >
      {/* Index / Mini Equalizer / Play button */}
      <button
        onClick={handlePrimaryClick}
        aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        className="w-8 h-8 flex items-center justify-center shrink-0 text-xs tabular-nums text-neutral-400 hover:text-white transition-colors"
      >
        <span className={`${isCurrent ? 'text-[var(--noir-accent)] font-semibold' : ''} group-hover:hidden flex items-end justify-center`}>
          {isCurrent && isPlaying ? (
            <span className="flex items-end gap-[2px] h-3.5" aria-hidden="true">
              <span className="w-[2.5px] h-full rounded-full bg-[var(--noir-accent)] noir-eq-bar" style={{ animationDelay: '0ms' }} />
              <span className="w-[2.5px] h-full rounded-full bg-[var(--noir-accent)] noir-eq-bar" style={{ animationDelay: '180ms' }} />
              <span className="w-[2.5px] h-full rounded-full bg-[var(--noir-accent)] noir-eq-bar" style={{ animationDelay: '340ms' }} />
            </span>
          ) : (
            index + 1
          )}
        </span>
        <span className="hidden group-hover:flex items-center justify-center text-white">
          <NoirIcon
            icon={isCurrent && isPlaying ? Pause : Play}
            fillable
            className="w-4 h-4"
          />
        </span>
      </button>

      {/* Artwork & Title */}
      <div
        onClick={handlePrimaryClick}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
      >
        <CoverArt src={track.artworkUrl} alt={track.title} size="xs" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium truncate ${
              isCurrent ? 'text-[var(--noir-accent)]' : 'text-neutral-100'
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-neutral-400 truncate">
            <span>{track.artist}</span>
            {track.album && (
              <>
                <span className="mx-1.5 text-neutral-600" aria-hidden="true">·</span>
                <span>{track.album}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Unboxed technical / source metadata */}
      {showSourceMeta && (
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
          <span>{SOURCE_LABELS[track.source]}</span>
          {track.format && (
            <>
              <span aria-hidden="true">·</span>
              <span>{track.format}</span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => void toggleFavorite(track.id)}
          aria-label={track.isFavorite ? 'Remove from favorites' : 'Favorite track'}
          className={`p-2 rounded-md transition-colors ${
            track.isFavorite
              ? 'text-[var(--noir-accent)]'
              : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-neutral-200'
          }`}
        >
          <NoirIcon icon={Heart} fillable={Boolean(track.isFavorite)} className="w-4 h-4" />
        </button>

        <span className="w-12 text-right text-xs text-neutral-400 tabular-nums">
          {formatTime(track.duration)}
        </span>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Track options"
            className="p-2 text-neutral-400 hover:text-white rounded-md transition-colors"
          >
            <NoirIcon icon={MoreHorizontal} className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-52 noir-glass border border-white/10 rounded-[var(--noir-radius)] p-1.5 shadow-2xl text-xs">
                <button
                  onClick={() => {
                    playNextInQueue(track);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-neutral-200 hover:bg-white/10 rounded-md"
                >
                  <NoirIcon icon={ListPlus} className="w-3.5 h-3.5" />
                  <span>Play Next</span>
                </button>
                <button
                  onClick={() => {
                    addToQueue(track);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-neutral-200 hover:bg-white/10 rounded-md"
                >
                  <NoirIcon icon={Plus} className="w-3.5 h-3.5" />
                  <span>Add to Queue</span>
                </button>

                {playlists.length > 0 && (
                  <div className="my-1 border-t border-white/10 pt-1">
                    <p className="px-2.5 py-1 text-[11px] text-neutral-500">Add to Playlist</p>
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => {
                          void addTrackToPlaylist(pl.id, track.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-neutral-300 hover:bg-white/10 rounded-md truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                )}

                {onRemoveFromPlaylist && (
                  <button
                    onClick={() => {
                      onRemoveFromPlaylist();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-red-400 hover:bg-white/10 rounded-md border-t border-white/10 mt-1"
                  >
                    <NoirIcon icon={Trash2} className="w-3.5 h-3.5" />
                    <span>Remove from Playlist</span>
                  </button>
                )}

                {!onRemoveFromPlaylist && (
                  <button
                    onClick={() => {
                      void removeTrack(track.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-red-400 hover:bg-white/10 rounded-md border-t border-white/10 mt-1"
                  >
                    <NoirIcon icon={Trash2} className="w-3.5 h-3.5" />
                    <span>Delete from Library</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
