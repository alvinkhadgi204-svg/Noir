import React, { useEffect, useState } from 'react';
import { Globe, HardDrive, Plus, Search as SearchIcon } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/music';
import { formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';
import { TrackRow } from './TrackRow';

type SearchTab = 'all' | 'local' | 'online' | 'playlists';

export const SearchView: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const addExternalTrack = usePlayerStore((s) => s.addExternalTrack);
  const setActiveView = usePlayerStore((s) => s.setActiveView);

  const [tab, setTab] = useState<SearchTab>('all');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const q = searchQuery.trim().toLowerCase();

  const localMatches = q
    ? tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      )
    : tracks.slice(0, 8);

  const playlistMatches = q
    ? playlists.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    : playlists;

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setOnlineResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        let normalized: Track[] | null = null;
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = (await res.json()) as { results?: Array<Omit<Track, 'addedAt'>> };
            normalized = (data.results || []).map((r) => ({
              ...r,
              addedAt: Date.now(),
            }));
          }
        } catch {
          // Fall back to direct Audius CORS endpoint (e.g. inside standalone Android APK)
        }

        if (!normalized) {
          const directRes = await fetch(
            `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(trimmed)}&app_name=NoirAudioStudio&limit=12`
          );
          if (directRes.ok) {
            const json = (await directRes.json()) as {
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
            normalized = (json.data || [])
              .filter((item) => item.id && item.title && item.is_streamable !== false && Boolean(item.stream?.url || item.preview?.url))
              .map((item) => ({
                id: `audius-${item.id}`,
                title: item.title,
                artist: item.user?.name || 'Independent Artist',
                album: item.genre || 'Audius Catalog',
                duration: Number(item.duration) || 180,
                artworkUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
                streamUrl: item.stream?.url || item.preview?.url || '',
                source: 'audius' as const,
                originalUrl: item.permalink ? `https://audius.co${item.permalink}` : undefined,
                addedAt: Date.now(),
              }));
          }
        }

        if (!cancelled) {
          setOnlineResults(normalized || []);
        }
      } catch {
        if (!cancelled) setOnlineResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 340);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Search Input & Filter Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <NoirIcon
            icon={SearchIcon}
            className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, albums, Audius & studio catalog..."
            autoFocus
            className="w-full pl-11 pr-4 py-3 text-sm bg-[var(--noir-surface)] border border-white/10 rounded-[var(--noir-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)] transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--noir-surface)] border border-white/[0.06] rounded-[var(--noir-btn-radius)] w-fit">
          {[
            { id: 'all' as const, label: 'All Sources' },
            { id: 'local' as const, label: `Library (${localMatches.length})` },
            { id: 'online' as const, label: `Online (${onlineResults.length})` },
            { id: 'playlists' as const, label: `Playlists (${playlistMatches.length})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'bg-[var(--noir-elevated)] text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Playlists Matches */}
      {(tab === 'all' || tab === 'playlists') && playlistMatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-200">Playlists</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlistMatches.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActiveView('playlist', pl.id)}
                className="noir-card p-3 text-left flex items-center gap-3 hover:bg-[var(--noir-elevated)] transition-colors"
              >
                <CoverArt src={pl.artworkUrl} alt={pl.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{pl.name}</p>
                  <p className="text-xs text-neutral-500 tabular-nums">
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Local & Saved Library Matches */}
      {(tab === 'all' || tab === 'local') && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <NoirIcon icon={HardDrive} className="w-4 h-4 text-[var(--noir-accent)]" />
            <span>{q ? 'Matching Library Tracks' : 'Your Library'}</span>
          </div>

          {localMatches.length === 0 ? (
            <div className="noir-card p-6 text-center text-xs text-neutral-500">
              No matching tracks in your local or saved library.
            </div>
          ) : (
            <div className="noir-card p-2">
              {localMatches.map((track, idx) => (
                <TrackRow key={track.id} track={track} index={idx} queueContext={localMatches} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Connected Online Sources (Audius + iTunes) */}
      {(tab === 'all' || tab === 'online') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <NoirIcon icon={Globe} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Connected Audio Sources</span>
            </div>
            <span className="text-xs text-neutral-500">Audius &amp; Studio Catalog</span>
          </div>

          {!q || q.length < 2 ? (
            <div className="noir-card p-8 text-center text-xs text-neutral-400">
              Type at least 2 characters to search connected streaming catalogs.
            </div>
          ) : loading ? (
            <div className="noir-card p-3 space-y-2">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-12 rounded-md bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : onlineResults.length === 0 ? (
            <div className="noir-card p-8 text-center text-xs text-neutral-500">
              No online streams found for "{searchQuery}". Try another artist or track title, or use Fetch URL.
            </div>
          ) : (
            <div className="noir-card p-2 divide-y divide-white/[0.04]">
              {onlineResults.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.04] rounded-[var(--noir-btn-radius)] transition-colors"
                >
                  <button
                    onClick={() => void playTrack(track, onlineResults)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <CoverArt src={track.artworkUrl} alt={track.title} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-xs text-neutral-400 truncate">
                        <span>{track.artist}</span>
                        <span className="mx-1.5 text-neutral-600" aria-hidden="true">·</span>
                        <span>{track.source === 'audius' ? 'Audius Full Stream' : '30s Catalog Preview'}</span>
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {formatTime(track.duration)}
                    </span>
                    <button
                      onClick={() => void addExternalTrack(track, false)}
                      title="Save to Library"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn transition-colors whitespace-nowrap"
                    >
                      <NoirIcon icon={Plus} className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
