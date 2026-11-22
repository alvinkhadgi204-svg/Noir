import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { CoverArt } from './CoverArt';
import { NoirIcon } from './NoirIcon';

function copyTextFallback(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const SpotifySyncView: React.FC = () => {
  const spotifyConfigured = usePlayerStore((s) => s.spotifyConfigured);
  const spotifyRedirectUri = usePlayerStore((s) => s.spotifyRedirectUri);
  const spotifyConnected = usePlayerStore((s) => s.spotifyConnected);
  const spotifyUser = usePlayerStore((s) => s.spotifyUser);
  const spotifyPlaylists = usePlayerStore((s) => s.spotifyPlaylists);
  const watchedPlaylistIds = usePlayerStore((s) => s.watchedPlaylistIds);
  const spotifyWatchEnabled = usePlayerStore((s) => s.spotifyWatchEnabled);
  const autoSaveDeviceDownloads = usePlayerStore((s) => s.autoSaveDeviceDownloads);
  const spotifySyncing = usePlayerStore((s) => s.spotifySyncing);
  const spotifyLastSyncedAt = usePlayerStore((s) => s.spotifyLastSyncedAt);
  const spotifyDownloadLogs = usePlayerStore((s) => s.spotifyDownloadLogs);

  const connectSpotify = usePlayerStore((s) => s.connectSpotify);
  const disconnectSpotify = usePlayerStore((s) => s.disconnectSpotify);
  const fetchSpotifyPlaylists = usePlayerStore((s) => s.fetchSpotifyPlaylists);
  const toggleWatchPlaylist = usePlayerStore((s) => s.toggleWatchPlaylist);
  const setSpotifyWatchEnabled = usePlayerStore((s) => s.setSpotifyWatchEnabled);
  const setAutoSaveDeviceDownloads = usePlayerStore((s) => s.setAutoSaveDeviceDownloads);
  const syncWatchedPlaylists = usePlayerStore((s) => s.syncWatchedPlaylists);
  const showToast = usePlayerStore((s) => s.showToast);

  const [customClientId, setCustomClientId] = useState('');
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyRedirectUri = async () => {
    if (!spotifyRedirectUri) return;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(spotifyRedirectUri);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      copied = copyTextFallback(spotifyRedirectUri);
    }
    if (copied) {
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 2000);
      showToast('Redirect URI copied to clipboard', 'success');
    } else {
      showToast('Select and copy the Redirect URI manually', 'info');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header Connection Card */}
      <section className="noir-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-[var(--noir-btn-radius)] bg-[var(--noir-elevated)] border border-white/10 flex items-center justify-center shrink-0">
              {spotifyConnected && spotifyUser?.avatarUrl ? (
                <img
                  src={spotifyUser.avatarUrl}
                  alt={spotifyUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-[var(--noir-btn-radius)]"
                />
              ) : (
                <NoirIcon icon={Radio} className="w-5 h-5 text-[var(--noir-accent)]" />
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {spotifyConnected && spotifyUser
                    ? spotifyUser.displayName
                    : 'Spotify Playlist Watcher'}
                </h2>
                <span className="text-xs text-[var(--noir-accent)]">
                  {spotifyConnected ? '· Connected' : '· Auto-Download Sync'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
                Connect your Spotify account and watch any playlist. Whenever a new song is added on Spotify, Noir automatically resolves the audio stream and saves an offline copy into IndexedDB (and optionally your device Downloads folder).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {spotifyConnected ? (
              <>
                <button
                  onClick={() => void fetchSpotifyPlaylists()}
                  className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn transition-colors whitespace-nowrap"
                >
                  <NoirIcon icon={RefreshCw} className="w-3.5 h-3.5" />
                  <span>Reload Playlists</span>
                </button>
                <button
                  onClick={() => void disconnectSpotify()}
                  className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 border border-white/10 noir-btn transition-colors whitespace-nowrap"
                >
                  <NoirIcon icon={LogOut} className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => void connectSpotify(customClientId)}
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity whitespace-nowrap"
              >
                <NoirIcon icon={ExternalLink} className="w-3.5 h-3.5" />
                <span>Connect Spotify Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Setup details when not yet connected or missing server Client ID */}
        {!spotifyConnected && (
          <div className="pt-4 border-t border-white/[0.06] space-y-4">
            {!spotifyConfigured && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Spotify App Client ID (or set SPOTIFY_CLIENT_ID in Secrets)
                </label>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="Paste your 32-character Spotify Client ID..."
                  className="w-full max-w-md px-3.5 py-2.5 text-xs bg-[var(--noir-base)] border border-white/15 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)]"
                />
              </div>
            )}

            <div className="space-y-2 text-xs text-neutral-400">
              <p className="font-medium text-neutral-300">
                Add this exact Redirect URI in your Spotify Developer Dashboard App settings:
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <code className="px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-neutral-200 font-mono text-[11px] break-all select-all">
                  {spotifyRedirectUri || 'Loading redirect URI...'}
                </code>
                <button
                  onClick={() => void handleCopyRedirectUri()}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn shrink-0 w-fit"
                >
                  <NoirIcon icon={copiedUri ? Check : Copy} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
                  <span>{copiedUri ? 'Copied' : 'Copy URI'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Watch & Auto-Download Preferences */}
        {spotifyConnected && (
          <div className="pt-4 border-t border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2.5 text-xs text-neutral-200 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={spotifyWatchEnabled}
                  onChange={(e) => setSpotifyWatchEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[var(--noir-accent)] rounded"
                />
                <span>Auto-check watched playlists every 30s</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-neutral-200 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={autoSaveDeviceDownloads}
                  onChange={(e) => setAutoSaveDeviceDownloads(e.target.checked)}
                  className="w-4 h-4 accent-[var(--noir-accent)] rounded"
                />
                <span>Also export file to device Downloads</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => void syncWatchedPlaylists(false)}
                disabled={spotifySyncing || watchedPlaylistIds.length === 0}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 disabled:opacity-40 noir-btn transition-opacity whitespace-nowrap"
              >
                <NoirIcon icon={RefreshCw} className={`w-3.5 h-3.5 ${spotifySyncing ? 'animate-spin' : ''}`} />
                <span>{spotifySyncing ? 'Checking...' : 'Check for New Songs'}</span>
              </button>

              <button
                onClick={() => void syncWatchedPlaylists(true)}
                disabled={spotifySyncing || watchedPlaylistIds.length === 0}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 disabled:opacity-40 noir-btn transition-colors whitespace-nowrap"
              >
                <NoirIcon icon={Download} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
                <span>Download All Watched Tracks</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Spotify Playlists Grid */}
      {spotifyConnected && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              Your Spotify Playlists (A–Z)
            </h3>
            <span className="text-xs text-neutral-400 tabular-nums">
              {watchedPlaylistIds.length} watched
              {spotifyLastSyncedAt ? ` · Last check ${new Date(spotifyLastSyncedAt).toLocaleTimeString()}` : ''}
            </span>
          </div>

          {spotifyPlaylists.length === 0 ? (
            <div className="noir-card p-8 text-center text-xs text-neutral-400">
              No Spotify playlists found on this account yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {spotifyPlaylists.map((pl) => {
                const isWatched = watchedPlaylistIds.includes(pl.id);
                return (
                  <div
                    key={pl.id}
                    className={`noir-card p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isWatched ? 'border-[var(--noir-accent)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <CoverArt src={pl.artworkUrl} alt={pl.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{pl.name}</p>
                        <p className="text-xs text-neutral-400 truncate">
                          <span className="tabular-nums">{pl.trackCount}</span> tracks
                          {pl.owner ? ` · ${pl.owner}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => void toggleWatchPlaylist(pl)}
                      className={`min-h-[40px] px-3.5 py-2 text-xs font-medium border noir-btn transition-colors whitespace-nowrap shrink-0 ${
                        isWatched
                          ? 'bg-[var(--noir-accent)] text-black border-transparent font-semibold'
                          : 'bg-[var(--noir-elevated)] text-neutral-200 border-white/10 hover:bg-white/15'
                      }`}
                    >
                      {isWatched ? 'Watching' : 'Watch Playlist'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Auto-Download Activity Log */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Auto-Download Activity</h3>
          <span className="text-xs text-neutral-500 tabular-nums">
            {spotifyDownloadLogs.length} {spotifyDownloadLogs.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {spotifyDownloadLogs.length === 0 ? (
          <div className="noir-card p-6 text-center text-xs text-neutral-500">
            Select a playlist to watch above. Newly added tracks on Spotify will automatically download here for offline playback in alphabetical A–Z order.
          </div>
        ) : (
          <div className="noir-card divide-y divide-white/[0.05]">
            {spotifyDownloadLogs.map((log) => (
              <div
                key={log.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">
                    {log.title} <span className="text-neutral-500 font-normal">· {log.artist}</span>
                  </p>
                  <p className="text-neutral-400 truncate mt-0.5">
                    Playlist: {log.playlistName} · {log.message}
                  </p>
                </div>
                <span
                  className={`font-medium whitespace-nowrap shrink-0 ${
                    log.status === 'saved'
                      ? 'text-[var(--noir-accent)]'
                      : log.status === 'error'
                      ? 'text-red-400'
                      : 'text-neutral-300'
                  }`}
                >
                  {log.status === 'saved'
                    ? 'Saved Offline'
                    : log.status === 'error'
                    ? 'Unavailable'
                    : 'Downloading...'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
