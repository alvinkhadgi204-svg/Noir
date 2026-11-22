import React from 'react';
import { ArrowDown, ArrowUp, Maximize2, Moon, Trash2, X } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';
import { VisualizerCanvas } from './VisualizerCanvas';

export const RightPanel: React.FC = () => {
  const rightPanelOpen = usePlayerStore((s) => s.rightPanelOpen);
  const tracks = usePlayerStore((s) => s.tracks);
  const queueIds = usePlayerStore((s) => s.queueIds);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const crossfadeSeconds = usePlayerStore((s) => s.crossfadeSeconds);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const sidebarPosition = usePlayerStore((s) => s.theme.sidebarPosition);

  if (!rightPanelOpen) return null;

  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;
  const currentIdx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
  const upNextEntries = queueIds
    .map((id, idx) => ({ id, idx, track: tracks.find((t) => t.id === id) }))
    .filter((entry) => entry.track && entry.idx > currentIdx);

  const borderClass = sidebarPosition === 'right' ? 'border-r border-white/[0.07]' : 'border-l border-white/[0.07]';

  return (
    <aside className={`hidden xl:flex flex-col w-80 h-full bg-[var(--noir-surface)] ${borderClass} shrink-0 select-none`}>
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06] shrink-0">
        <span className="text-sm font-semibold text-white">Now Playing</span>
        <button
          onClick={() => setNowPlayingOpen(true)}
          aria-label="Open full-screen now playing"
          title="Expand Now Playing"
          className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          <NoirIcon icon={Maximize2} className="w-4 h-4" />
        </button>
      </div>

      {/* Current Track Mini Showcase */}
      {currentTrack ? (
        <div className="p-4 border-b border-white/[0.06] space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <CoverArt src={currentTrack.artworkUrl} alt={currentTrack.title} size="md" isPlaying={isPlaying} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-neutral-400 truncate">{currentTrack.artist}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                {crossfadeSeconds === 0 ? 'Gapless' : `Crossfade ${crossfadeSeconds}s`}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)]/80 border border-white/[0.06] px-2 py-1.5">
            <VisualizerCanvas mode="cava" height={54} compact />
          </div>

          {sleepTimer.active && (
            <div className="flex items-center justify-between text-xs text-[var(--noir-accent)] px-1">
              <span className="flex items-center gap-1.5">
                <NoirIcon icon={Moon} className="w-3.5 h-3.5" />
                <span>Sleep Timer</span>
              </span>
              <span className="tabular-nums font-medium">
                {sleepTimer.mode === 'endOfTrack' ? 'End of track' : formatTime(sleepTimer.remainingSeconds)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-neutral-500 border-b border-white/[0.06]">
          Select any track to begin playback
        </div>
      )}

      {/* Up Next Queue */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs font-medium text-neutral-400">
          Up Next · <span className="tabular-nums">{upNextEntries.length}</span>
        </span>
        {upNextEntries.length > 0 && (
          <button
            onClick={clearQueue}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <NoirIcon icon={Trash2} className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1">
        {upNextEntries.length === 0 ? (
          <p className="px-3 py-6 text-xs text-neutral-500 text-center">
            Queue is clear. Add tracks from your library or search.
          </p>
        ) : (
          upNextEntries.map(({ id, idx, track }) => {
            if (!track) return null;
            return (
              <div
                key={`${id}-${idx}`}
                className="group flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--noir-btn-radius)] hover:bg-white/[0.04] transition-colors"
              >
                <button
                  onClick={() => void playTrack(track)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <CoverArt src={track.artworkUrl} alt={track.title} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-100 truncate">{track.title}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{track.artist}</p>
                  </div>
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > currentIdx + 1 && (
                    <button
                      onClick={() => reorderQueue(idx, idx - 1)}
                      aria-label="Move up"
                      className="p-1 text-neutral-400 hover:text-white"
                    >
                      <NoirIcon icon={ArrowUp} className="w-3 h-3" />
                    </button>
                  )}
                  {idx < queueIds.length - 1 && (
                    <button
                      onClick={() => reorderQueue(idx, idx + 1)}
                      aria-label="Move down"
                      className="p-1 text-neutral-400 hover:text-white"
                    >
                      <NoirIcon icon={ArrowDown} className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => removeFromQueue(id)}
                    aria-label="Remove from queue"
                    className="p-1 text-neutral-400 hover:text-red-400"
                  >
                    <NoirIcon icon={X} className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
