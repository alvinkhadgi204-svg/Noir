# Noir — Matte Black Music Streaming & Local Audio Studio

Noir is a dark-first, installable Progressive Web App (PWA) for universal audio streaming and offline local file playback, featuring a dual-deck Web Audio API engine, 60fps audio visualizers, synced LRC lyrics, and full live theme customization.

## Features

- **Universal Audio URL Fetching**: Paste direct audio links (`.mp3`, `.flac`, `.ogg`, `.wav`, `.m4a`) or Bandcamp, YouTube, SoundCloud, and Spotify share URLs. Extracted streams are proxied safely with HTTP `Range` support for scrubbing and cross-origin Web Audio analysis.
- **Local File Studio & Offline Persistence**: Drag & drop or pick `MP3`, `FLAC`, `OGG`, `WAV`, and `M4A` files (or entire folders). Embedded ID3/Vorbis/MP4 metadata, cover art, lyrics, and binary audio blobs persist locally in IndexedDB so local files remain playable offline.
- **Local Player Precision Tools**:
  - 5-Band Parametric Equalizer (`60 Hz` – `14 kHz`) with presets (*Flat*, *Warm Vinyl*, *Late Night Bass*, *Vocal Clarity*, *Studio Reference*)
  - Playback speed control (`0.5×` – `2.0×`)
  - A–B segment loop markers
  - `.lrc` sidecar lyrics attachment & technical codec/bitrate/sample-rate readout
- **Gapless Playback & Crossfade**: Dual-deck Web Audio API architecture preloads the next track cleanly for gapless handoff (`0s`) or smooth equal-power crossfades (`0.5s` – `12s`).
- **60fps Audio Visualizers**: Switch between real-time **CAVA Bars** (logarithmic segmented spectrum with gravity decay and peak caps) and **Circular Spectrum** visualizers.
- **Synced Lyrics**: Automatic lookup via LRCLIB with click-to-seek timestamp lines and manual LRC editing.
- **Playlist Management**: Create, rename, pin, reorder tracks (drag & drop or move buttons), export `.m3u`, and generate shareable playlist links.
- **Queue, Sleep Timer & Media Session**: Full Up Next queue management, shuffle, repeat (`off` / `all` / `one`), gentle fade-out sleep timer, and system/lock-screen Media Session controls.
- **Theme Studio**: Customize base, surface, elevated, and accent colors; choose from 5 fonts; scale text (`S`/`M`/`L`); adjust corner radius (`0–24px`), overlay blur (`0–30px`), animation speed, icon style (`outline`/`filled`/`duotone`), sidebar/player bar placement, album art style, and custom CSS—with JSON export/import.
- **A–Z Alphabetical Library & Playlists**: Tracks across Discover, Library, Local Studio, and Playlists stay neatly organized A–Z by title, with a one-click **Sort A–Z** button on playlists.
- **Spotify Account Sync & Auto-Downloader**: Connect your Spotify account via OAuth + PKCE, mark any Spotify playlist to **Watch**, and Noir polls every 30 seconds—automatically saving newly added songs into IndexedDB for offline playback (and optionally triggering a device download).
- **Universal Older & Modern Phone Build**: Compiled to `es2019` / `safari13` / `chrome79` with CSS fallbacks, Canvas `roundRect` polyfill, `HTMLAudioElement` WebView fallbacks, `100vh`/`100dvh` viewport support, and safe-area mobile navigation.
- **Installable PWA**: Service worker caching for offline app shell, built-in Noir session audio, and local IndexedDB tracks.

## Setup & Running Locally

### Prerequisites
- Node.js `>= 20`
- Optional: `yt-dlp` on `PATH` for extended platform extraction
- Optional for Spotify Auto-Download: a Spotify Developer App (`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` configured in Secrets, or paste your Client ID in the **Spotify Sync** tab) with `/auth/spotify/callback` added as a Redirect URI.

### Install & Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

### Android APK Build
Noir ships with a PWA WebAPK manifest and `capacitor.config.json` (`app.noir.audio`):

- **Instant Phone Install / Cloud APK**: Open the **Phone App / APK** button in the sidebar to install directly via Android Chrome WebAPK or generate a signed `.apk` on [PWABuilder](https://www.pwabuilder.com/) from your deployed URL.
- **Local Gradle APK (requires JDK + Android SDK)**:
  ```bash
  npm run build
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap add android
  npx cap sync
  cd android && ./gradlew assembleDebug
  ```

## Keyboard Shortcuts

- `Space` — Play / Pause
- `ArrowLeft` / `ArrowRight` — Seek `-5s` / `+5s`
- `Ctrl/Cmd + K` — Open Global Search
