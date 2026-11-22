import React, { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { NoirIcon } from './NoirIcon';
import { TrackRow } from './TrackRow';

type LibraryFilter = 'all' | 'favorites' | 'local' | 'remote';
type SortBy = 'added' | 'title' | 'artist';

export const LibraryView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('title');

  const tracks = usePlayerStore((s) => s.tracks);
  const importLocalFiles = usePlayerStore((s) => s.importLocalFiles);

  const filtered = useMemo(() => {
    const base = tracks.filter((t) => {
      if (filter === 'favorites') return Boolean(t.isFavorite);
      if (filter === 'local') return t.source === 'local' || Boolean(t.hasLocalBlob);
      if (filter === 'remote') return t.source !== 'local' && !t.hasLocalBlob;
      return true;
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
      return b.addedAt - a.addedAt;
    });
  }, [tracks, filter, sortBy]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--noir-surface)] border border-white/[0.06] rounded-[var(--noir-btn-radius)] max-w-full">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'favorites' as const, label: 'Favorites' },
            { id: 'local' as const, label: 'Offline & Local' },
            { id: 'remote' as const, label: 'Remote Streams' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === item.id
                  ? 'bg-[var(--noir-elevated)] text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-neutral-400 flex items-center gap-2">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="min-h-[36px] px-2.5 py-1.5 text-xs bg-[var(--noir-surface)] border border-white/10 rounded-[var(--noir-btn-radius)] text-neutral-200 focus:outline-none focus:border-[var(--noir-accent)]"
            >
              <option value="title">Title (A–Z)</option>
              <option value="artist">Artist (A–Z)</option>
              <option value="added">Recently Added</option>
            </select>
          </label>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[36px] flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 text-neutral-100 noir-btn transition-colors whitespace-nowrap shrink-0"
          >
            <NoirIcon icon={Upload} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
            <span>Add Files</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp3,.flac,.ogg,.wav,.m4a,.aac,.opus,audio/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void importLocalFiles(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="noir-card p-10 text-center space-y-3">
          <p className="text-sm text-neutral-300">No tracks match this filter yet.</p>
          <p className="text-xs text-neutral-500">
            Drop MP3, FLAC, OGG, WAV, or M4A files anywhere on the window to build your offline library.
          </p>
        </div>
      ) : (
        <div className="noir-card p-2">
          {filtered.map((track, idx) => (
            <TrackRow key={track.id} track={track} index={idx} queueContext={filtered} />
          ))}
        </div>
      )}
    </div>
  );
};
