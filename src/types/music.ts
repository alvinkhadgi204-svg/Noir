export type TrackSource =
  | 'local'
  | 'url'
  | 'youtube'
  | 'soundcloud'
  | 'bandcamp'
  | 'spotify'
  | 'audius'
  | 'itunes';

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  artworkUrl: string;
  streamUrl: string;
  source: TrackSource;
  originalUrl?: string;
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  fileSize?: number;
  addedAt: number;
  isFavorite?: boolean;
  hasLocalBlob?: boolean;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  notice?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  artworkUrl?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type VisualizerMode = 'cava' | 'circular';

export type AppView = 'home' | 'search' | 'library' | 'local' | 'playlist' | 'spotify' | 'settings';

export interface UselessFeaturesConfig {
  discoLasers: boolean;
  floatingParticles: boolean;
  vinylWobble: boolean;
  crtScanlines: boolean;
  matrixRain: boolean;
  fakeEngineerTelemetry: boolean;
  zeroGravityArt: boolean;
  clickSparks: boolean;
}

export interface SavedThemePreset {
  id: string;
  name: string;
  theme: ThemeConfig;
}

export interface SpotifyUserProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
}

export interface SpotifyPlaylistItem {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  trackCount: number;
  owner: string;
}

export interface SpotifyTrackItem {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl: string;
  previewUrl: string | null;
  spotifyUrl: string;
}

export interface SpotifyDownloadLog {
  id: string;
  title: string;
  artist: string;
  playlistName: string;
  status: 'downloading' | 'saved' | 'error';
  message: string;
  timestamp: number;
}

export type FontOption =
  | 'Plus Jakarta Sans'
  | 'Satoshi'
  | 'Space Grotesk'
  | 'Playfair Display'
  | 'JetBrains Mono'
  | 'Outfit'
  | 'Syne'
  | 'Inter'
  | 'DM Sans'
  | 'Manrope'
  | (string & {});

export type FontScale = 'S' | 'M' | 'L' | 'XL';

export type IconStyle = 'outline' | 'filled' | 'duotone';

export type SidebarPosition = 'left' | 'right';

export type PlayerBarPosition = 'bottom' | 'floating';

export type AlbumArtStyle = 'square' | 'rounded' | 'circular' | 'blurred';

export type CavaStyle = 'bars' | 'mirror' | 'wave' | 'blocks' | 'peaks' | 'radial';

export type CavaColorMode = 'accent' | 'aurora' | 'cyber' | 'sunset' | 'rainbow' | 'monochrome' | 'custom';

export interface ThemeConfig {
  baseBg: string;
  surfaceBg: string;
  elevatedBg: string;
  accentColor: string;
  cavaStyle: CavaStyle;
  cavaColorMode: CavaColorMode;
  cavaPrimaryColor: string;
  cavaSecondaryColor: string;
  fontFamily: FontOption;
  fontScale: FontScale;
  cornerRadius: number; // 0 - 24
  blurIntensity: number; // 0 - 30
  animationSpeed: number; // 0.5 - 2.0 (0 = instant)
  iconStyle: IconStyle;
  sidebarPosition: SidebarPosition;
  playerBarPosition: PlayerBarPosition;
  albumArtStyle: AlbumArtStyle;
  customCss: string;
}

export interface EqSettings {
  enabled: boolean;
  preset: string;
  bands: [number, number, number, number, number]; // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz in dB
}

export interface SleepTimerState {
  active: boolean;
  mode: 'minutes' | 'endOfTrack';
  endTimestamp: number | null;
  remainingSeconds: number;
}
