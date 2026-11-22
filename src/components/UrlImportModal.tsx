import React, { useState } from 'react';
import { Link2, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/music';
import { NoirIcon } from './NoirIcon';

export const UrlImportModal: React.FC = () => {
  const open = usePlayerStore((s) => s.urlImportOpen);
  const setOpen = usePlayerStore((s) => s.setUrlImportOpen);
  const addExternalTrack = usePlayerStore((s) => s.addExternalTrack);
  const showToast = usePlayerStore((s) => s.showToast);

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as { track?: Omit<Track, 'addedAt'>; error?: string };
      if (!res.ok || !data.track) {
        throw new Error(data.error || 'Could not extract audio from this URL');
      }

      const newTrack: Track = {
        ...data.track,
        addedAt: Date.now(),
      };
      await addExternalTrack(newTrack, true);
      showToast(
        newTrack.notice ? `${newTrack.title} (${newTrack.notice})` : `Streaming "${newTrack.title}"`,
        'success'
      );
      setUrl('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract audio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !loading && setOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative z-10 w-full max-w-lg noir-glass border border-white/15 rounded-[var(--noir-radius)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <NoirIcon icon={Link2} className="w-4 h-4 text-[var(--noir-accent)]" />
                <h2 className="text-base font-semibold text-white">Universal Audio URL Fetch</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-neutral-400 hover:text-white rounded-md"
              >
                <NoirIcon icon={X} className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Paste a direct MP3, FLAC, OGG, or WAV link, or a Bandcamp, YouTube, SoundCloud, or Spotify share URL to extract metadata and stream audio.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm bg-[var(--noir-base)] border border-white/15 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)]"
              />

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 disabled:opacity-60 noir-btn"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Extracting...' : 'Extract & Play'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
