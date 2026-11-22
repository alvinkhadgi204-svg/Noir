import { parseBlob } from 'music-metadata';
import type { LyricLine, Track } from '../types/music';

const SUPPORTED_AUDIO_EXT = /\.(mp3|flac|ogg|oga|wav|m4a|aac|opus|webm)$/i;

export function isSupportedAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || SUPPORTED_AUDIO_EXT.test(file.name);
}

async function compressArtworkToDataUrl(data: Uint8Array, mimeType: string): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy.buffer], { type: mimeType || 'image/jpeg' });

  // Fast thumbnail resize on mobile for heavy embedded cover art (> 90 KB)
  if (blob.size > 90 * 1024 && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const maxDim = 360;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        return canvas.toDataURL('image/jpeg', 0.8);
      }
      bitmap.close();
    } catch {
      // Fall back cleanly to FileReader below
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

export async function parseLocalAudioFile(
  file: File,
  options: { skipDurationProbe?: boolean } = {}
): Promise<{ track: Track; blob: Blob }> {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Track';
  const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  let title = fallbackTitle;
  let artist = 'Local File';
  let album = 'Local Library';
  let duration = 0;
  let artworkUrl = '';
  let bitrate: number | undefined;
  let sampleRate: number | undefined;
  let formatName = ext;
  let syncedLyrics: string | null = null;
  let plainLyrics: string | null = null;

  try {
    // 384 KB header slice reads ID3v2/FLAC/MP4 tags & art rapidly on mobile without scanning whole file
    const headerSlice = file.size > 384 * 1024 ? file.slice(0, 384 * 1024) : file;
    const metadata = await parseBlob(headerSlice, { duration: false, skipPostHeaders: true });
    const { common, format } = metadata;
    if (common.title) title = common.title;
    if (common.artist) artist = common.artist;
    else if (common.albumartist) artist = common.albumartist;
    if (common.album) album = common.album;
    if (format.duration) duration = Math.round(format.duration);
    if (format.bitrate) bitrate = Math.round(format.bitrate / 1000);
    if (format.sampleRate) sampleRate = format.sampleRate;
    if (format.codec || format.container) {
      formatName = (format.codec || format.container || ext).toUpperCase();
    }

    const picture = common.picture?.[0];
    if (picture && picture.data && picture.data.byteLength <= 3 * 1024 * 1024) {
      artworkUrl = await compressArtworkToDataUrl(picture.data, picture.format);
    }

    if (common.lyrics && common.lyrics.length > 0) {
      const firstLyric = common.lyrics[0];
      if (typeof firstLyric === 'string') {
        if (/\[\d{1,2}:\d{2}/.test(firstLyric)) {
          syncedLyrics = firstLyric;
        } else {
          plainLyrics = firstLyric;
        }
      } else if (firstLyric && typeof firstLyric === 'object') {
        if ('syncText' in firstLyric && Array.isArray(firstLyric.syncText) && firstLyric.syncText.length > 0) {
          syncedLyrics = firstLyric.syncText
            .map((entry: { timestamp?: number; text: string }) => {
              const ms = entry.timestamp || 0;
              const mins = Math.floor(ms / 60000);
              const secs = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
              return `[${String(mins).padStart(2, '0')}:${secs}] ${entry.text}`;
            })
            .join('\n');
        } else if ('text' in firstLyric && typeof firstLyric.text === 'string') {
          plainLyrics = firstLyric.text;
        }
      }
    }
  } catch {
    // Fallback cleanly to filename metadata
  }

  const objectUrl = URL.createObjectURL(file);

  if (!duration && !options.skipDurationProbe) {
    duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      let settled = false;
      const finish = (val: number) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        resolve(val);
      };
      const timer = window.setTimeout(() => finish(0), 900);
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
        finish(d);
      };
      audio.onerror = () => finish(0);
      audio.src = objectUrl;
    });
  }

  const track: Track = {
    id,
    title,
    artist,
    album,
    duration,
    artworkUrl,
    streamUrl: objectUrl,
    source: 'local',
    format: formatName,
    bitrate,
    sampleRate,
    fileSize: file.size,
    addedAt: Date.now(),
    hasLocalBlob: true,
    syncedLyrics,
    plainLyrics,
  };

  return { track, blob: file };
}

export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  const tagRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(tagRegex)];
    if (matches.length === 0) continue;
    const text = line.replace(tagRegex, '').trim();
    if (!text) continue;

    for (const m of matches) {
      const minutes = Number(m[1]);
      const seconds = Number(m[2]);
      const fracRaw = m[3] || '0';
      const frac = Number(fracRaw) / Math.pow(10, fracRaw.length);
      parsed.push({
        time: minutes * 60 + seconds + frac,
        text,
      });
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function exportPlaylistM3u(name: string, tracks: Track[]): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${name}`];
  for (const t of tracks) {
    lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist} - ${t.title}`);
    lines.push(t.originalUrl || t.streamUrl);
  }
  return lines.join('\n');
}
