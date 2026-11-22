import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  CloudRain,
  Disc3,
  Heart,
  Leaf,
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { CavaColorMode, CavaStyle } from '../types/music';
import { formatTime, parseLrc } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';
import { VisualizerCanvas } from './VisualizerCanvas';

export const NowPlayingOverlay: React.FC = () => {
  const nowPlayingOpen = usePlayerStore((s) => s.nowPlayingOpen);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const visualizerMode = usePlayerStore((s) => s.visualizerMode);
  const crossfadeSeconds = usePlayerStore((s) => s.crossfadeSeconds);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const lyricsLoading = usePlayerStore((s) => s.lyricsLoading);
  const albumArtStyle = usePlayerStore((s) => s.theme.albumArtStyle);
  const animationSpeed = usePlayerStore((s) => s.theme.animationSpeed);
  const cavaStyle = usePlayerStore((s) => s.theme.cavaStyle);
  const cavaColorMode = usePlayerStore((s) => s.theme.cavaColorMode);
  const cavaPrimaryColor = usePlayerStore((s) => s.theme.cavaPrimaryColor);
  const cavaSecondaryColor = usePlayerStore((s) => s.theme.cavaSecondaryColor);
  const updateTheme = usePlayerStore((s) => s.updateTheme);
  const calmStudyMode = usePlayerStore((s) => s.calmStudyMode);
  const setCalmStudyMode = usePlayerStore((s) => s.setCalmStudyMode);
  const studyAmbience = usePlayerStore((s) => s.studyAmbience);
  const setStudyAmbience = usePlayerStore((s) => s.setStudyAmbience);
  const studyAmbienceVolume = usePlayerStore((s) => s.studyAmbienceVolume);
  const setStudyAmbienceVolume = usePlayerStore((s) => s.setStudyAmbienceVolume);
  const uselessFeatures = usePlayerStore((s) => s.uselessFeatures);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const setVisualizerMode = usePlayerStore((s) => s.setVisualizerMode);
  const setCrossfadeSeconds = usePlayerStore((s) => s.setCrossfadeSeconds);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const attachLyricsToTrack = usePlayerStore((s) => s.attachLyricsToTrack);

  const [showControls, setShowControls] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  // Calm Study Pomodoro Focus Timer
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusRemaining, setFocusRemaining] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);

  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const track = tracks.find((t) => t.id === currentTrackId) || null;
  const safeDuration = duration > 0 ? duration : track?.duration || 0;
  const progressPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  useEffect(() => {
    if (!focusRunning) return;
    const id = window.setInterval(() => {
      setFocusRemaining((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusRunning]);

  useEffect(() => {
    const onFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current || document.documentElement;
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore on unsupported mobile Safari
    }
  };

  const selectFocusPreset = (mins: number) => {
    setFocusRunning(false);
    setFocusMinutes(mins);
    setFocusRemaining(mins * 60);
  };

  const syncedLines = useMemo(() => {
    if (!track?.syncedLyrics) return [];
    return parseLrc(track.syncedLyrics);
  }, [track?.syncedLyrics]);

  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i += 1) {
      if (currentTime >= syncedLines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [syncedLines, currentTime]);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex]);

  const motionDur = animationSpeed === 0 ? 0.01 : 0.28 / animationSpeed;

  const handleSaveLyrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;
    const isSynced = /\[\d{1,2}:\d{2}/.test(lyricsDraft);
    await attachLyricsToTrack(track.id, isSynced ? lyricsDraft : null, lyricsDraft);
    setEditingLyrics(false);
  };

  return (
    <AnimatePresence>
      {nowPlayingOpen && track && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: motionDur }}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--noir-base)] overflow-hidden"
        >
          {/* Calm Breathing Study Aurora / Blurred Album Backdrop */}
          {calmStudyMode ? (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="aurora-study-breath absolute -top-1/4 -left-1/4 w-[85vw] h-[85vw] rounded-full blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(var(--noir-accent-rgb), 0.16) 0%, rgba(16, 40, 48, 0.22) 45%, transparent 72%)',
                }}
              />
              <div
                className="aurora-study-breath absolute -bottom-1/4 -right-1/4 w-[75vw] h-[75vw] rounded-full blur-3xl"
                style={{
                  animationDelay: '-5.5s',
                  background:
                    'radial-gradient(circle, rgba(30, 58, 95, 0.22) 0%, rgba(var(--noir-accent-rgb), 0.1) 45%, transparent 72%)',
                }}
              />
              {track.artworkUrl && (
                <img
                  src={track.artworkUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover scale-125 opacity-15 blur-3xl"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/60 to-[var(--noir-base)]" />
            </div>
          ) : albumArtStyle === 'blurred' && track.artworkUrl ? (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <img
                src={track.artworkUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-125 opacity-30"
                style={{ filter: 'blur(36px)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/75 to-[var(--noir-base)]" />
            </div>
          ) : (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--noir-accent) 14%, transparent), transparent 60%)',
              }}
            />
          )}

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between gap-2 px-4 sm:px-6 h-16 border-b border-white/[0.06] shrink-0">
            <button
              onClick={() => setNowPlayingOpen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            >
              <NoirIcon icon={ChevronDown} className="w-4 h-4" />
              <span className="hidden sm:inline">Minimize</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-[var(--noir-btn-radius)] shrink-0">
                <button
                  onClick={() => setCalmStudyMode(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    calmStudyMode
                      ? 'bg-[var(--noir-elevated)] text-[var(--noir-accent)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={Leaf} className="w-3.5 h-3.5" />
                  <span>Calm Study</span>
                </button>
                <button
                  onClick={() => setCalmStudyMode(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    !calmStudyMode
                      ? 'bg-[var(--noir-elevated)] text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>Studio</span>
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-[var(--noir-btn-radius)] shrink-0">
                <button
                  onClick={() => setVisualizerMode('cava')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    visualizerMode === 'cava'
                      ? 'bg-[var(--noir-elevated)] text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={BarChart3} className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CAVA</span>
                </button>
                <button
                  onClick={() => setVisualizerMode('circular')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    visualizerMode === 'circular'
                      ? 'bg-[var(--noir-elevated)] text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={Disc3} className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Spectrum</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void toggleBrowserFullscreen()}
                title={isNativeFullscreen ? 'Exit Fullscreen' : 'Enter Browser Fullscreen'}
                className="p-2 text-xs text-neutral-300 hover:text-white rounded-[var(--noir-btn-radius)] border border-white/10 transition-colors"
              >
                <NoirIcon icon={isNativeFullscreen ? Minimize : Maximize} className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowControls((s) => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--noir-btn-radius)] border transition-colors ${
                  showControls
                    ? 'border-[var(--noir-accent)] text-[var(--noir-accent)]'
                    : 'border-white/10 text-neutral-300 hover:text-white'
                }`}
              >
                <NoirIcon icon={SlidersHorizontal} className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Controls</span>
              </button>
            </div>
          </div>

          {/* Main Stage: Artwork + Visualizer + Calm Study Tools / Lyrics */}
          <div className="relative z-10 flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center overflow-y-auto">
            {/* Left Column: Art, Visualizer & Transport */}
            <div className="lg:col-span-6 flex flex-col items-center space-y-5">
              <motion.div
                animate={
                  uselessFeatures.zeroGravityArt
                    ? { y: [0, -10, 0], rotate: [0, 1.5, -1.5, 0] }
                    : calmStudyMode && isPlaying
                    ? { scale: [1, 1.015, 1] }
                    : { y: 0, rotate: 0, scale: 1 }
                }
                transition={
                  uselessFeatures.zeroGravityArt || calmStudyMode
                    ? { duration: 6, repeat: Infinity, ease: 'easeInOut' }
                    : undefined
                }
                className={uselessFeatures.vinylWobble && isPlaying ? 'aurora-vinyl-wobble' : ''}
              >
                {visualizerMode === 'circular' ? (
                  <div className="relative w-68 h-68 sm:w-80 sm:h-80 flex items-center justify-center">
                    <VisualizerCanvas mode="circular" height={320} className="absolute inset-0" />
                    <CoverArt
                      src={track.artworkUrl}
                      alt={track.title}
                      size="lg"
                      overrideStyle="circular"
                      isPlaying={isPlaying}
                      className="shadow-2xl"
                    />
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center space-y-5">
                    <CoverArt
                      src={track.artworkUrl}
                      alt={track.title}
                      size="xl"
                      isPlaying={isPlaying}
                      className="shadow-2xl"
                    />
                    <div
                      className={`w-full max-w-md rounded-[var(--noir-radius)] bg-black/35 border border-white/[0.08] px-3 py-2 transition-opacity ${
                        calmStudyMode ? 'opacity-75' : 'opacity-100'
                      }`}
                    >
                      <VisualizerCanvas mode="cava" height={72} />
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Title & Artist */}
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white truncate">
                    {track.title}
                  </h2>
                  <p className="text-sm text-neutral-400 truncate mt-0.5">
                    {track.artist} · {track.album}
                  </p>
                  {uselessFeatures.fakeEngineerTelemetry && (
                    <p className="text-[11px] font-mono text-[var(--noir-accent)] mt-1 tabular-nums">
                      THD+N: 0.0003% · Quantum Jitter: 0.41 ps · 6N Copper Gain
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void toggleFavorite(track.id)}
                  aria-label="Toggle favorite"
                  className={`p-2 rounded-md transition-colors ${
                    track.isFavorite ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={Heart} fillable={Boolean(track.isFavorite)} className="w-5 h-5" />
                </button>
              </motion.div>

              {/* Scrubber */}
              <div className="w-full max-w-md space-y-2">
                <div className="relative h-5 flex items-center">
                  <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
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
                <div className="flex items-center justify-between text-xs text-neutral-400 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(safeDuration)}</span>
                </div>
              </div>

              {/* Transport */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={toggleShuffle}
                  aria-label="Shuffle"
                  className={`p-2 transition-colors ${
                    shuffle ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={Shuffle} className="w-5 h-5" />
                </button>

                <button
                  onClick={() => void playPrev()}
                  aria-label="Previous"
                  className="p-2 text-neutral-200 hover:text-white transition-colors"
                >
                  <NoirIcon icon={SkipBack} fillable className="w-6 h-6" />
                </button>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => void togglePlay()}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-14 h-14 rounded-full bg-[var(--noir-accent)] text-black flex items-center justify-center shadow-xl"
                >
                  <NoirIcon icon={isPlaying ? Pause : Play} fillable className="w-6 h-6" />
                </motion.button>

                <button
                  onClick={() => void playNext()}
                  aria-label="Next"
                  className="p-2 text-neutral-200 hover:text-white transition-colors"
                >
                  <NoirIcon icon={SkipForward} fillable className="w-6 h-6" />
                </button>

                <button
                  onClick={cycleRepeat}
                  aria-label="Repeat"
                  className={`p-2 transition-colors ${
                    repeat !== 'off' ? 'text-[var(--noir-accent)]' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <NoirIcon icon={repeat === 'one' ? Repeat1 : Repeat} className="w-5 h-5" />
                </button>
              </div>

              {showControls && (
                <div className="w-full max-w-md noir-glass border border-white/10 rounded-[var(--noir-radius)] p-4 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Crossfade</span>
                        <span className="tabular-nums text-white">
                          {crossfadeSeconds === 0 ? 'Gapless' : `${crossfadeSeconds}s`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={0.5}
                        value={crossfadeSeconds}
                        onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
                        className="w-full accent-[var(--noir-accent)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Speed</span>
                        <span className="tabular-nums text-white">{playbackRate.toFixed(2)}×</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.05}
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(Number(e.target.value))}
                        className="w-full accent-[var(--noir-accent)]"
                      />
                    </div>
                  </div>

                  {/* Quick CAVA Style & Color Picker */}
                  <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 font-medium">CAVA Style</span>
                      <div className="flex flex-wrap gap-1">
                        {(['bars', 'mirror', 'wave', 'blocks', 'peaks', 'radial'] as CavaStyle[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => updateTheme({ cavaStyle: st })}
                            className={`px-2 py-0.5 capitalize rounded text-[11px] transition-colors ${
                              cavaStyle === st
                                ? 'bg-[var(--noir-accent)] text-black font-semibold'
                                : 'bg-white/[0.06] text-neutral-300 hover:text-white'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400 font-medium shrink-0">CAVA Color</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {(['accent', 'aurora', 'cyber', 'sunset', 'rainbow', 'monochrome', 'custom'] as CavaColorMode[]).map((cm) => (
                          <button
                            key={cm}
                            onClick={() => updateTheme({ cavaColorMode: cm })}
                            className={`px-2 py-0.5 capitalize rounded text-[11px] transition-colors ${
                              cavaColorMode === cm
                                ? 'bg-[var(--noir-accent)] text-black font-semibold'
                                : 'bg-white/[0.06] text-neutral-300 hover:text-white'
                            }`}
                          >
                            {cm === 'monochrome' ? 'mono' : cm}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cavaColorMode === 'custom' && (
                      <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-2 text-neutral-300">
                          <span>Base</span>
                          <input
                            type="color"
                            value={cavaPrimaryColor}
                            onChange={(e) => updateTheme({ cavaPrimaryColor: e.target.value })}
                            className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-neutral-300">
                          <span>Peak</span>
                          <input
                            type="color"
                            value={cavaSecondaryColor}
                            onChange={(e) => updateTheme({ cavaSecondaryColor: e.target.value })}
                            className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Calm Study Sanctuary (Focus Timer + Soundscape) + Lyrics */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              {calmStudyMode && (
                <div className="noir-glass border border-white/[0.08] rounded-[var(--noir-radius)] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <NoirIcon icon={Timer} className="w-4 h-4 text-[var(--noir-accent)]" />
                      <span className="text-xs font-semibold text-white">Study Focus Timer</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[15, 25, 50].map((m) => (
                        <button
                          key={m}
                          onClick={() => selectFocusPreset(m)}
                          className={`px-2 py-0.5 text-[11px] rounded border transition-colors tabular-nums ${
                            focusMinutes === m
                              ? 'border-[var(--noir-accent)] text-[var(--noir-accent)]'
                              : 'border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">
                      {formatTime(focusRemaining)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFocusRunning((r) => !r)}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--noir-accent)] text-black noir-btn"
                      >
                        {focusRunning ? 'Pause' : 'Start Focus'}
                      </button>
                      <button
                        onClick={() => selectFocusPreset(focusMinutes)}
                        aria-label="Reset study timer"
                        className="p-2 text-neutral-400 hover:text-white border border-white/10 noir-btn"
                      >
                        <NoirIcon icon={RotateCcw} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <NoirIcon icon={CloudRain} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
                      <span>Ambience</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'off', label: 'Off' },
                          { id: 'rain', label: 'Rain' },
                          { id: 'brown', label: 'Brown Noise' },
                          { id: 'lounge', label: 'Warm Hum' },
                        ] as const
                      ).map((amb) => (
                        <button
                          key={amb.id}
                          onClick={() => setStudyAmbience(amb.id)}
                          className={`px-2 py-1 text-[11px] rounded transition-colors ${
                            studyAmbience === amb.id
                              ? 'bg-[var(--noir-accent)] text-black font-semibold'
                              : 'bg-white/[0.05] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {amb.label}
                        </button>
                      ))}
                    </div>
                    {studyAmbience !== 'off' && (
                      <input
                        type="range"
                        min={0.05}
                        max={0.5}
                        step={0.02}
                        value={studyAmbienceVolume}
                        onChange={(e) => setStudyAmbienceVolume(Number(e.target.value))}
                        aria-label="Ambient study noise volume"
                        className="w-24 accent-[var(--noir-accent)]"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Synced Lyrics Panel */}
              <div
                className={`${
                  calmStudyMode ? 'h-[280px] lg:h-[340px]' : 'h-[420px] lg:h-[540px]'
                } noir-glass border border-white/[0.08] rounded-[var(--noir-radius)] p-5 sm:p-6 flex flex-col`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Lyrics</h3>
                    <p className="text-xs text-neutral-400">
                      {syncedLines.length > 0
                        ? 'Synced · Click any line to seek'
                        : track.plainLyrics
                        ? 'Plain text lyrics'
                        : 'Peaceful instrumental / No lyrics'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setLyricsDraft(track.syncedLyrics || track.plainLyrics || '');
                      setEditingLyrics((v) => !v);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn"
                  >
                    {editingLyrics ? 'Cancel' : 'Edit / Paste LRC'}
                  </button>
                </div>

                {editingLyrics ? (
                  <form onSubmit={(e) => void handleSaveLyrics(e)} className="flex-1 flex flex-col pt-3 gap-3">
                    <textarea
                      value={lyricsDraft}
                      onChange={(e) => setLyricsDraft(e.target.value)}
                      placeholder="Paste [00:12.40] synced LRC or plain lyrics..."
                      className="flex-1 w-full p-3 text-xs font-mono bg-[var(--noir-base)] border border-white/15 rounded-[var(--noir-btn-radius)] text-neutral-200 focus:outline-none focus:border-[var(--noir-accent)] resize-none"
                    />
                    <button
                      type="submit"
                      className="self-end px-4 py-2 text-xs font-semibold bg-[var(--noir-accent)] text-black noir-btn"
                    >
                      Save Lyrics
                    </button>
                  </form>
                ) : (
                  <div className="flex-1 overflow-y-auto pt-4 pr-2 space-y-2.5">
                    {lyricsLoading ? (
                      <div className="space-y-3 py-6">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <div key={n} className="h-5 w-3/4 rounded bg-white/[0.05] animate-pulse" />
                        ))}
                      </div>
                    ) : syncedLines.length > 0 ? (
                      syncedLines.map((line, idx) => {
                        const isActive = idx === activeLineIndex;
                        return (
                          <button
                            key={`${line.time}-${idx}`}
                            ref={isActive ? activeLineRef : undefined}
                            onClick={() => seek(line.time)}
                            className={`block w-full text-left py-1.5 text-base sm:text-lg leading-snug transition-all duration-300 ${
                              isActive
                                ? 'text-[var(--noir-accent)] font-semibold scale-[1.01] origin-left'
                                : idx < activeLineIndex
                                ? 'text-neutral-500 hover:text-neutral-300'
                                : 'text-neutral-300 hover:text-white'
                            }`}
                          >
                            {line.text}
                          </button>
                        );
                      })
                    ) : track.plainLyrics ? (
                      <p className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
                        {track.plainLyrics}
                      </p>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-xs text-neutral-500 space-y-2">
                        <p>Breathe and stay focused — no lyrics loaded for this track.</p>
                        <p>Click &quot;Edit / Paste LRC&quot; above if you want to add your own.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
