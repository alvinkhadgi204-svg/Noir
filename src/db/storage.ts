import type {
  EqSettings,
  Playlist,
  SavedThemePreset,
  ThemeConfig,
  Track,
  UselessFeaturesConfig,
} from '../types/music';

const DB_NAME = 'noir-audio-db';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks';
const STORE_BLOBS = 'audioBlobs';
const STORE_PLAYLISTS = 'playlists';

const THEME_STORAGE_KEY = 'noir-theme-v1';
const EQ_STORAGE_KEY = 'noir-eq-v1';
const PREFS_STORAGE_KEY = 'noir-player-prefs-v1';
const USERNAME_STORAGE_KEY = 'aurora-username-v1';
const SAVED_THEMES_STORAGE_KEY = 'aurora-saved-themes-v1';
const USELESS_FEATURES_STORAGE_KEY = 'aurora-useless-features-v1';
const AUTO_UPDATE_STORAGE_KEY = 'aurora-auto-update-v1';

export const DEFAULT_USELESS_FEATURES: UselessFeaturesConfig = {
  discoLasers: false,
  floatingParticles: false,
  vinylWobble: false,
  crtScanlines: false,
  matrixRain: false,
  fakeEngineerTelemetry: false,
  zeroGravityArt: false,
  clickSparks: false,
};

export const DEFAULT_THEME: ThemeConfig = {
  baseBg: '#0a0a0a',
  surfaceBg: '#1a1a1a',
  elevatedBg: '#2a2a2a',
  accentColor: '#22c55e',
  cavaStyle: 'bars',
  cavaColorMode: 'accent',
  cavaPrimaryColor: '#22c55e',
  cavaSecondaryColor: '#06b6d4',
  fontFamily: 'Plus Jakarta Sans',
  fontScale: 'M',
  cornerRadius: 12,
  blurIntensity: 16,
  animationSpeed: 1,
  iconStyle: 'outline',
  sidebarPosition: 'left',
  playerBarPosition: 'bottom',
  albumArtStyle: 'rounded',
  customCss: '',
};

export const DEFAULT_EQ: EqSettings = {
  enabled: false,
  preset: 'Flat',
  bands: [0, 0, 0, 0, 0],
};

export interface PlayerPrefs {
  volume: number;
  crossfadeSeconds: number;
  playbackRate: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  visualizerMode: 'cava' | 'circular';
  rightPanelOpen: boolean;
}

export const DEFAULT_PREFS: PlayerPrefs = {
  volume: 0.85,
  crossfadeSeconds: 2.5,
  playbackRate: 1,
  shuffle: false,
  repeat: 'all',
  visualizerMode: 'cava',
  rightPanelOpen: true,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTrackToDb(track: Track, blob?: Blob): Promise<void> {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(blob ? [STORE_TRACKS, STORE_BLOBS] : [STORE_TRACKS], 'readwrite');
      // Don't persist ephemeral objectURLs in IndexedDB; we recreate them from audioBlobs on load
      const serializable: Track = {
        ...track,
        streamUrl: track.hasLocalBlob ? '' : track.streamUrl,
      };
      tx.objectStore(STORE_TRACKS).put(serializable);
      if (blob) {
        tx.objectStore(STORE_BLOBS).put(blob, track.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful no-op on restricted/private mobile WebViews
  }
}

export async function saveTracksBatchToDb(entries: Array<{ track: Track; blob?: Blob }>): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const hasBlobs = entries.some((e) => Boolean(e.blob));
      const tx = db.transaction(hasBlobs ? [STORE_TRACKS, STORE_BLOBS] : [STORE_TRACKS], 'readwrite');
      const trackStore = tx.objectStore(STORE_TRACKS);
      const blobStore = hasBlobs ? tx.objectStore(STORE_BLOBS) : null;
      for (const { track, blob } of entries) {
        const serializable: Track = {
          ...track,
          streamUrl: track.hasLocalBlob ? '' : track.streamUrl,
        };
        trackStore.put(serializable);
        if (blob && blobStore) {
          blobStore.put(blob, track.id);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful no-op on restricted mobile WebViews
  }
}

export async function deleteTrackFromDb(trackId: string): Promise<void> {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_TRACKS).delete(trackId);
      tx.objectStore(STORE_BLOBS).delete(trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadAllTracksFromDb(): Promise<Track[]> {
  try {
    const db = await openDb();
    const tracks = await new Promise<Track[]>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const req = tx.objectStore(STORE_TRACKS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const hydrated: Track[] = [];
    for (const t of tracks) {
      if (t.hasLocalBlob) {
        const blob = await new Promise<Blob | undefined>((resolve) => {
          const tx = db.transaction(STORE_BLOBS, 'readonly');
          const req = tx.objectStore(STORE_BLOBS).get(t.id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        });
        if (blob) {
          hydrated.push({
            ...t,
            streamUrl: URL.createObjectURL(blob),
          });
        }
      } else {
        hydrated.push(t);
      }
    }
    return hydrated;
  } catch {
    return [];
  }
}

export async function savePlaylistToDb(playlist: Playlist): Promise<void> {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).put(playlist);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function deletePlaylistFromDb(playlistId: string): Promise<void> {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).delete(playlistId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadAllPlaylistsFromDb(): Promise<Playlist[]> {
  try {
    const db = await openDb();
    return await new Promise<Playlist[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readonly');
      const req = tx.objectStore(STORE_PLAYLISTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export function loadThemeFromStorage(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    if (parsed.accentColor?.toLowerCase() === '#e8a849') {
      parsed.accentColor = DEFAULT_THEME.accentColor;
    }
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveThemeToStorage(theme: ThemeConfig): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadEqFromStorage(): EqSettings {
  try {
    const raw = localStorage.getItem(EQ_STORAGE_KEY);
    if (!raw) return DEFAULT_EQ;
    return { ...DEFAULT_EQ, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EQ;
  }
}

export function saveEqToStorage(eq: EqSettings): void {
  try {
    localStorage.setItem(EQ_STORAGE_KEY, JSON.stringify(eq));
  } catch {
    // Ignore
  }
}

export function loadPrefsFromStorage(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Omit<Partial<PlayerPrefs>, 'visualizerMode'> & { visualizerMode?: string };
    const mode: PlayerPrefs['visualizerMode'] =
      parsed.visualizerMode === 'circular' ? 'circular' : 'cava';
    return { ...DEFAULT_PREFS, ...parsed, visualizerMode: mode };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefsToStorage(prefs: Partial<PlayerPrefs>): void {
  try {
    const current = loadPrefsFromStorage();
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {
    // Ignore
  }
}

export function loadUsernameFromStorage(): string {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUsernameToStorage(name: string): void {
  try {
    localStorage.setItem(USERNAME_STORAGE_KEY, name);
  } catch {
    // Ignore
  }
}

export function loadSavedThemesFromStorage(): SavedThemePreset[] {
  try {
    const raw = localStorage.getItem(SAVED_THEMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedThemePreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemesToStorage(presets: SavedThemePreset[]): void {
  try {
    localStorage.setItem(SAVED_THEMES_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore
  }
}

export function loadUselessFeaturesFromStorage(): UselessFeaturesConfig {
  try {
    const raw = localStorage.getItem(USELESS_FEATURES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USELESS_FEATURES };
    return { ...DEFAULT_USELESS_FEATURES, ...(JSON.parse(raw) as Partial<UselessFeaturesConfig>) };
  } catch {
    return { ...DEFAULT_USELESS_FEATURES };
  }
}

export function saveUselessFeaturesToStorage(features: UselessFeaturesConfig): void {
  try {
    localStorage.setItem(USELESS_FEATURES_STORAGE_KEY, JSON.stringify(features));
  } catch {
    // Ignore
  }
}

export function loadAutoUpdatePref(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_UPDATE_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveAutoUpdatePref(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore
  }
}
