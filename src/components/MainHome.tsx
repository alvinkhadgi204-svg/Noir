import React from 'react';
import { BookOpen, HardDrive, Link2, Pin, Play, Shuffle } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { formatTime } from '../utils/localFiles';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';
import { TrackRow } from './TrackRow';

export const MainHome: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const username = usePlayerStore((s) => s.username);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const setUrlImportOpen = usePlayerStore((s) => s.setUrlImportOpen);
  const setCalmStudyMode = usePlayerStore((s) => s.setCalmStudyMode);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffle = usePlayerStore((s) => s.shuffle);

  const featuredTrack = tracks.find((t) => t.id === currentTrackId) || tracks[0];
  const pinnedPlaylists = playlists.filter((p) => p.pinned);
  const displayPlaylists = pinnedPlaylists.length > 0 ? pinnedPlaylists : playlists.slice(0, 4);

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    if (!shuffle) toggleShuffle();
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    void playTrack(randomTrack, tracks);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-10 pb-16">
      {/* Featured Listening Session Hero or Clean Studio Welcome */}
      {featuredTrack ? (
        <section className="noir-card p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8">
          <CoverArt
            src={featuredTrack.artworkUrl}
            alt={featuredTrack.title}
            size="lg"
            className="shadow-2xl"
          />

          <div className="flex-1 min-w-0 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--noir-accent)]">
                Featured Session · {featuredTrack.album}
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white [text-wrap:balance]">
                {featuredTrack.title}
              </h2>
              <p className="text-sm text-neutral-400">
                <span>{featuredTrack.artist}</span>
                <span className="mx-2 text-neutral-600" aria-hidden="true">·</span>
                <span className="tabular-nums">{formatTime(featuredTrack.duration)}</span>
                {featuredTrack.format && (
                  <>
                    <span className="mx-2 text-neutral-600" aria-hidden="true">·</span>
                    <span>{featuredTrack.format}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => void playTrack(featuredTrack, tracks)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity whitespace-nowrap shrink-0"
              >
                <NoirIcon icon={Play} fillable className="w-4 h-4" />
                <span>Play Session</span>
              </button>

              <button
                onClick={handleShufflePlay}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 noir-btn transition-colors whitespace-nowrap shrink-0"
              >
                <NoirIcon icon={Shuffle} className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              <button
                onClick={() => {
                  setCalmStudyMode(true);
                  setNowPlayingOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] noir-btn transition-colors whitespace-nowrap shrink-0"
              >
                <NoirIcon icon={BookOpen} className="w-4 h-4 text-[var(--noir-accent)]" />
                <span>Calm Study</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="noir-card p-6 sm:p-8 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--noir-accent)]">
              {username ? `Welcome back, ${username} · Aurora Vibes Studio` : 'Aurora Vibes Studio'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white [text-wrap:balance]">
              Your personal music player, ready for your tracks
            </h2>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Import local MP3, FLAC, OGG, WAV, or M4A files from your phone or computer, stream audio links, or sync playlists.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => setActiveView('local')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity whitespace-nowrap shrink-0"
            >
              <NoirIcon icon={HardDrive} className="w-4 h-4" />
              <span>Import Audio</span>
            </button>

            <button
              onClick={() => setUrlImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 noir-btn transition-colors whitespace-nowrap shrink-0"
            >
              <NoirIcon icon={Link2} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Fetch URL</span>
            </button>

            <button
              onClick={() => setActiveView('search')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] noir-btn transition-colors whitespace-nowrap shrink-0"
            >
              <span>Search</span>
            </button>
          </div>
        </section>
      )}

      {/* Pinned Playlists */}
      {displayPlaylists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Pinned Playlists</h3>
            <button
              onClick={() => setActiveView('library')}
              className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              View Library
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActiveView('playlist', pl.id)}
                className="group noir-card p-3.5 text-left hover:bg-[var(--noir-elevated)] transition-colors flex items-center gap-3.5"
              >
                <CoverArt src={pl.artworkUrl} alt={pl.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate group-hover:text-[var(--noir-accent)] transition-colors">
                      {pl.name}
                    </p>
                    {pl.pinned && <NoirIcon icon={Pin} fillable className="w-3 h-3 text-[var(--noir-accent)] shrink-0" />}
                  </div>
                  <p className="text-xs text-neutral-400 tabular-nums mt-0.5">
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Library Tracks A-Z List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">All Tracks (A–Z)</h3>
          <span className="text-xs text-neutral-500 tabular-nums">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="noir-card p-8 text-center text-xs text-neutral-500">
            Your library is clean and empty. Add your own music files, paste a song link, or search to start listening.
          </div>
        ) : (
          <div className="noir-card p-2 divide-y divide-white/[0.04]">
            {[...tracks]
              .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
              .map((track, i, sortedList) => (
                <TrackRow key={track.id} track={track} index={i} queueContext={sortedList} />
              ))}
          </div>
        )}
      </section>
    </div>
  );
};
