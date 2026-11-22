import { create } from 'zustand';
import { audioEngine } from '../audio/AudioEngine';
import {
  DEFAULT_EQ,
  DEFAULT_THEME,
  deletePlaylistFromDb,
  deleteTrackFromDb,
  loadAllPlaylistsFromDb,
  loadAllTracksFromDb,
  loadAutoUpdatePref,
  loadEqFromStorage,
  loadPrefsFromStorage,
  loadSavedThemesFromStorage,
  loadThemeFromStorage,
  loadUselessFeaturesFromStorage,
  loadUsernameFromStorage,
  saveAutoUpdatePref,
  saveCustomThemesToStorage,
  saveEqToStorage,
  savePlaylistToDb,
  savePrefsToStorage,
  saveThemeToStorage,
  saveTrackToDb,
  saveTracksBatchToDb,
  saveUselessFeaturesToStorage,
  saveUsernameToStorage,
} from '../db/storage';
import type {
  AppView,
  EqSettings,
  Playlist,
  RepeatMode,
  SavedThemePreset,
  SleepTimerState,
  SpotifyDownloadLog,
  SpotifyPlaylistItem,
  SpotifyTrackItem,
  SpotifyUserProfile,
  ThemeConfig,
  Track,
  UselessFeaturesConfig,
  VisualizerMode,
} from '../types/music';
import { isSupportedAudioFile, parseLocalAudioFile } from '../utils/localFiles';

export const APP_VERSION = '2.5.0';

export function sortTracksAZ(list: Track[]): Track[] {
  return [...list].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}

const SPOTIFY_WATCH_KEY = 'noir-spotify-watch-v1';
const SPOTIFY_WATCH_ENABLED_KEY = 'noir-spotify-watch-enabled-v1';
const SPOTIFY_AUTOSAVE_DEVICE_KEY = 'noir-spotify-autosave-device-v1';
const SPOTIFY_KNOWN_KEY = 'noir-spotify-known-v1';

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `${r}, ${g}, ${b}`;
    }
  }
  return '34, 197, 94';
}

export function applyThemeToDom(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--noir-base', theme.baseBg);
  root.style.setProperty('--noir-surface', theme.surfaceBg);
  root.style.setProperty('--noir-elevated', theme.elevatedBg);
  root.style.setProperty('--noir-accent', theme.accentColor);
  root.style.setProperty('--noir-accent-rgb', hexToRgbString(theme.accentColor));

  const fontMap: Record<string, string> = {
    'Plus Jakarta Sans': `'Plus Jakarta Sans', system-ui, sans-serif`,
    Satoshi: `'Satoshi', 'Plus Jakarta Sans', system-ui, sans-serif`,
    'Space Grotesk': `'Space Grotesk', system-ui, sans-serif`,
    'Playfair Display': `'Playfair Display', Georgia, serif`,
    'JetBrains Mono': `'JetBrains Mono', ui-monospace, monospace`,
    Outfit: `'Outfit', system-ui, sans-serif`,
    Syne: `'Syne', system-ui, sans-serif`,
    Inter: `'Inter', system-ui, sans-serif`,
    'DM Sans': `'DM Sans', system-ui, sans-serif`,
    Manrope: `'Manrope', system-ui, sans-serif`,
  };
  const chosenFont = (theme.fontFamily || 'Plus Jakarta Sans').trim();
  if (chosenFont && !fontMap[chosenFont]) {
    const safeFamily = chosenFont.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    if (safeFamily) {
      let gfLink = document.getElementById('noir-dynamic-font') as HTMLLinkElement | null;
      if (!gfLink) {
        gfLink = document.createElement('link');
        gfLink.id = 'noir-dynamic-font';
        gfLink.rel = 'stylesheet';
        document.head.appendChild(gfLink);
      }
      gfLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeFamily).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
    }
  }
  const safeCssFont = chosenFont.replace(/["';{}]/g, '');
  const cssFontValue = fontMap[chosenFont] || `'${safeCssFont}', 'Plus Jakarta Sans', system-ui, sans-serif`;
  root.style.setProperty('--noir-font', cssFontValue);

  const scaleMap: Record<string, string> = { S: '0.9', M: '1', L: '1.1', XL: '1.2' };
  root.style.setProperty('--noir-font-scale', scaleMap[theme.fontScale] || '1');
  root.style.setProperty('--noir-radius', `${theme.cornerRadius}px`);
  root.style.setProperty('--noir-btn-radius', `${Math.max(4, Math.round(theme.cornerRadius * 0.66))}px`);
  root.style.setProperty('--noir-blur', `${theme.blurIntensity}px`);
  root.style.setProperty('--noir-motion-scale', String(theme.animationSpeed));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme.baseBg);
  }

  let styleEl = document.getElementById('noir-custom-css') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'noir-custom-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = theme.customCss || '';
}

export const EQ_PRESETS: Record<string, [number, number, number, number, number]> = {
  Flat: [0, 0, 0, 0, 0],
  'Warm Vinyl': [4, 2, -1, -2, -3],
  'Late Night Bass': [6, 3, -1, 1, 2],
  'Vocal Clarity': [-2, -1, 3, 4, 2],
  'Studio Reference': [1, 0, 0, 2, 3],
};

interface PlayerState {
  // Library & Playlists
  tracks: Track[];
  playlists: Playlist[];
  initialized: boolean;

  // Queue & Playback
  queueIds: string[];
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  crossfadeSeconds: number;
  playbackRate: number;
  abLoop: { a: number | null; b: number | null };
  visualizerMode: VisualizerMode;

  // Lyrics
  lyricsLoading: boolean;

  // Sleep Timer
  sleepTimer: SleepTimerState;

  // Customization & EQ
  theme: ThemeConfig;
  eq: EqSettings;

  // Navigation & Overlays
  activeView: AppView;
  activePlaylistId: string | null;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  nowPlayingOpen: boolean;
  themeEditorOpen: boolean;
  urlImportOpen: boolean;

  // Global search, upload progress & toast
  searchQuery: string;
  uploadProgress: { active: boolean; done: number; total: number };
  toast: { id: number; message: string; tone?: 'info' | 'error' | 'success' } | null;

  // Profile / Onboarding
  username: string;
  hasCompletedOnboarding: boolean;
  setUsername: (name: string) => void;

  // Calm Study Fullscreen Mode
  calmStudyMode: boolean;
  studyAmbience: 'off' | 'rain' | 'brown' | 'lounge';
  studyAmbienceVolume: number;
  setCalmStudyMode: (enabled: boolean) => void;
  setStudyAmbience: (mode: 'off' | 'rain' | 'brown' | 'lounge') => void;
  setStudyAmbienceVolume: (vol: number) => void;

  // Custom Saved Themes & Settings-Gated Features
  savedThemes: SavedThemePreset[];
  saveCustomTheme: (name: string) => void;
  deleteCustomTheme: (id: string) => void;
  uselessFeatures: UselessFeaturesConfig;
  toggleUselessFeature: (key: keyof UselessFeaturesConfig) => void;
  resetUselessFeatures: () => void;

  // Self-Updating System
  appVersion: string;
  autoUpdateEnabled: boolean;
  updateAvailable: boolean;
  checkingUpdate: boolean;
  lastCheckedAt: number | null;
  latestReleaseNotes: string[];
  setAutoUpdateEnabled: (enabled: boolean) => void;
  checkForAppUpdate: (silent?: boolean) => Promise<boolean>;
  applySelfUpdate: () => Promise<void>;

  // Actions
  init: () => Promise<void>;
  showToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
  setActiveView: (view: AppView, playlistId?: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  setThemeEditorOpen: (open: boolean) => void;
  setUrlImportOpen: (open: boolean) => void;

  // Playback actions
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCrossfadeSeconds: (sec: number) => void;
  setPlaybackRate: (rate: number) => void;
  setAbLoopPoint: (which: 'a' | 'b' | 'clear') => void;
  setVisualizerMode: (mode: VisualizerMode) => void;

  // Queue actions
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  reorderQueue: (fromIdx: number, toIdx: number) => void;
  clearQueue: () => void;

  // Library & Local File actions
  importLocalFiles: (files: FileList | File[]) => Promise<number>;
  addExternalTrack: (track: Track, playImmediately?: boolean) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
  attachLyricsToTrack: (trackId: string, syncedLyrics: string | null, plainLyrics: string | null) => Promise<void>;
  fetchLyricsForTrack: (track: Track) => Promise<void>;

  // Playlist actions
  createPlaylist: (name: string, description?: string, initialTrackId?: string) => Promise<Playlist>;
  renamePlaylist: (playlistId: string, name: string, description?: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  togglePinPlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, fromIdx: number, toIdx: number) => Promise<void>;
  sortPlaylistAZ: (playlistId: string) => Promise<void>;
  getShareUrl: (playlistId: string) => string;

  // Sleep Timer
  setSleepTimer: (minutes: number | 'endOfTrack' | 'off') => void;

  // Theme & EQ
  updateTheme: (patch: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
  importThemeJson: (jsonStr: string) => boolean;
  updateEq: (patch: Partial<EqSettings>) => void;
  applyEqPreset: (presetName: string) => void;

  // Spotify OAuth & Auto-Download Sync (token held in memory only)
  spotifySessionToken: string | null;
  spotifyConfigured: boolean;
  spotifyRedirectUri: string;
  spotifyConnected: boolean;
  spotifyUser: SpotifyUserProfile | null;
  spotifyPlaylists: SpotifyPlaylistItem[];
  watchedPlaylistIds: string[];
  spotifyWatchEnabled: boolean;
  autoSaveDeviceDownloads: boolean;
  knownSpotifyTracks: Record<string, string[]>;
  spotifySyncing: boolean;
  spotifyLastSyncedAt: number | null;
  spotifyDownloadLogs: SpotifyDownloadLog[];

  fetchSpotifyStatus: () => Promise<void>;
  connectSpotify: (customClientId?: string) => Promise<void>;
  completeSpotifyAuth: (sessionToken: string) => Promise<void>;
  disconnectSpotify: () => Promise<void>;
  fetchSpotifyPlaylists: () => Promise<void>;
  toggleWatchPlaylist: (playlist: SpotifyPlaylistItem) => Promise<void>;
  setSpotifyWatchEnabled: (enabled: boolean) => void;
  setAutoSaveDeviceDownloads: (enabled: boolean) => void;
  syncWatchedPlaylists: (downloadExistingIfEmpty?: boolean) => Promise<void>;
  downloadSpotifyTrack: (item: SpotifyTrackItem, playlistName: string, mirrorPlaylistId?: string) => Promise<void>;
}

let sleepIntervalId: number | null = null;
let toastTimerId: number | null = null;

function computeNextTrackId(state: PlayerState): string | null {
  const { queueIds, currentTrackId, shuffle, repeat } = state;
  if (queueIds.length === 0) return null;
  if (repeat === 'one' && currentTrackId) return currentTrackId;
  const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
  if (shuffle && queueIds.length > 1) {
    const candidates = queueIds.filter((id) => id !== currentTrackId);
    return candidates[Math.floor(Math.random() * candidates.length)] || queueIds[0];
  }
  if (idx >= 0 && idx + 1 < queueIds.length) {
    return queueIds[idx + 1];
  }
  if (repeat === 'all') {
    return queueIds[0];
  }
  return null;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  const initialTheme = loadThemeFromStorage();
  const initialEq = loadEqFromStorage();
  const initialPrefs = loadPrefsFromStorage();

  applyThemeToDom(initialTheme);
  audioEngine.setVolume(initialPrefs.volume, false);
  audioEngine.setCrossfadeSeconds(initialPrefs.crossfadeSeconds);
  audioEngine.setPlaybackRate(initialPrefs.playbackRate);
  audioEngine.setEq(initialEq);

  return {
    tracks: [],
    playlists: [],
    initialized: false,

    queueIds: [],
    currentTrackId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: initialPrefs.volume,
    isMuted: false,
    shuffle: initialPrefs.shuffle,
    repeat: initialPrefs.repeat,
    crossfadeSeconds: initialPrefs.crossfadeSeconds,
    playbackRate: initialPrefs.playbackRate,
    abLoop: { a: null, b: null },
    visualizerMode: initialPrefs.visualizerMode,

    lyricsLoading: false,

    sleepTimer: {
      active: false,
      mode: 'minutes',
      endTimestamp: null,
      remainingSeconds: 0,
    },

    theme: initialTheme,
    eq: initialEq,

    activeView: 'home',
    activePlaylistId: null,
    sidebarCollapsed: false,
    rightPanelOpen: initialPrefs.rightPanelOpen,
    nowPlayingOpen: false,
    themeEditorOpen: false,
    urlImportOpen: false,

    searchQuery: '',
    uploadProgress: { active: false, done: 0, total: 0 },
    toast: null,

    username: loadUsernameFromStorage(),
    hasCompletedOnboarding: Boolean(loadUsernameFromStorage()),

    calmStudyMode: true,
    studyAmbience: 'off',
    studyAmbienceVolume: 0.2,

    savedThemes: loadSavedThemesFromStorage(),
    uselessFeatures: loadUselessFeaturesFromStorage(),

    appVersion: APP_VERSION,
    autoUpdateEnabled: loadAutoUpdatePref(),
    updateAvailable: false,
    checkingUpdate: false,
    lastCheckedAt: null,
    latestReleaseNotes: [
      'Calm Study fullscreen mode with ambient soundscapes & Pomodoro timer',
      'Samsung Now Bar media session lock-screen synchronization',
      'Parallel batched local audio imports for faster mobile uploads',
      'Custom saved themes, spring animations & cross-platform app packages',
    ],

    spotifySessionToken: null,
    spotifyConfigured: false,
    spotifyRedirectUri: '',
    spotifyConnected: false,
    spotifyUser: null,
    spotifyPlaylists: [],
    watchedPlaylistIds: readJsonStorage<string[]>(SPOTIFY_WATCH_KEY, []),
    spotifyWatchEnabled: readJsonStorage<boolean>(SPOTIFY_WATCH_ENABLED_KEY, true),
    autoSaveDeviceDownloads: readJsonStorage<boolean>(SPOTIFY_AUTOSAVE_DEVICE_KEY, false),
    knownSpotifyTracks: readJsonStorage<Record<string, string[]>>(SPOTIFY_KNOWN_KEY, {}),
    spotifySyncing: false,
    spotifyLastSyncedAt: null,
    spotifyDownloadLogs: [],

    showToast: (message, tone = 'info') => {
      if (toastTimerId) window.clearTimeout(toastTimerId);
      const id = Date.now();
      set({ toast: { id, message, tone } });
      toastTimerId = window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3600);
    },

    init: async () => {
      if (get().initialized) return;

      audioEngine.setCallbacks({
        onTimeUpdate: (time, dur) => {
          const state = get();
          const curTrack = state.currentTrackId
            ? state.tracks.find((t) => t.id === state.currentTrackId)
            : undefined;
          let updatedTracks = state.tracks;
          if (dur > 0 && curTrack && (!curTrack.duration || curTrack.duration === 0)) {
            const fixed = { ...curTrack, duration: Math.round(dur) };
            updatedTracks = state.tracks.map((t) => (t.id === fixed.id ? fixed : t));
            void saveTrackToDb(fixed);
          }
          set({
            tracks: updatedTracks,
            currentTime: time,
            duration: dur > 0 ? dur : state.duration,
          });
          // Preload next track when < 12s remain for seamless gapless / crossfade
          if (dur > 0 && dur - time <= 12) {
            const nextId = computeNextTrackId(state);
            const nextTrack = nextId ? state.tracks.find((t) => t.id === nextId) || null : null;
            audioEngine.preloadNext(nextTrack);
          }
        },
        onTrackEnded: () => {
          const state = get();
          if (state.sleepTimer.active && state.sleepTimer.mode === 'endOfTrack') {
            set({
              isPlaying: false,
              sleepTimer: { active: false, mode: 'minutes', endTimestamp: null, remainingSeconds: 0 },
            });
            state.showToast('Sleep timer ended playback');
            return;
          }
          void state.playNext();
        },
        onCrossfadeTriggered: (nextTrack) => {
          set({
            currentTrackId: nextTrack.id,
            currentTime: 0,
            duration: nextTrack.duration || 0,
            isPlaying: true,
            abLoop: { a: null, b: null },
          });
          audioEngine.setAbLoop(null, null);
          void get().fetchLyricsForTrack(nextTrack);
        },
        onPlaybackError: (msg) => {
          set({ isPlaying: false });
          get().showToast(msg, 'error');
        },
        onNextAction: () => void get().playNext(),
        onPrevAction: () => void get().playPrev(),
        onPlayStateChange: (playing) => set({ isPlaying: playing }),
      });

      const [savedTracks, savedPlaylists] = await Promise.all([
        loadAllTracksFromDb(),
        loadAllPlaylistsFromDb(),
      ]);

      // Load user tracks & purge any legacy built-in AI tracks from IndexedDB
      const trackMap = new Map<string, Track>();
      for (const st of savedTracks) {
        const isLegacyBuiltin = st.id.startsWith('noir-builtin-') || (st.source as string) === 'builtin';
        if (isLegacyBuiltin) {
          void deleteTrackFromDb(st.id);
          continue;
        }
        trackMap.set(st.id, st);
      }

      const playlistMap = new Map<string, Playlist>();
      for (const sp of savedPlaylists) {
        const cleanedIds = sp.trackIds.filter((id) => !id.startsWith('noir-builtin-') && trackMap.has(id));
        const isLegacyDefault =
          (sp.id === 'pl-after-hours' || sp.id === 'pl-analog-study') && cleanedIds.length === 0;
        if (isLegacyDefault) {
          void deletePlaylistFromDb(sp.id);
          continue;
        }
        const cleanedPl =
          cleanedIds.length !== sp.trackIds.length ? { ...sp, trackIds: cleanedIds } : sp;
        if (cleanedIds.length !== sp.trackIds.length) {
          void savePlaylistToDb(cleanedPl);
        }
        playlistMap.set(cleanedPl.id, cleanedPl);
      }

      // Check for shared playlist hash in URL (#playlist=...)
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#playlist=')) {
        try {
          const encoded = window.location.hash.slice('#playlist='.length);
          const decoded = JSON.parse(decodeURIComponent(atob(encoded))) as {
            name: string;
            description?: string;
            tracks: Track[];
          };
          if (decoded && decoded.name && Array.isArray(decoded.tracks)) {
            const importedIds: string[] = [];
            for (const t of decoded.tracks) {
              if (!trackMap.has(t.id) && t.streamUrl) {
                trackMap.set(t.id, t);
                void saveTrackToDb(t);
              }
              importedIds.push(t.id);
            }
            const sharedPl: Playlist = {
              id: `pl-shared-${Date.now()}`,
              name: `${decoded.name} (Shared)`,
              description: decoded.description || 'Imported via shared Aurora Vibes link',
              trackIds: importedIds,
              pinned: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              artworkUrl: decoded.tracks[0]?.artworkUrl,
            };
            playlistMap.set(sharedPl.id, sharedPl);
            void savePlaylistToDb(sharedPl);
            window.history.replaceState(null, '', window.location.pathname);
            set({
              activeView: 'playlist',
              activePlaylistId: sharedPl.id,
            });
            get().showToast(`Imported shared playlist "${decoded.name}"`, 'success');
          }
        } catch {
          // Ignore malformed share hashes
        }
      }

      const mergedTracks = sortTracksAZ(Array.from(trackMap.values()));
      const mergedPlaylists = Array.from(playlistMap.values());

      set({
        tracks: mergedTracks,
        playlists: mergedPlaylists,
        queueIds: mergedTracks.map((t) => t.id),
        initialized: true,
      });

      // Preload first curated track silently without auto-playing
      const first = mergedTracks[0];
      if (first) {
        await audioEngine.playTrack(first, false);
      }

      void get().fetchSpotifyStatus();
    },

    setActiveView: (view, playlistId = null) => set({ activeView: view, activePlaylistId: playlistId }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    toggleRightPanel: () =>
      set((s) => {
        const next = !s.rightPanelOpen;
        savePrefsToStorage({ rightPanelOpen: next });
        return { rightPanelOpen: next };
      }),
    setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),
    setThemeEditorOpen: (open) => set({ themeEditorOpen: open }),
    setUrlImportOpen: (open) => set({ urlImportOpen: open }),

    playTrack: async (track, newQueue) => {
      const state = get();
      const exists = state.tracks.some((t) => t.id === track.id);
      let updatedTracks = state.tracks;
      if (!exists) {
        updatedTracks = sortTracksAZ([track, ...state.tracks]);
        void saveTrackToDb(track);
      }

      const updatedQueueIds = newQueue
        ? newQueue.map((t) => t.id)
        : state.queueIds.includes(track.id)
        ? state.queueIds
        : [track.id, ...state.queueIds];

      set({
        tracks: updatedTracks,
        queueIds: updatedQueueIds,
        currentTrackId: track.id,
        currentTime: 0,
        duration: track.duration || 0,
        abLoop: { a: null, b: null },
      });
      audioEngine.setAbLoop(null, null);
      await audioEngine.playTrack(track, true);
      void get().fetchLyricsForTrack(track);
    },

    togglePlay: async () => {
      const state = get();
      if (!state.currentTrackId && state.tracks.length > 0) {
        await state.playTrack(state.tracks[0]);
        return;
      }
      const playing = await audioEngine.togglePlay();
      set({ isPlaying: playing });
    },

    playNext: async () => {
      const state = get();
      if (state.repeat === 'one' && state.currentTrackId) {
        audioEngine.seek(0);
        await audioEngine.togglePlay(true);
        return;
      }
      const nextId = computeNextTrackId(state);
      if (!nextId) {
        set({ isPlaying: false });
        return;
      }
      const nextTrack = state.tracks.find((t) => t.id === nextId);
      if (nextTrack) {
        set({
          currentTrackId: nextTrack.id,
          currentTime: 0,
          duration: nextTrack.duration || 0,
          abLoop: { a: null, b: null },
        });
        audioEngine.setAbLoop(null, null);
        await audioEngine.playTrack(nextTrack, true);
        void get().fetchLyricsForTrack(nextTrack);
      }
    },

    playPrev: async () => {
      const state = get();
      if (state.currentTime > 3) {
        audioEngine.seek(0);
        return;
      }
      const { queueIds, currentTrackId, repeat } = state;
      if (queueIds.length === 0) return;
      const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : 0;
      const prevIdx = idx > 0 ? idx - 1 : repeat === 'all' ? queueIds.length - 1 : 0;
      const prevTrack = state.tracks.find((t) => t.id === queueIds[prevIdx]);
      if (prevTrack) {
        set({
          currentTrackId: prevTrack.id,
          currentTime: 0,
          duration: prevTrack.duration || 0,
          abLoop: { a: null, b: null },
        });
        audioEngine.setAbLoop(null, null);
        await audioEngine.playTrack(prevTrack, true);
        void get().fetchLyricsForTrack(prevTrack);
      }
    },

    seek: (seconds) => {
      audioEngine.seek(seconds);
      set({ currentTime: seconds });
    },

    setVolume: (vol) => {
      const clamped = Math.max(0, Math.min(1, vol));
      audioEngine.setVolume(clamped, false);
      savePrefsToStorage({ volume: clamped });
      set({ volume: clamped, isMuted: false });
    },

    toggleMute: () => {
      const nextMuted = !get().isMuted;
      audioEngine.setVolume(get().volume, nextMuted);
      set({ isMuted: nextMuted });
    },

    toggleShuffle: () => {
      const next = !get().shuffle;
      savePrefsToStorage({ shuffle: next });
      set({ shuffle: next });
    },

    cycleRepeat: () => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const cur = get().repeat;
      const next = order[(order.indexOf(cur) + 1) % order.length];
      savePrefsToStorage({ repeat: next });
      set({ repeat: next });
    },

    setCrossfadeSeconds: (sec) => {
      const clamped = Math.max(0, Math.min(12, sec));
      audioEngine.setCrossfadeSeconds(clamped);
      savePrefsToStorage({ crossfadeSeconds: clamped });
      set({ crossfadeSeconds: clamped });
    },

    setPlaybackRate: (rate) => {
      const clamped = Math.max(0.5, Math.min(2, rate));
      audioEngine.setPlaybackRate(clamped);
      savePrefsToStorage({ playbackRate: clamped });
      set({ playbackRate: clamped });
    },

    setAbLoopPoint: (which) => {
      const state = get();
      if (which === 'clear') {
        audioEngine.setAbLoop(null, null);
        set({ abLoop: { a: null, b: null } });
        return;
      }
      if (which === 'a') {
        const nextA = state.currentTime;
        const nextB = state.abLoop.b !== null && state.abLoop.b > nextA ? state.abLoop.b : null;
        audioEngine.setAbLoop(nextA, nextB);
        set({ abLoop: { a: nextA, b: nextB } });
        return;
      }
      if (which === 'b') {
        const aVal = state.abLoop.a ?? 0;
        const bVal = Math.max(aVal + 0.5, state.currentTime);
        audioEngine.setAbLoop(aVal, bVal);
        set({ abLoop: { a: aVal, b: bVal } });
      }
    },

    setVisualizerMode: (mode) => {
      savePrefsToStorage({ visualizerMode: mode });
      set({ visualizerMode: mode });
    },

    addToQueue: (track) => {
      const state = get();
      const tracks = state.tracks.some((t) => t.id === track.id) ? state.tracks : [track, ...state.tracks];
      if (!state.tracks.some((t) => t.id === track.id)) void saveTrackToDb(track);
      const queueIds = state.queueIds.includes(track.id) ? state.queueIds : [...state.queueIds, track.id];
      set({ tracks, queueIds });
      state.showToast(`Added "${track.title}" to queue`);
    },

    playNextInQueue: (track) => {
      const state = get();
      const tracks = state.tracks.some((t) => t.id === track.id) ? state.tracks : [track, ...state.tracks];
      if (!state.tracks.some((t) => t.id === track.id)) void saveTrackToDb(track);
      const filtered = state.queueIds.filter((id) => id !== track.id);
      const curIdx = state.currentTrackId ? filtered.indexOf(state.currentTrackId) : -1;
      filtered.splice(curIdx + 1, 0, track.id);
      set({ tracks, queueIds: filtered });
      state.showToast(`"${track.title}" will play next`);
    },

    removeFromQueue: (trackId) => {
      set((s) => ({
        queueIds: s.queueIds.filter((id) => id !== trackId),
      }));
    },

    reorderQueue: (fromIdx, toIdx) => {
      set((s) => {
        const next = [...s.queueIds];
        const [moved] = next.splice(fromIdx, 1);
        if (!moved) return s;
        next.splice(toIdx, 0, moved);
        return { queueIds: next };
      });
    },

    clearQueue: () => {
      const cur = get().currentTrackId;
      set({ queueIds: cur ? [cur] : [] });
    },

    importLocalFiles: async (fileList) => {
      const files = Array.from(fileList).filter(isSupportedAudioFile);
      if (files.length === 0) {
        get().showToast('No supported audio files found (MP3, FLAC, OGG, WAV, M4A)', 'error');
        return 0;
      }

      set({ uploadProgress: { active: true, done: 0, total: files.length } });

      let totalImported = 0;
      const BATCH_SIZE = 8;
      const skipDurationProbe = files.length > 1;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const chunk = files.slice(i, i + BATCH_SIZE);
        const parsedResults = await Promise.all(
          chunk.map(async (file) => {
            try {
              return await parseLocalAudioFile(file, { skipDurationProbe });
            } catch {
              return null;
            }
          })
        );

        const validEntries = parsedResults.filter(
          (entry): entry is { track: Track; blob: Blob } => Boolean(entry)
        );

        if (validEntries.length > 0) {
          await saveTracksBatchToDb(validEntries);
          const batchTracks = validEntries.map((e) => e.track);
          totalImported += batchTracks.length;
          set((s) => {
            const sorted = sortTracksAZ([...batchTracks, ...s.tracks]);
            return {
              tracks: sorted,
              queueIds: sorted.map((t) => t.id),
            };
          });
        }

        set({
          uploadProgress: {
            active: i + chunk.length < files.length,
            done: Math.min(files.length, i + chunk.length),
            total: files.length,
          },
        });
      }

      set({ uploadProgress: { active: false, done: files.length, total: files.length } });

      if (totalImported > 0) {
        get().showToast(
          `Imported ${totalImported} local ${totalImported === 1 ? 'track' : 'tracks'} for offline playback`,
          'success'
        );
      } else {
        get().showToast('Could not read the selected audio files', 'error');
      }

      return totalImported;
    },

    addExternalTrack: async (track, playImmediately = true) => {
      const state = get();
      const exists = state.tracks.some((t) => t.id === track.id);
      if (!exists) {
        await saveTrackToDb(track);
        set((s) => {
          const sorted = sortTracksAZ([track, ...s.tracks]);
          return {
            tracks: sorted,
            queueIds: [track.id, ...s.queueIds],
          };
        });
      }
      if (playImmediately) {
        await get().playTrack(track);
      }
    },

    removeTrack: async (trackId) => {
      await deleteTrackFromDb(trackId);
      const updatedPlaylists = get().playlists.map((pl) => {
        if (!pl.trackIds.includes(trackId)) return pl;
        const updated = { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId), updatedAt: Date.now() };
        void savePlaylistToDb(updated);
        return updated;
      });
      set((s) => ({
        tracks: s.tracks.filter((t) => t.id !== trackId),
        queueIds: s.queueIds.filter((id) => id !== trackId),
        playlists: updatedPlaylists,
      }));
      get().showToast('Removed track from library');
    },

    toggleFavorite: async (trackId) => {
      const target = get().tracks.find((t) => t.id === trackId);
      if (!target) return;
      const updated = { ...target, isFavorite: !target.isFavorite };
      await saveTrackToDb(updated);
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === trackId ? updated : t)),
      }));
    },

    attachLyricsToTrack: async (trackId, syncedLyrics, plainLyrics) => {
      const target = get().tracks.find((t) => t.id === trackId);
      if (!target) return;
      const updated: Track = { ...target, syncedLyrics, plainLyrics };
      await saveTrackToDb(updated);
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === trackId ? updated : t)),
      }));
      get().showToast('Lyrics saved to track', 'success');
    },

    fetchLyricsForTrack: async (track) => {
      if (track.syncedLyrics || track.plainLyrics) return;
      set({ lyricsLoading: true });
      try {
        const params = new URLSearchParams({
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: String(Math.round(track.duration || 0)),
        });

        let data: { syncedLyrics?: string | null; plainLyrics?: string | null } | null = null;
        try {
          const res = await fetch(`/api/lyrics?${params.toString()}`);
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            data = (await res.json()) as {
              syncedLyrics?: string | null;
              plainLyrics?: string | null;
            };
          }
        } catch {
          // Fallback below
        }

        if (!data) {
          const lrcParams = new URLSearchParams({ track_name: track.title });
          if (track.artist && track.artist !== 'Unknown Artist') lrcParams.set('artist_name', track.artist);
          if (track.album && track.album !== 'Unknown Album') lrcParams.set('album_name', track.album);
          if (track.duration > 0) lrcParams.set('duration', String(Math.round(track.duration)));
          const directRes = await fetch(`https://lrclib.net/api/get?${lrcParams.toString()}`);
          if (directRes.ok) {
            data = (await directRes.json()) as {
              syncedLyrics?: string | null;
              plainLyrics?: string | null;
            };
          }
        }

        if (data && (data.syncedLyrics || data.plainLyrics)) {
          const updated: Track = {
            ...track,
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
          };
          void saveTrackToDb(updated);
          set((s) => ({
            tracks: s.tracks.map((t) => (t.id === track.id ? updated : t)),
          }));
        }
      } catch {
        // Lyrics optional
      } finally {
        set({ lyricsLoading: false });
      }
    },

    createPlaylist: async (name, description = '', initialTrackId) => {
      const now = Date.now();
      const firstTrack = initialTrackId ? get().tracks.find((t) => t.id === initialTrackId) : undefined;
      const pl: Playlist = {
        id: `pl-${now}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || 'Untitled Playlist',
        description: description.trim(),
        trackIds: initialTrackId ? [initialTrackId] : [],
        pinned: false,
        createdAt: now,
        updatedAt: now,
        artworkUrl: firstTrack?.artworkUrl,
      };
      await savePlaylistToDb(pl);
      set((s) => ({ playlists: [pl, ...s.playlists] }));
      get().showToast(`Created playlist "${pl.name}"`, 'success');
      return pl;
    },

    renamePlaylist: async (playlistId, name, description) => {
      const pl = get().playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const updated: Playlist = {
        ...pl,
        name: name.trim() || pl.name,
        description: description !== undefined ? description.trim() : pl.description,
        updatedAt: Date.now(),
      };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
    },

    deletePlaylist: async (playlistId) => {
      await deletePlaylistFromDb(playlistId);
      set((s) => ({
        playlists: s.playlists.filter((p) => p.id !== playlistId),
        activeView: s.activePlaylistId === playlistId ? 'home' : s.activeView,
        activePlaylistId: s.activePlaylistId === playlistId ? null : s.activePlaylistId,
      }));
      get().showToast('Playlist deleted');
    },

    togglePinPlaylist: async (playlistId) => {
      const pl = get().playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const updated = { ...pl, pinned: !pl.pinned, updatedAt: Date.now() };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
    },

    addTrackToPlaylist: async (playlistId, trackId) => {
      const pl = get().playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      if (pl.trackIds.includes(trackId)) {
        get().showToast('Track is already in this playlist');
        return;
      }
      const track = get().tracks.find((t) => t.id === trackId);
      const updated: Playlist = {
        ...pl,
        trackIds: [...pl.trackIds, trackId],
        artworkUrl: pl.artworkUrl || track?.artworkUrl,
        updatedAt: Date.now(),
      };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
      get().showToast(`Added to "${pl.name}"`, 'success');
    },

    removeTrackFromPlaylist: async (playlistId, trackId) => {
      const pl = get().playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const updated: Playlist = {
        ...pl,
        trackIds: pl.trackIds.filter((id) => id !== trackId),
        updatedAt: Date.now(),
      };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
    },

    reorderPlaylistTracks: async (playlistId, fromIdx, toIdx) => {
      const pl = get().playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const nextIds = [...pl.trackIds];
      const [moved] = nextIds.splice(fromIdx, 1);
      if (!moved) return;
      nextIds.splice(toIdx, 0, moved);
      const updated: Playlist = { ...pl, trackIds: nextIds, updatedAt: Date.now() };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
    },

    sortPlaylistAZ: async (playlistId) => {
      const state = get();
      const pl = state.playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const titleMap = new Map(state.tracks.map((t) => [t.id, t.title]));
      const sortedIds = [...pl.trackIds].sort((a, b) =>
        (titleMap.get(a) || '').localeCompare(titleMap.get(b) || '', undefined, { sensitivity: 'base' })
      );
      const updated: Playlist = { ...pl, trackIds: sortedIds, updatedAt: Date.now() };
      await savePlaylistToDb(updated);
      set((s) => ({
        playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
      }));
      get().showToast(`Sorted "${pl.name}" A–Z`, 'success');
    },

    getShareUrl: (playlistId) => {
      const state = get();
      const pl = state.playlists.find((p) => p.id === playlistId);
      if (!pl) return window.location.href;
      const plTracks = pl.trackIds
        .map((id) => state.tracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t && !t.hasLocalBlob));
      const payload = {
        name: pl.name,
        description: pl.description,
        tracks: plTracks,
      };
      const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
      return `${window.location.origin}/#playlist=${encoded}`;
    },

    setSleepTimer: (option) => {
      if (sleepIntervalId) {
        window.clearInterval(sleepIntervalId);
        sleepIntervalId = null;
      }
      if (option === 'off') {
        set({
          sleepTimer: { active: false, mode: 'minutes', endTimestamp: null, remainingSeconds: 0 },
        });
        get().showToast('Sleep timer turned off');
        return;
      }
      if (option === 'endOfTrack') {
        set({
          sleepTimer: { active: true, mode: 'endOfTrack', endTimestamp: null, remainingSeconds: 0 },
        });
        get().showToast('Playback will pause at end of track');
        return;
      }

      const endTimestamp = Date.now() + option * 60 * 1000;
      set({
        sleepTimer: {
          active: true,
          mode: 'minutes',
          endTimestamp,
          remainingSeconds: option * 60,
        },
      });
      get().showToast(`Sleep timer set for ${option} minutes`);

      sleepIntervalId = window.setInterval(() => {
        const st = get().sleepTimer;
        if (!st.active || st.mode !== 'minutes' || !st.endTimestamp) {
          if (sleepIntervalId) window.clearInterval(sleepIntervalId);
          return;
        }
        const rem = Math.max(0, Math.round((st.endTimestamp - Date.now()) / 1000));
        if (rem <= 0) {
          if (sleepIntervalId) window.clearInterval(sleepIntervalId);
          sleepIntervalId = null;
          audioEngine.fadeOutAndPause(3);
          set({
            sleepTimer: { active: false, mode: 'minutes', endTimestamp: null, remainingSeconds: 0 },
          });
          get().showToast('Sleep timer paused playback');
        } else {
          set({ sleepTimer: { ...st, remainingSeconds: rem } });
        }
      }, 1000);
    },

    updateTheme: (patch) => {
      const next = { ...get().theme, ...patch };
      applyThemeToDom(next);
      saveThemeToStorage(next);
      set({ theme: next });
    },

    resetTheme: () => {
      applyThemeToDom(DEFAULT_THEME);
      saveThemeToStorage(DEFAULT_THEME);
      set({ theme: DEFAULT_THEME });
      get().showToast('Reset theme to Aurora Vibes default');
    },

    setUsername: (name) => {
      const clean = name.trim() || 'Listener';
      saveUsernameToStorage(clean);
      set({ username: clean, hasCompletedOnboarding: true });
    },

    setCalmStudyMode: (enabled) => {
      set({ calmStudyMode: enabled });
    },

    setStudyAmbience: (mode) => {
      const vol = get().studyAmbienceVolume;
      audioEngine.setStudyAmbience(mode, vol);
      set({ studyAmbience: mode });
    },

    setStudyAmbienceVolume: (vol) => {
      const clamped = Math.max(0, Math.min(0.6, vol));
      audioEngine.setStudyAmbienceVolume(clamped);
      set({ studyAmbienceVolume: clamped });
    },

    saveCustomTheme: (name) => {
      const clean = name.trim();
      if (!clean) return;
      const preset: SavedThemePreset = {
        id: `custom-${Date.now()}`,
        name: clean,
        theme: { ...get().theme },
      };
      const next = [preset, ...get().savedThemes];
      saveCustomThemesToStorage(next);
      set({ savedThemes: next });
      get().showToast(`Saved custom theme "${clean}"`, 'success');
    },

    deleteCustomTheme: (id) => {
      const next = get().savedThemes.filter((p) => p.id !== id);
      saveCustomThemesToStorage(next);
      set({ savedThemes: next });
    },

    toggleUselessFeature: (key) => {
      const current = get().uselessFeatures;
      const next: UselessFeaturesConfig = { ...current, [key]: !current[key] };
      saveUselessFeaturesToStorage(next);
      set({ uselessFeatures: next });
    },

    resetUselessFeatures: () => {
      const clean: UselessFeaturesConfig = {
        discoLasers: false,
        floatingParticles: false,
        vinylWobble: false,
        crtScanlines: false,
        matrixRain: false,
        fakeEngineerTelemetry: false,
        zeroGravityArt: false,
        clickSparks: false,
      };
      saveUselessFeaturesToStorage(clean);
      set({ uselessFeatures: clean });
      get().showToast('All experimental studio features turned off');
    },

    setAutoUpdateEnabled: (enabled) => {
      saveAutoUpdatePref(enabled);
      set({ autoUpdateEnabled: enabled });
    },

    checkForAppUpdate: async (silent = false) => {
      set({ checkingUpdate: true });
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update().catch(() => {});
          }
        }
        const res = await fetch('/api/app-version');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = (await res.json()) as { version?: string; releaseNotes?: string[] };
          const hasUpdate = Boolean(data.version && data.version !== get().appVersion);
          set({
            updateAvailable: hasUpdate,
            lastCheckedAt: Date.now(),
            latestReleaseNotes:
              Array.isArray(data.releaseNotes) && data.releaseNotes.length > 0
                ? data.releaseNotes
                : get().latestReleaseNotes,
          });
          if (!silent) {
            get().showToast(
              hasUpdate ? `Update v${data.version} ready to apply` : `Aurora Vibes v${get().appVersion} is up to date`,
              'success'
            );
          }
          return hasUpdate;
        }
      } catch {
        // Offline / standalone fallback
      } finally {
        set({ checkingUpdate: false, lastCheckedAt: Date.now() });
      }
      if (!silent) {
        get().showToast(`Aurora Vibes v${get().appVersion} is up to date`, 'info');
      }
      return false;
    },

    applySelfUpdate: async () => {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg?.update();
        } catch {
          // Ignore
        }
      }
      window.location.reload();
    },

    importThemeJson: (jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr) as Partial<ThemeConfig>;
        if (typeof parsed !== 'object' || !parsed) return false;
        const merged: ThemeConfig = { ...DEFAULT_THEME, ...parsed };
        applyThemeToDom(merged);
        saveThemeToStorage(merged);
        set({ theme: merged });
        get().showToast('Imported theme configuration', 'success');
        return true;
      } catch {
        get().showToast('Invalid theme JSON file', 'error');
        return false;
      }
    },

    updateEq: (patch) => {
      const next: EqSettings = { ...get().eq, ...patch };
      audioEngine.setEq(next);
      saveEqToStorage(next);
      set({ eq: next });
    },

    applyEqPreset: (presetName) => {
      const bands = EQ_PRESETS[presetName] || DEFAULT_EQ.bands;
      const next: EqSettings = {
        enabled: presetName !== 'Flat',
        preset: presetName,
        bands: [...bands] as [number, number, number, number, number],
      };
      audioEngine.setEq(next);
      saveEqToStorage(next);
      set({ eq: next });
    },

    fetchSpotifyStatus: async () => {
      try {
        const token = get().spotifySessionToken;
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/spotify/status', { headers });
        if (!res.ok) return;
        const data = (await res.json()) as {
          configured: boolean;
          redirectUri: string;
          connected: boolean;
          user: SpotifyUserProfile | null;
        };
        set({
          spotifyConfigured: data.configured,
          spotifyRedirectUri: data.redirectUri,
          spotifyConnected: data.connected,
          spotifyUser: data.user,
        });
        if (data.connected) {
          await get().fetchSpotifyPlaylists();
        }
      } catch {
        // Ignore offline/network check error
      }
    },

    connectSpotify: async (customClientId) => {
      try {
        const query = customClientId?.trim()
          ? `?clientId=${encodeURIComponent(customClientId.trim())}`
          : '';
        const res = await fetch(`/api/spotify/auth-url${query}`);
        const data = (await res.json()) as { url?: string; error?: string; redirectUri?: string };
        if (data.redirectUri) {
          set({ spotifyRedirectUri: data.redirectUri });
        }
        if (!res.ok || !data.url) {
          get().showToast(data.error || 'Could not start Spotify sign-in', 'error');
          return;
        }
        const popup = window.open(data.url, 'noir_spotify_oauth', 'width=520,height=720');
        if (!popup) {
          get().showToast('Pop-up blocked. Please allow pop-ups to connect Spotify.', 'error');
        }
      } catch {
        get().showToast('Failed to reach server for Spotify authorization.', 'error');
      }
    },

    completeSpotifyAuth: async (sessionToken) => {
      set({ spotifySessionToken: sessionToken });
      await get().fetchSpotifyStatus();
      get().showToast('Spotify account connected', 'success');
    },

    disconnectSpotify: async () => {
      const token = get().spotifySessionToken;
      try {
        if (token) {
          await fetch('/api/spotify/disconnect', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // Ignore
      }
      set({
        spotifySessionToken: null,
        spotifyConnected: false,
        spotifyUser: null,
        spotifyPlaylists: [],
      });
      get().showToast('Disconnected Spotify account');
    },

    fetchSpotifyPlaylists: async () => {
      const token = get().spotifySessionToken;
      if (!token) return;
      try {
        const res = await fetch('/api/spotify/playlists', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          set({ spotifyConnected: false, spotifySessionToken: null, spotifyUser: null });
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { playlists?: SpotifyPlaylistItem[] };
        const sorted = [...(data.playlists || [])].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        set({ spotifyPlaylists: sorted });
      } catch {
        // Ignore network failure
      }
    },

    toggleWatchPlaylist: async (playlist) => {
      const state = get();
      const isWatched = state.watchedPlaylistIds.includes(playlist.id);
      if (isWatched) {
        const nextIds = state.watchedPlaylistIds.filter((id) => id !== playlist.id);
        writeJsonStorage(SPOTIFY_WATCH_KEY, nextIds);
        set({ watchedPlaylistIds: nextIds });
        state.showToast(`Stopped watching "${playlist.name}"`);
        return;
      }

      const nextIds = [...state.watchedPlaylistIds, playlist.id];
      writeJsonStorage(SPOTIFY_WATCH_KEY, nextIds);
      set({ watchedPlaylistIds: nextIds });

      // Ensure a mirrored Noir playlist exists so downloaded tracks appear organized
      const mirrorId = `sp-mirror-${playlist.id}`;
      if (!state.playlists.some((p) => p.id === mirrorId)) {
        const mirrorPl: Playlist = {
          id: mirrorId,
          name: `Spotify: ${playlist.name}`,
          description: 'Automatically downloaded offline tracks from your watched Spotify playlist.',
          trackIds: [],
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          artworkUrl: playlist.artworkUrl || undefined,
        };
        await savePlaylistToDb(mirrorPl);
        set((s) => ({ playlists: [mirrorPl, ...s.playlists] }));
      }

      // Baseline snapshot existing tracks so only newly added songs auto-download
      const token = state.spotifySessionToken;
      if (token) {
        try {
          const res = await fetch(`/api/spotify/playlists/${encodeURIComponent(playlist.id)}/tracks`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { tracks?: SpotifyTrackItem[] };
            const ids = (data.tracks || []).map((t) => t.spotifyId);
            const nextKnown = { ...get().knownSpotifyTracks, [playlist.id]: ids };
            writeJsonStorage(SPOTIFY_KNOWN_KEY, nextKnown);
            set({ knownSpotifyTracks: nextKnown });
          }
        } catch {
          // Ignore snapshot error
        }
      }

      get().showToast(`Watching "${playlist.name}" for newly added songs`, 'success');
    },

    setSpotifyWatchEnabled: (enabled) => {
      writeJsonStorage(SPOTIFY_WATCH_ENABLED_KEY, enabled);
      set({ spotifyWatchEnabled: enabled });
    },

    setAutoSaveDeviceDownloads: (enabled) => {
      writeJsonStorage(SPOTIFY_AUTOSAVE_DEVICE_KEY, enabled);
      set({ autoSaveDeviceDownloads: enabled });
    },

    downloadSpotifyTrack: async (item, playlistName, mirrorPlaylistId) => {
      const logId = `log-${Date.now()}-${item.spotifyId}`;
      const pushLog = (entry: SpotifyDownloadLog) => {
        set((s) => ({
          spotifyDownloadLogs: [
            entry,
            ...s.spotifyDownloadLogs.filter((l) => l.id !== entry.id),
          ].slice(0, 40),
        }));
      };

      pushLog({
        id: logId,
        title: item.title,
        artist: item.artist,
        playlistName,
        status: 'downloading',
        message: 'Resolving & saving offline audio...',
        timestamp: Date.now(),
      });

      try {
        const res = await fetch('/api/spotify/resolve-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            artist: item.artist,
            album: item.album,
            artworkUrl: item.artworkUrl,
            previewUrl: item.previewUrl,
            spotifyUrl: item.spotifyUrl,
          }),
        });
        const data = (await res.json()) as { track?: Track; error?: string };
        if (!res.ok || !data.track) {
          throw new Error(data.error || 'No downloadable audio source matched');
        }

        // Fetch proxied stream into Blob for persistent offline playback in IndexedDB
        const audioRes = await fetch(data.track.streamUrl);
        if (!audioRes.ok) {
          throw new Error(`Audio fetch returned ${audioRes.status}`);
        }
        const blob = await audioRes.blob();
        const objectUrl = URL.createObjectURL(blob);

        const offlineTrack: Track = {
          ...data.track,
          id: `sp-${item.spotifyId}-${Date.now().toString(36)}`,
          addedAt: Date.now(),
          streamUrl: objectUrl,
          hasLocalBlob: true,
          fileSize: blob.size,
        };

        await saveTrackToDb(offlineTrack, blob);

        set((s) => {
          const sorted = sortTracksAZ([offlineTrack, ...s.tracks]);
          return {
            tracks: sorted,
            queueIds: sorted.map((t) => t.id),
          };
        });

        // Also add to mirrored playlist if present
        if (mirrorPlaylistId) {
          const pl = get().playlists.find((p) => p.id === mirrorPlaylistId);
          if (pl && !pl.trackIds.includes(offlineTrack.id)) {
            await get().addTrackToPlaylist(mirrorPlaylistId, offlineTrack.id);
            await get().sortPlaylistAZ(mirrorPlaylistId);
          }
        }

        // Optionally trigger browser file download onto phone/computer storage
        if (get().autoSaveDeviceDownloads) {
          const ext = (offlineTrack.format || 'mp3').toLowerCase().includes('m4a') ? 'm4a' : 'mp3';
          const safeName = `${item.title} - ${item.artist}`.replace(/[^a-z0-9 _-]+/gi, '').trim() || 'noir-track';
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = `${safeName}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        pushLog({
          id: logId,
          title: item.title,
          artist: item.artist,
          playlistName,
          status: 'saved',
          message: offlineTrack.notice || 'Saved offline in Aurora Vibes',
          timestamp: Date.now(),
        });
      } catch (err) {
        pushLog({
          id: logId,
          title: item.title,
          artist: item.artist,
          playlistName,
          status: 'error',
          message: err instanceof Error ? err.message : 'Download failed',
          timestamp: Date.now(),
        });
      }
    },

    syncWatchedPlaylists: async (downloadAllCurrent = false) => {
      const state = get();
      if (!state.spotifySessionToken || !state.spotifyConnected || state.spotifySyncing) return;
      if (state.watchedPlaylistIds.length === 0) return;

      set({ spotifySyncing: true });
      let newCount = 0;

      try {
        for (const playlistId of state.watchedPlaylistIds) {
          const plMeta = state.spotifyPlaylists.find((p) => p.id === playlistId);
          const playlistName = plMeta?.name || 'Spotify Playlist';
          const mirrorId = `sp-mirror-${playlistId}`;

          const res = await fetch(`/api/spotify/playlists/${encodeURIComponent(playlistId)}/tracks`, {
            headers: { Authorization: `Bearer ${state.spotifySessionToken}` },
          });
          if (!res.ok) continue;
          const data = (await res.json()) as { tracks?: SpotifyTrackItem[] };
          const items = data.tracks || [];

          const knownIds = new Set(get().knownSpotifyTracks[playlistId] || []);
          const toDownload = downloadAllCurrent
            ? items.filter((t) => {
                // Skip tracks already downloaded in library by exact title+artist match
                return !get().tracks.some(
                  (existing) =>
                    existing.source === 'spotify' &&
                    existing.title.toLowerCase() === t.title.toLowerCase() &&
                    existing.artist.toLowerCase() === t.artist.toLowerCase()
                );
              })
            : items.filter((t) => !knownIds.has(t.spotifyId));

          for (const item of toDownload) {
            newCount += 1;
            await get().downloadSpotifyTrack(item, playlistName, mirrorId);
          }

          const updatedKnownIds = Array.from(new Set([...knownIds, ...items.map((t) => t.spotifyId)]));
          const nextKnown = { ...get().knownSpotifyTracks, [playlistId]: updatedKnownIds };
          writeJsonStorage(SPOTIFY_KNOWN_KEY, nextKnown);
          set({ knownSpotifyTracks: nextKnown });
        }

        set({ spotifyLastSyncedAt: Date.now() });
        if (newCount > 0) {
          get().showToast(
            `Auto-downloaded ${newCount} ${newCount === 1 ? 'song' : 'songs'} from watched Spotify playlists`,
            'success'
          );
        }
      } finally {
        set({ spotifySyncing: false });
      }
    },
  };
});
