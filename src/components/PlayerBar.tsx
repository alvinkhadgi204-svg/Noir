import React, { useState } from 'react';
import {
  Heart,
  ListMusic,
  Maximize2,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';

export const PlayerBar: React.FC = () => {
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);

  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const playerBarPosition = usePlayerStore((s) => s.theme.playerBarPosition);
  const rightPanelOpen = usePlayerStore((s) => s.rightPanelOpen);
  const fakeEngineerTelemetry = usePlayerStore((s) => s.uselessFeatures.fakeEngineerTelemetry);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const setCalmStudyMode = usePlayerStore((s) => s.setCalmStudyMode);
  const toggleRightPanel = usePlayerStore((s) => s.toggleRightPanel);

  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;
  const safeDuration = duration > 0 ? duration : currentTrack?.duration || 0;
  const progressPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  const isFloating = playerBarPosition === 'floating';

  return (
    <div
      className={
        isFloating
          ? 'px-2 sm:px-6 pb-3 pb-safe pt-1 shrink-0 pointer-events-none'
          : 'shrink-0 border-t border-white/[0.07] bg-[var(--noir-surface)] pb-safe'
      }
    >
      <div
        className={
          isFloating
            ? 'pointer-events-auto max-w-6xl mx-auto noir-glass border border-white/15 rounded-[var(--noir-radius)] px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xl flex items-center justify-between gap-2 sm:gap-4'
            : 'px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4'
        }
      >
        {/* Left: Track Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-none md:w-56 lg:w-64">
          {currentTrack ? (
            <>
              <button
                onClick={() => setNowPlayingOpen(true)}
                aria-label="Open full-screen player"
                className="shrink-0 group relative"
              >
                <CoverArt src={currentTrack.artworkUrl} alt={currentTrack.title} size="sm" isPlaying={isPlaying} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => setNowPlayingOpen(true)}
                  className="block w-full text-left text-xs sm:text-sm font-medium text-white truncate hover:text-[var(--noir-accent)] transition-colors"
                >
                  {currentTrack.title}
                </button>
                <p className="text-[11px] sm:text-xs text-neutral-400 truncate">
                  {currentTrack.artist}
                  {fakeEngineerTelemetry && ' · 0.4ps Jitter'}
                </p>
              </div>
              <button
                onClick={() => void toggleFavorite(currentTrack.id)}
                aria-label={currentTrack.isFavorite ? 'Remove favorite' : 'Favorite track'}
                className={`hidden sm:flex p-1.5 rounded-md transition-colors shrink-0 ${
                  currentTrack.isFavorite ? 'text-[var(--noir-accent)]' : 'text-neutral-500 hover:text-neutral-200'
                }`}
              >
                <NoirIcon icon={Heart} fillable={Boolean(currentTrack.isFavorite)} className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="text-xs text-neutral-500">No track loaded</div>
          )}
        </div>

        {/* Center: Transport + Progress */}
        <div className="shrink-0 md:flex-1 max-w-xl flex flex-col items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-4">
            <button
              onClick={toggleShuffle}
              aria-label="Toggle shuffle"
              className={`hidden sm:flex p-1.5 rounded-md transition-colors ${
                shuffle ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <NoirIcon icon={Shuffle} className="w-4 h-4" />
            </button>

            <button
              onClick={() => void playPrev()}
              aria-label="Previous track"
              className="p-2 sm:p-1.5 text-neutral-300 hover:text-white transition-colors"
            >
              <NoirIcon icon={SkipBack} fillable className="w-4 h-4" />
            </button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08 }}
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={`w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[var(--noir-accent)] text-black flex items-center justify-center shadow-md transition-shadow ${
                isPlaying ? 'shadow-[0_0_20px_rgba(var(--noir-accent-rgb),0.45)]' : ''
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isPlaying ? 'pause' : 'play'}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="flex items-center justify-center"
                >
                  <NoirIcon icon={isPlaying ? Pause : Play} fillable className="w-4 h-4" />
                </motion.span>
              </AnimatePresence>
            </motion.button>

            <button
              onClick={() => void playNext()}
              aria-label="Next track"
              className="p-2 sm:p-1.5 text-neutral-300 hover:text-white transition-colors"
            >
              <NoirIcon icon={SkipForward} fillable className="w-4 h-4" />
            </button>

            <button
              onClick={cycleRepeat}
              aria-label={`Repeat mode: ${repeat}`}
              title={`Repeat: ${repeat}`}
              className={`hidden sm:flex p-1.5 rounded-md transition-colors ${
                repeat !== 'off' ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <NoirIcon icon={repeat === 'one' ? Repeat1 : Repeat} className="w-4 h-4" />
            </button>
          </div>

          {/* Scrub Bar */}
          <div className="hidden sm:flex w-full items-center gap-2.5">
            <span className="text-[11px] text-neutral-400 tabular-nums w-9 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 h-4 flex items-center group">
              <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--noir-accent)] transition-[width] duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={safeDuration || 100}
                step={0.1}
                value={Math.min(currentTime, safeDuration || 100)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek timeline"
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[11px] text-neutral-400 tabular-nums w-9">
              {formatTime(safeDuration)}
            </span>
          </div>
        </div>

        {/* Mobile quick expand button */}
        <button
          onClick={() => setNowPlayingOpen(true)}
          aria-label="Expand Now Playing"
          className="md:hidden p-2 text-neutral-300 hover:text-white shrink-0"
        >
          <NoirIcon icon={Maximize2} className="w-4 h-4" />
        </button>

        {/* Right: Sleep Timer, Volume, Queue, Expand */}
        <div className="hidden md:flex items-center justify-end gap-2 w-56 sm:w-64">
          {/* Sleep timer */}
          <div className="relative">
            <button
              onClick={() => setSleepMenuOpen((o) => !o)}
              aria-label="Sleep timer"
              title="Sleep Timer"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                sleepTimer.active
                  ? 'text-[var(--noir-accent)] bg-white/10'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <NoirIcon icon={Moon} className="w-4 h-4" />
              {sleepTimer.active && (
                <span className="tabular-nums text-[11px]">
                  {sleepTimer.mode === 'endOfTrack' ? 'Track' : formatTime(sleepTimer.remainingSeconds)}
                </span>
              )}
            </button>

            {sleepMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSleepMenuOpen(false)} />
                <div className="absolute right-0 bottom-11 z-40 w-44 noir-glass border border-white/15 rounded-[var(--noir-radius)] p-1.5 shadow-2xl text-xs">
                  <p className="px-2.5 py-1 text-[11px] text-neutral-400">Sleep Timer</p>
                  {[
                    { label: 'Off', val: 'off' as const },
                    { label: '15 minutes', val: 15 },
                    { label: '30 minutes', val: 30 },
                    { label: '45 minutes', val: 45 },
                    { label: '60 minutes', val: 60 },
                    { label: 'End of track', val: 'endOfTrack' as const },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      onClick={() => {
                        setSleepTimer(opt.val);
                        setSleepMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-neutral-200 hover:bg-white/10"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Volume */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <NoirIcon icon={isMuted || volume === 0 ? VolumeX : Volume2} className="w-4 h-4" />
          </button>
          <div className="relative w-20 h-4 flex items-center">
            <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-200"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>

          <button
            onClick={toggleRightPanel}
            aria-label="Toggle queue"
            className={`hidden xl:flex p-1.5 rounded-md transition-colors ${
              rightPanelOpen ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <NoirIcon icon={ListMusic} className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (!currentTrack) setCalmStudyMode(true);
              setNowPlayingOpen(true);
            }}
            aria-label="Expand Now Playing"
            title="Fullscreen / Calm Study Mode"
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <NoirIcon icon={Maximize2} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
