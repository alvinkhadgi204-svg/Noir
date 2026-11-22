import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

interface NormalizedTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl: string;
  streamUrl: string;
  source: 'audius' | 'itunes' | 'youtube' | 'soundcloud' | 'bandcamp' | 'spotify' | 'url';
  originalUrl?: string;
  notice?: string;
}

// ---------- Security: SSRF Protection & URL Validation ----------

function isPrivateOrReservedIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(ip.slice(7));
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true; // Link-local fe80::/10
    }
    if (lower.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 2048) {
    throw new Error('Invalid URL length');
  }
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Embedded URL credentials are not permitted');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Local or internal hostnames are not permitted');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Private or loopback IP addresses are not permitted');
    }
    return parsed;
  }

  const records = await dns.lookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error('Could not resolve hostname');
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('Target resolves to a restricted network address');
    }
  }

  return parsed;
}

async function fetchSafePublicUrl(
  rawUrl: string,
  init: RequestInit = {},
  timeoutMs = 10000,
  maxRedirects = 5
): Promise<globalThis.Response> {
  let currentUrl = await validatePublicHttpUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(currentUrl.toString(), {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'NoirAudioStudio/1.0 (+https://localhost)',
          ...(init.headers || {}),
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return response;
        }
        const nextUrl = new URL(location, currentUrl);
        currentUrl = await validatePublicHttpUrl(nextUrl.toString());
        continue;
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Too many redirects');
}

function toProxiedStreamUrl(targetUrl: string): string {
  return `/api/stream?url=${encodeURIComponent(targetUrl)}`;
}

// ---------- Helpers: HTML & Metadata Parsing ----------

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function extractMetaTag(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i');
  const match = html.match(re1) || html.match(re2);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    return url.pathname.slice(1).split('/')[0] || null;
  }
  if (host.includes('youtube.com')) {
    if (url.searchParams.get('v')) return url.searchParams.get('v');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
      return parts[1] || null;
    }
  }
  return null;
}

async function tryYtDlp(targetUrl: string): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  artworkUrl?: string;
  audioUrl?: string;
} | null> {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--dump-single-json', '--no-playlist', '--no-warnings', '-f', 'bestaudio/best', targetUrl],
      { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout);
    const audioUrl =
      info.url ||
      (Array.isArray(info.formats)
        ? info.formats
            .filter((f: { acodec?: string; vcodec?: string; url?: string }) => f.acodec && f.acodec !== 'none' && f.url)
            .sort((a: { abr?: number }, b: { abr?: number }) => (b.abr || 0) - (a.abr || 0))[0]?.url
        : undefined);

    if (!audioUrl) return null;
    return {
      title: info.track || info.title,
      artist: info.artist || info.uploader || info.channel,
      album: info.album || 'Extracted Stream',
      duration: Number(info.duration) || 0,
      artworkUrl: info.thumbnail,
      audioUrl,
    };
  } catch {
    return null;
  }
}

// ---------- Connected Search Providers (Audius + iTunes) ----------

async function searchAudiusTracks(query: string, limit = 8): Promise<NormalizedTrackResult[]> {
  try {
    const url = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=NoirAudioStudio&limit=${limit}`;
    const res = await fetchSafePublicUrl(url, {}, 6000);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        title: string;
        duration: number;
        genre?: string;
        permalink?: string;
        is_streamable?: boolean;
        stream?: { url?: string };
        preview?: { url?: string };
        artwork?: { '480x480'?: string; '150x150'?: string };
        user?: { name?: string };
      }>;
    };
    const items = json.data || [];
    return items
      .filter((item) => item.id && item.title && item.is_streamable !== false && Boolean(item.stream?.url || item.preview?.url))
      .map((item) => {
        const rawStream = item.stream?.url || item.preview?.url || '';
        return {
          id: `audius-${item.id}`,
          title: item.title,
          artist: item.user?.name || 'Independent Artist',
          album: item.genre || 'Audius Catalog',
          duration: Number(item.duration) || 180,
          artworkUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
          streamUrl: toProxiedStreamUrl(rawStream),
          source: 'audius' as const,
          originalUrl: item.permalink ? `https://audius.co${item.permalink}` : undefined,
        };
      });
  } catch {
    return [];
  }
}

async function searchItunesTracks(query: string, limit = 10): Promise<NormalizedTrackResult[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const res = await fetchSafePublicUrl(url, {}, 6000);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        trackId: number;
        trackName: string;
        artistName: string;
        collectionName?: string;
        artworkUrl100?: string;
        previewUrl?: string;
        trackTimeMillis?: number;
        trackViewUrl?: string;
      }>;
    };
    return (json.results || [])
      .filter((r) => Boolean(r.previewUrl && r.trackName))
      .map((r) => ({
        id: `itunes-${r.trackId}`,
        title: r.trackName,
        artist: r.artistName || 'Unknown Artist',
        album: r.collectionName || 'Single',
        duration: 30,
        artworkUrl: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
        streamUrl: toProxiedStreamUrl(r.previewUrl!),
        source: 'itunes' as const,
        originalUrl: r.trackViewUrl,
        notice: '30s studio preview',
      }));
  } catch {
    return [];
  }
}

async function tryPipedYouTubeAudio(videoId: string): Promise<{
  audioUrl: string;
  title?: string;
  artist?: string;
  duration?: number;
  artworkUrl?: string;
} | null> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.private.coffee',
  ];
  for (const base of instances) {
    try {
      const res = await fetchSafePublicUrl(`${base}/streams/${encodeURIComponent(videoId)}`, {}, 4500);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        title?: string;
        uploader?: string;
        duration?: number;
        thumbnailUrl?: string;
        audioStreams?: Array<{ url?: string; bitrate?: number; mimeType?: string }>;
      };
      const bestAudio = (data.audioStreams || [])
        .filter((s) => Boolean(s.url))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (bestAudio?.url) {
        return {
          audioUrl: bestAudio.url,
          title: data.title,
          artist: data.uploader,
          duration: data.duration,
          artworkUrl: data.thumbnailUrl,
        };
      }
    } catch {
      // Try next instance
    }
  }
  return null;
}

// ---------- App & API Routes ----------

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'aurora-vibes-server', version: '2.5.0' });
  });

  app.get('/api/app-version', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      version: '2.5.0',
      name: 'Aurora Vibes',
      releaseNotes: [
        'CAVA Visualizer Style & Color Studio (Bars, Mirror, Wave, Blocks, Peaks, Radial + 7 palettes)',
        'Native Arch Linux (AUR/PKGBUILD + .desktop) & Debian/Ubuntu (.deb launcher + .desktop) support',
        'Samsung One UI Now Bar hardened Media Session metadata & live position sync',
        'Ultra-fast mobile uploads (384 KB header-slice, artwork resize & 8x parallel batching)',
        'Cleaner streamlined workspace, Calm Study fullscreen & updated Aurora-Vibes.apk v2.5.0',
      ],
    });
  });

  const getRequestAppUrl = (req: Request): string => {
    const rawEnv = process.env.APP_URL;
    if (rawEnv && rawEnv !== 'MY_APP_URL' && /^https?:\/\//i.test(rawEnv)) {
      return rawEnv.replace(/\/+$/, '');
    }
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.get('host') || `localhost:${PORT}`;
    return `${proto}://${host}`;
  };

  app.get('/api/download/desktop/:os', (req: Request, res: Response) => {
    const osName = String(req.params.os || '').toLowerCase();
    const targetUrl = getRequestAppUrl(req);

    if (osName === 'windows') {
      const bat = [
        '@echo off',
        'title Aurora Vibes Desktop',
        `set "AURORA_URL=${targetUrl}"`,
        'where msedge >nul 2>nul && (start "" msedge --app="%AURORA_URL%" --window-size=1280,840 & exit /b)',
        'where chrome >nul 2>nul && (start "" chrome --app="%AURORA_URL%" --window-size=1280,840 & exit /b)',
        'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%AURORA_URL%" & exit /b)',
        'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%AURORA_URL%" & exit /b)',
        'start "" "%AURORA_URL%"',
      ].join('\r\n');
      res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Aurora-Vibes-Windows.bat"');
      res.send(bat);
      return;
    }

    if (osName === 'mac') {
      const macScript = [
        '#!/bin/bash',
        `URL="${targetUrl}"`,
        'if [ -d "/Applications/Google Chrome.app" ]; then',
        '  open -na "Google Chrome" --args --app="$URL" --window-size=1280,840',
        'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
        '  open -na "Microsoft Edge" --args --app="$URL" --window-size=1280,840',
        'elif [ -d "/Applications/Brave Browser.app" ]; then',
        '  open -na "Brave Browser" --args --app="$URL" --window-size=1280,840',
        'else',
        '  open "$URL"',
        'fi',
      ].join('\n');
      res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Aurora-Vibes-Mac.command"');
      res.send(macScript);
      return;
    }

    if (osName === 'arch' || osName === 'debian' || osName === 'linux') {
      const distroLabel =
        osName === 'arch' ? 'Arch Linux' : osName === 'debian' ? 'Debian / Ubuntu' : 'Linux';
      const filename =
        osName === 'arch'
          ? 'Aurora-Vibes-Arch.sh'
          : osName === 'debian'
          ? 'Aurora-Vibes-Debian.sh'
          : 'Aurora-Vibes-Linux.sh';

      const linuxScript = [
        '#!/usr/bin/env bash',
        `# Aurora Vibes Desktop Launcher & App Menu Installer (${distroLabel})`,
        `URL="${targetUrl}"`,
        'ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"',
        'APP_DIR="$HOME/.local/share/applications"',
        'BIN_DIR="$HOME/.local/bin"',
        'mkdir -p "$ICON_DIR" "$APP_DIR" "$BIN_DIR"',
        'curl -fsSL "$URL/pwa-512x512.png" -o "$ICON_DIR/aurora-vibes.png" 2>/dev/null || true',
        'cat << EOF > "$BIN_DIR/aurora-vibes"',
        '#!/usr/bin/env bash',
        'for bin in chromium google-chrome-stable google-chrome chromium-browser brave brave-browser microsoft-edge-stable microsoft-edge; do',
        '  if command -v "$bin" >/dev/null 2>&1; then',
        '    nohup "$bin" --app="${URL}" --class="AuroraVibes" --window-size=1280,840 >/dev/null 2>&1 &',
        '    exit 0',
        '  fi',
        'done',
        'xdg-open "${URL}" >/dev/null 2>&1 &',
        'EOF',
        'chmod +x "$BIN_DIR/aurora-vibes"',
        'cat << EOF > "$APP_DIR/aurora-vibes.desktop"',
        '[Desktop Entry]',
        'Name=Aurora Vibes',
        'Comment=Music Streaming, Calm Study Mode & Local Audio Studio',
        'Exec=$BIN_DIR/aurora-vibes',
        'Icon=aurora-vibes',
        'Terminal=false',
        'Type=Application',
        'Categories=AudioVideo;Audio;Music;Player;',
        'StartupWMClass=AuroraVibes',
        'EOF',
        'command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APP_DIR" 2>/dev/null || true',
        'exec "$BIN_DIR/aurora-vibes"',
      ].join('\n');

      res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(linuxScript);
      return;
    }

    res.status(400).json({ error: 'Unsupported OS. Use windows, mac, arch, debian, or linux.' });
  });

  const resolveApkPath = (): string | null => {
    const candidates = [
      path.resolve(__dirname, 'public', 'Aurora-Vibes.apk'),
      path.resolve(__dirname, 'dist', 'Aurora-Vibes.apk'),
      path.resolve(__dirname, 'public', 'Noir.apk'),
      path.resolve(__dirname, 'dist', 'Noir.apk'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  app.get('/api/apk-status', (_req: Request, res: Response) => {
    const apkPath = resolveApkPath();
    if (!apkPath) {
      res.json({ available: false, sizeBytes: 0, filename: 'Aurora-Vibes.apk' });
      return;
    }
    try {
      const stat = fs.statSync(apkPath);
      res.json({ available: true, sizeBytes: stat.size, filename: 'Aurora-Vibes.apk' });
    } catch {
      res.json({ available: false, sizeBytes: 0, filename: 'Aurora-Vibes.apk' });
    }
  });

  app.get('/api/download/apk', (_req: Request, res: Response) => {
    const apkPath = resolveApkPath();
    if (!apkPath) {
      res.status(404).json({ error: 'Android APK package is not currently available on the server.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="Aurora-Vibes.apk"');
    res.sendFile(apkPath);
  });

  // Global search across connected streaming sources
  app.get('/api/search', async (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQ || rawQ.length > 120) {
      res.status(400).json({ error: 'Provide a search query between 1 and 120 characters.' });
      return;
    }

    const [audius, itunes] = await Promise.all([searchAudiusTracks(rawQ, 8), searchItunesTracks(rawQ, 10)]);
    res.json({ results: [...audius, ...itunes] });
  });

  // Synced + plain lyrics via LRCLIB
  app.get('/api/lyrics', async (req: Request, res: Response) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
    const album = typeof req.query.album === 'string' ? req.query.album.trim() : '';
    const duration = typeof req.query.duration === 'string' ? Math.round(Number(req.query.duration)) : 0;

    if (!title) {
      res.status(400).json({ error: 'Track title is required.' });
      return;
    }

    try {
      const params = new URLSearchParams({ track_name: title });
      if (artist && artist !== 'Unknown Artist') params.set('artist_name', artist);
      if (album && album !== 'Unknown Album') params.set('album_name', album);
      if (duration > 0) params.set('duration', String(duration));

      const exactRes = await fetchSafePublicUrl(`https://lrclib.net/api/get?${params.toString()}`, {}, 6000);
      if (exactRes.ok) {
        const data = (await exactRes.json()) as {
          syncedLyrics?: string;
          plainLyrics?: string;
          instrumental?: boolean;
        };
        if (data.syncedLyrics || data.plainLyrics || data.instrumental) {
          res.json({
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
            instrumental: Boolean(data.instrumental),
            source: 'lrclib',
          });
          return;
        }
      }

      const query = [artist !== 'Unknown Artist' ? artist : '', title].filter(Boolean).join(' ');
      const searchRes = await fetchSafePublicUrl(
        `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
        {},
        6000
      );
      if (searchRes.ok) {
        const list = (await searchRes.json()) as Array<{
          syncedLyrics?: string;
          plainLyrics?: string;
          instrumental?: boolean;
        }>;
        const best = list.find((item) => item.syncedLyrics) || list.find((item) => item.plainLyrics) || list[0];
        if (best) {
          res.json({
            syncedLyrics: best.syncedLyrics || null,
            plainLyrics: best.plainLyrics || null,
            instrumental: Boolean(best.instrumental),
            source: 'lrclib',
          });
          return;
        }
      }

      res.json({ syncedLyrics: null, plainLyrics: null, instrumental: false, source: 'none' });
    } catch {
      res.json({ syncedLyrics: null, plainLyrics: null, instrumental: false, source: 'none' });
    }
  });

  // Universal audio URL extraction
  app.post('/api/extract', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    let parsedUrl: URL;
    try {
      parsedUrl = await validatePublicHttpUrl(rawUrl);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid URL' });
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    const directExtMatch = /\.(mp3|ogg|oga|flac|wav|m4a|aac|opus|webm)(\?.*)?$/i.test(pathname);

    try {
      // 1. Direct audio file link
      if (directExtMatch) {
        const rawFilename = decodeURIComponent(pathname.split('/').pop() || 'Audio Stream');
        const cleanTitle = rawFilename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Remote Audio';
        res.json({
          track: {
            id: `url-${Date.now()}`,
            title: cleanTitle,
            artist: host.replace(/^www\./, ''),
            album: 'Direct Audio URL',
            duration: 0,
            artworkUrl: '',
            streamUrl: toProxiedStreamUrl(parsedUrl.toString()),
            source: 'url',
            originalUrl: parsedUrl.toString(),
          },
        });
        return;
      }

      // 2. Check HEAD content-type for direct audio URLs without extensions
      try {
        const headRes = await fetchSafePublicUrl(parsedUrl.toString(), { method: 'HEAD' }, 4500);
        const contentType = headRes.headers.get('content-type') || '';
        if (contentType.startsWith('audio/')) {
          res.json({
            track: {
              id: `url-${Date.now()}`,
              title: parsedUrl.pathname.split('/').filter(Boolean).pop() || host,
              artist: host.replace(/^www\./, ''),
              album: 'Direct Audio Stream',
              duration: 0,
              artworkUrl: '',
              streamUrl: toProxiedStreamUrl(parsedUrl.toString()),
              source: 'url',
              originalUrl: parsedUrl.toString(),
            },
          });
          return;
        }
      } catch {
        // Proceed to platform extractors
      }

      // 3. Bandcamp extractor (public tralbum mp3-128 stream)
      if (host.endsWith('bandcamp.com')) {
        const pageRes = await fetchSafePublicUrl(parsedUrl.toString(), {}, 8000);
        if (pageRes.ok) {
          const html = await pageRes.text();
          const tralbumMatch = html.match(/data-tralbum="([^"]+)"/);
          const ogImage = extractMetaTag(html, 'og:image') || '';
          const ogTitle = extractMetaTag(html, 'og:title') || '';
          if (tralbumMatch) {
            const tralbum = JSON.parse(decodeHtmlEntities(tralbumMatch[1])) as {
              artist?: string;
              current?: { title?: string };
              trackinfo?: Array<{ title?: string; duration?: number; file?: { 'mp3-128'?: string } }>;
            };
            const firstTrack = tralbum.trackinfo?.find((t) => Boolean(t.file?.['mp3-128']));
            const streamTarget = firstTrack?.file?.['mp3-128'];
            if (streamTarget) {
              res.json({
                track: {
                  id: `bandcamp-${Date.now()}`,
                  title: firstTrack?.title || tralbum.current?.title || ogTitle || 'Bandcamp Track',
                  artist: tralbum.artist || 'Bandcamp Artist',
                  album: tralbum.current?.title || 'Bandcamp',
                  duration: Math.round(firstTrack?.duration || 0),
                  artworkUrl: ogImage,
                  streamUrl: toProxiedStreamUrl(streamTarget),
                  source: 'bandcamp',
                  originalUrl: parsedUrl.toString(),
                },
              });
              return;
            }
          }
        }
      }

      // 4. Optional local yt-dlp extractor if installed on host
      const ytDlpResult = await tryYtDlp(parsedUrl.toString());
      if (ytDlpResult?.audioUrl) {
        res.json({
          track: {
            id: `ytdlp-${Date.now()}`,
            title: ytDlpResult.title || 'Extracted Stream',
            artist: ytDlpResult.artist || host,
            album: ytDlpResult.album || 'Remote Stream',
            duration: ytDlpResult.duration || 0,
            artworkUrl: ytDlpResult.artworkUrl || '',
            streamUrl: toProxiedStreamUrl(ytDlpResult.audioUrl),
            source: host.includes('youtube') || host === 'youtu.be' ? 'youtube' : 'url',
            originalUrl: parsedUrl.toString(),
          },
        });
        return;
      }

      // 5. YouTube (oEmbed + Piped API + Audius/iTunes fallback match)
      const ytId = extractYouTubeId(parsedUrl);
      if (ytId) {
        const piped = await tryPipedYouTubeAudio(ytId);
        if (piped) {
          res.json({
            track: {
              id: `yt-${ytId}`,
              title: piped.title || 'YouTube Audio',
              artist: piped.artist || 'YouTube',
              album: 'YouTube Stream',
              duration: piped.duration || 0,
              artworkUrl: piped.artworkUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
              streamUrl: toProxiedStreamUrl(piped.audioUrl),
              source: 'youtube',
              originalUrl: parsedUrl.toString(),
            },
          });
          return;
        }

        const oembedRes = await fetchSafePublicUrl(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}&format=json`,
          {},
          5000
        );
        if (oembedRes.ok) {
          const meta = (await oembedRes.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
          const searchTitle = (meta.title || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
          const [audius, itunes] = await Promise.all([
            searchAudiusTracks(searchTitle, 2),
            searchItunesTracks(searchTitle, 2),
          ]);
          const matched = audius[0] || itunes[0];
          if (matched) {
            res.json({
              track: {
                ...matched,
                id: `yt-match-${ytId}`,
                title: meta.title || matched.title,
                artist: meta.author_name || matched.artist,
                artworkUrl: meta.thumbnail_url || matched.artworkUrl,
                source: 'youtube',
                originalUrl: parsedUrl.toString(),
                notice: 'Matched stream via public catalog',
              },
            });
            return;
          }
        }
      }

      // 6. Spotify / SoundCloud share links -> extract metadata via oEmbed/OG tags & match playable stream
      if (host.includes('spotify.com') || host.includes('soundcloud.com')) {
        const isSpotify = host.includes('spotify.com');
        let title = '';
        let artist = '';
        let artworkUrl = '';

        try {
          const oembedEndpoint = isSpotify
            ? `https://open.spotify.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`
            : `https://soundcloud.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}&format=json`;
          const oembedRes = await fetchSafePublicUrl(oembedEndpoint, {}, 5000);
          if (oembedRes.ok) {
            const om = (await oembedRes.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
            title = om.title || '';
            artist = om.author_name || '';
            artworkUrl = om.thumbnail_url || '';
          }
        } catch {
          // Ignore and try HTML OG tags
        }

        if (!title || !artist) {
          try {
            const htmlRes = await fetchSafePublicUrl(parsedUrl.toString(), {}, 6000);
            if (htmlRes.ok) {
              const html = await htmlRes.text();
              title = title || extractMetaTag(html, 'og:title') || '';
              artworkUrl = artworkUrl || extractMetaTag(html, 'og:image') || '';
              const desc = extractMetaTag(html, 'og:description') || '';
              if (!artist && desc.includes('·')) {
                artist = desc.split('·')[0].trim();
              }
            }
          } catch {
            // Continue with what we have
          }
        }

        const query = [title, artist].filter(Boolean).join(' ').trim();
        if (query) {
          const [audius, itunes] = await Promise.all([searchAudiusTracks(query, 3), searchItunesTracks(query, 3)]);
          const matched = audius[0] || itunes[0];
          if (matched) {
            res.json({
              track: {
                ...matched,
                id: `${isSpotify ? 'spotify' : 'sc'}-${Date.now()}`,
                title: title || matched.title,
                artist: artist || matched.artist,
                artworkUrl: artworkUrl || matched.artworkUrl,
                source: isSpotify ? 'spotify' : 'soundcloud',
                originalUrl: parsedUrl.toString(),
                notice: isSpotify ? 'Resolved from Spotify share link' : 'Resolved from SoundCloud link',
              },
            });
            return;
          }
        }
      }

      // 7. Generic HTML page: check og:audio or <audio> tag
      const genericRes = await fetchSafePublicUrl(parsedUrl.toString(), {}, 6000);
      if (genericRes.ok) {
        const ctype = genericRes.headers.get('content-type') || '';
        if (ctype.includes('text/html')) {
          const html = await genericRes.text();
          const ogAudio = extractMetaTag(html, 'og:audio') || extractMetaTag(html, 'og:audio:secure_url');
          const audioTagMatch = html.match(/<(?:audio|source)[^>]+src=["']([^"']+)["']/i);
          const candidate = ogAudio || (audioTagMatch ? decodeHtmlEntities(audioTagMatch[1]) : null);
          if (candidate) {
            const resolvedAudio = new URL(candidate, parsedUrl);
            await validatePublicHttpUrl(resolvedAudio.toString());
            res.json({
              track: {
                id: `web-${Date.now()}`,
                title: extractMetaTag(html, 'og:title') || host,
                artist: extractMetaTag(html, 'og:site_name') || host,
                album: 'Web Audio Extract',
                duration: 0,
                artworkUrl: extractMetaTag(html, 'og:image') || '',
                streamUrl: toProxiedStreamUrl(resolvedAudio.toString()),
                source: 'url',
                originalUrl: parsedUrl.toString(),
              },
            });
            return;
          }
        }
      }

      res.status(422).json({
        error: 'Could not find a playable audio stream at that URL. Try a direct MP3/FLAC/OGG/WAV link, Bandcamp, Audius, or SoundCloud/YouTube/Spotify track URL.',
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to extract audio from URL.',
      });
    }
  });

  // Streaming audio proxy with HTTP Range support & CORS headers for Web Audio AnalyserNode
  app.get('/api/stream', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    try {
      await validatePublicHttpUrl(rawUrl);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid stream URL' });
      return;
    }

    try {
      const forwardHeaders: Record<string, string> = {};
      if (typeof req.headers.range === 'string') {
        forwardHeaders.Range = req.headers.range;
      }

      const upstream = await fetchSafePublicUrl(rawUrl, { headers: forwardHeaders }, 15000);
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: `Upstream returned status ${upstream.status}` });
        return;
      }

      res.status(upstream.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
      for (const h of passthroughHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstream.headers.get('content-type')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Stream proxy error' });
      }
    }
  });

  // ---------- Spotify OAuth & Playlist Auto-Sync ----------

  interface PendingSpotifyAuth {
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
    createdAt: number;
  }

  interface SpotifySession {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    clientId: string;
    user: {
      id: string;
      displayName: string;
      avatarUrl: string;
    };
  }

  const pendingSpotifyAuths = new Map<string, PendingSpotifyAuth>();
  const spotifySessions = new Map<string, SpotifySession>();

  const getAppBaseUrl = (): string => {
    const raw = process.env.APP_URL;
    if (raw && raw !== 'MY_APP_URL' && /^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, '');
    }
    return `http://localhost:${PORT}`;
  };

  const getSpotifyRedirectUri = (): string => `${getAppBaseUrl()}/auth/spotify/callback`;

  const extractBearerSession = (req: Request): { token: string; session: SpotifySession } | null => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    const session = spotifySessions.get(token);
    if (!session) return null;
    return { token, session };
  };

  const ensureValidSpotifyToken = async (session: SpotifySession): Promise<string> => {
    if (Date.now() < session.expiresAt - 60_000) {
      return session.accessToken;
    }
    if (!session.refreshToken) {
      throw new Error('Spotify session expired; please reconnect.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: session.clientId,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (secret && session.clientId === process.env.SPOTIFY_CLIENT_ID) {
      headers.Authorization = `Basic ${Buffer.from(`${session.clientId}:${secret}`).toString('base64')}`;
    }

    const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });
    if (!refreshRes.ok) {
      throw new Error('Failed to refresh Spotify access token.');
    }
    const tokenJson = (await refreshRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    session.accessToken = tokenJson.access_token;
    if (tokenJson.refresh_token) session.refreshToken = tokenJson.refresh_token;
    session.expiresAt = Date.now() + (tokenJson.expires_in || 3600) * 1000;
    return session.accessToken;
  };

  app.get('/api/spotify/status', (req: Request, res: Response) => {
    const auth = extractBearerSession(req);
    const serverClientId = process.env.SPOTIFY_CLIENT_ID || '';
    res.json({
      configured: Boolean(serverClientId),
      redirectUri: getSpotifyRedirectUri(),
      connected: Boolean(auth),
      user: auth ? auth.session.user : null,
    });
  });

  app.get('/api/spotify/auth-url', (req: Request, res: Response) => {
    const customClientId =
      typeof req.query.clientId === 'string' && /^[A-Za-z0-9]{16,64}$/.test(req.query.clientId.trim())
        ? req.query.clientId.trim()
        : '';
    const clientId = process.env.SPOTIFY_CLIENT_ID || customClientId;

    if (!clientId) {
      res.status(400).json({
        error: 'Spotify Client ID is not configured. Set SPOTIFY_CLIENT_ID in AI Studio Secrets or enter your Spotify App Client ID.',
      });
      return;
    }

    // Prune expired pending OAuth states
    const now = Date.now();
    for (const [k, v] of pendingSpotifyAuths.entries()) {
      if (now - v.createdAt > 10 * 60_000) pendingSpotifyAuths.delete(k);
    }

    const state = crypto.randomBytes(24).toString('hex');
    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectUri = getSpotifyRedirectUri();

    pendingSpotifyAuths.set(state, {
      codeVerifier,
      clientId,
      redirectUri,
      createdAt: now,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'playlist-read-private playlist-read-collaborative user-read-private user-read-email',
      redirect_uri: redirectUri,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    res.json({
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  const handleSpotifyCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError || !code || !state) {
      res.status(400).send(`
        <html><body style="background:#0a0a0a;color:#f4f4f5;font-family:sans-serif;padding:2rem;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: ${JSON.stringify(oauthError || 'Authorization cancelled')} }, '*');
              window.close();
            }
          </script>
          <p>Spotify authorization was cancelled or failed. You may close this window.</p>
        </body></html>
      `);
      return;
    }

    const pending = pendingSpotifyAuths.get(state);
    pendingSpotifyAuths.delete(state);
    if (!pending) {
      res.status(400).send('Invalid or expired OAuth state. Please retry connecting Spotify.');
      return;
    }

    try {
      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pending.redirectUri,
        client_id: pending.clientId,
        code_verifier: pending.codeVerifier,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const secret = process.env.SPOTIFY_CLIENT_SECRET;
      if (secret && pending.clientId === process.env.SPOTIFY_CLIENT_ID) {
        headers.Authorization = `Basic ${Buffer.from(`${pending.clientId}:${secret}`).toString('base64')}`;
      }

      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers,
        body: form.toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Spotify token exchange failed (${tokenRes.status}): ${errText}`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!meRes.ok) {
        throw new Error('Failed to fetch Spotify profile.');
      }
      const me = (await meRes.json()) as {
        id: string;
        display_name?: string;
        images?: Array<{ url: string }>;
      };

      const sessionToken = crypto.randomBytes(32).toString('hex');
      spotifySessions.set(sessionToken, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
        clientId: pending.clientId,
        user: {
          id: me.id,
          displayName: me.display_name || me.id,
          avatarUrl: me.images?.[0]?.url || '',
        },
      });

      res.send(`
        <html>
          <body style="background:#0a0a0a;color:#f4f4f5;font-family:sans-serif;padding:2rem;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', sessionToken: ${JSON.stringify(sessionToken)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Spotify connected. This window will close automatically.</p>
          </body>
        </html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Spotify authentication failed';
      res.status(500).send(`
        <html><body style="background:#0a0a0a;color:#f4f4f5;font-family:sans-serif;padding:2rem;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
              window.close();
            }
          </script>
          <p>${msg.replace(/[<>&]/g, '')}</p>
        </body></html>
      `);
    }
  };

  app.get(['/auth/spotify/callback', '/auth/spotify/callback/'], handleSpotifyCallback);

  app.post('/api/spotify/disconnect', (req: Request, res: Response) => {
    const auth = extractBearerSession(req);
    if (auth) {
      spotifySessions.delete(auth.token);
    }
    res.json({ ok: true });
  });

  app.get('/api/spotify/playlists', async (req: Request, res: Response) => {
    const auth = extractBearerSession(req);
    if (!auth) {
      res.status(401).json({ error: 'Not connected to Spotify.' });
      return;
    }

    try {
      const token = await ensureValidSpotifyToken(auth.session);
      const spRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!spRes.ok) {
        res.status(spRes.status).json({ error: 'Failed to load Spotify playlists.' });
        return;
      }
      const data = (await spRes.json()) as {
        items?: Array<{
          id: string;
          name: string;
          description?: string;
          images?: Array<{ url: string }>;
          tracks?: { total?: number };
          items?: { total?: number };
          owner?: { display_name?: string };
        }>;
      };
      const playlists = (data.items || [])
        .filter((p) => Boolean(p && p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          artworkUrl: p.images?.[0]?.url || '',
          trackCount: p.tracks?.total ?? p.items?.total ?? 0,
          owner: p.owner?.display_name || '',
        }));
      res.json({ playlists });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Spotify playlist fetch failed' });
    }
  });

  app.get('/api/spotify/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
    const auth = extractBearerSession(req);
    if (!auth) {
      res.status(401).json({ error: 'Not connected to Spotify.' });
      return;
    }
    const playlistId = String(req.params.playlistId || '').trim();
    if (!/^[A-Za-z0-9]{1,64}$/.test(playlistId)) {
      res.status(400).json({ error: 'Invalid Spotify playlist ID.' });
      return;
    }

    try {
      const token = await ensureValidSpotifyToken(auth.session);
      const spRes = await fetch(
        `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!spRes.ok) {
        res.status(spRes.status).json({ error: 'Failed to load Spotify playlist tracks.' });
        return;
      }
      const data = (await spRes.json()) as {
        items?: Array<{
          added_at?: string;
          track?: {
            id?: string;
            name?: string;
            duration_ms?: number;
            preview_url?: string | null;
            external_urls?: { spotify?: string };
            artists?: Array<{ name: string }>;
            album?: { name?: string; images?: Array<{ url: string }> };
          };
        }>;
      };

      const tracks = (data.items || [])
        .map((entry) => entry.track)
        .filter((t): t is NonNullable<typeof t> => Boolean(t && t.id && t.name))
        .map((t) => ({
          spotifyId: t.id!,
          title: t.name!,
          artist: (t.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist',
          album: t.album?.name || 'Spotify Playlist',
          duration: Math.round((t.duration_ms || 0) / 1000),
          artworkUrl: t.album?.images?.[0]?.url || '',
          previewUrl: t.preview_url || null,
          spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
        }));

      res.json({ tracks });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Spotify track fetch failed' });
    }
  });

  app.post('/api/spotify/resolve-download', async (req: Request, res: Response) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim() : '';
    const album = typeof req.body?.album === 'string' ? req.body.album.trim() : 'Spotify Sync';
    const artworkUrl = typeof req.body?.artworkUrl === 'string' ? req.body.artworkUrl.trim() : '';
    const previewUrl = typeof req.body?.previewUrl === 'string' ? req.body.previewUrl.trim() : '';
    const spotifyUrl = typeof req.body?.spotifyUrl === 'string' ? req.body.spotifyUrl.trim() : '';

    if (!title) {
      res.status(400).json({ error: 'Track title is required.' });
      return;
    }

    const query = [title, artist].filter(Boolean).join(' ');

    // 1. Prefer direct Spotify preview URL if provided
    if (previewUrl) {
      try {
        await validatePublicHttpUrl(previewUrl);
        res.json({
          track: {
            id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title,
            artist: artist || 'Spotify Artist',
            album,
            duration: 30,
            artworkUrl,
            streamUrl: toProxiedStreamUrl(previewUrl),
            source: 'spotify',
            originalUrl: spotifyUrl,
            format: 'MP3',
            notice: 'Auto-downloaded from Spotify sync',
          },
        });
        return;
      } catch {
        // Fallback to catalog search
      }
    }

    // 2. Resolve via Audius full-track or iTunes preview
    const [audius, itunes] = await Promise.all([searchAudiusTracks(query, 3), searchItunesTracks(query, 3)]);
    const match = audius[0] || itunes[0];
    if (!match) {
      res.status(404).json({ error: `Could not find downloadable audio match for "${title}".` });
      return;
    }

    res.json({
      track: {
        ...match,
        id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        artist: artist || match.artist,
        album,
        artworkUrl: artworkUrl || match.artworkUrl,
        source: 'spotify',
        originalUrl: spotifyUrl || match.originalUrl,
        format: match.source === 'audius' ? 'MP3' : 'M4A',
        notice: match.source === 'audius' ? 'Auto-downloaded full stream' : 'Auto-downloaded 30s preview',
      },
    });
  });

  const httpServer = http.createServer(app);

  // Vite dev middleware vs production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !hmrDisabled,
        ws: { server: httpServer },
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Aurora Vibes audio server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp();
