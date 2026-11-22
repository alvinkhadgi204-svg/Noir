import React, { useRef, useState } from 'react';
import { FileAudio, FolderOpen, Repeat, Sliders, Upload } from 'lucide-react';
import { EQ_PRESETS, usePlayerStore } from '../store/usePlayerStore';
import { formatBytes, formatTime } from '../utils/localFiles';
import { NoirIcon } from './NoirIcon';
import { TrackRow } from './TrackRow';

const EQ_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

export const LocalStudioView: React.FC = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const lrcRef = useRef<HTMLInputElement | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const crossfadeSeconds = usePlayerStore((s) => s.crossfadeSeconds);
  const abLoop = usePlayerStore((s) => s.abLoop);
  const eq = usePlayerStore((s) => s.eq);
  const uploadProgress = usePlayerStore((s) => s.uploadProgress);

  const importLocalFiles = usePlayerStore((s) => s.importLocalFiles);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const setCrossfadeSeconds = usePlayerStore((s) => s.setCrossfadeSeconds);
  const setAbLoopPoint = usePlayerStore((s) => s.setAbLoopPoint);
  const updateEq = usePlayerStore((s) => s.updateEq);
  const applyEqPreset = usePlayerStore((s) => s.applyEqPreset);
  const attachLyricsToTrack = usePlayerStore((s) => s.attachLyricsToTrack);
  const showToast = usePlayerStore((s) => s.showToast);

  const localTracks = tracks
    .filter((t) => t.source === 'local' || Boolean(t.hasLocalBlob))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void importLocalFiles(e.dataTransfer.files);
    }
  };

  const handleLrcImport = async (file: File) => {
    if (!currentTrack) {
      showToast('Play a track first to attach an LRC file', 'error');
      return;
    }
    const text = await file.text();
    const isSynced = /\[\d{1,2}:\d{2}/.test(text);
    await attachLyricsToTrack(
      currentTrack.id,
      isSynced ? text : currentTrack.syncedLyrics ?? null,
      isSynced ? text : text
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Drag & Drop Local File Import Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDraggingOver(true);
        }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
        className={`noir-card p-6 sm:p-8 border-dashed transition-colors ${
          draggingOver ? 'border-[var(--noir-accent)] bg-white/[0.06]' : 'border-white/15'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <NoirIcon icon={FileAudio} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Offline Local Audio Studio</span>
            </div>
            <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
              Drop MP3, FLAC, OGG, WAV, or M4A files here. Metadata, embedded artwork, and audio files persist locally in IndexedDB for offline playback.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity whitespace-nowrap"
            >
              <NoirIcon icon={Upload} className="w-3.5 h-3.5" />
              <span>Select Audio Files</span>
            </button>

            <button
              onClick={() => folderRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <NoirIcon icon={FolderOpen} className="w-3.5 h-3.5" />
              <span>Import Folder</span>
            </button>

            <button
              onClick={() => lrcRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn transition-colors whitespace-nowrap"
            >
              <span>Attach .LRC Lyrics</span>
            </button>
          </div>
        </div>

        {uploadProgress.active && uploadProgress.total > 0 && (
          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">Fast-importing local tracks...</span>
              <span className="tabular-nums text-[var(--noir-accent)] font-medium">
                {uploadProgress.done} / {uploadProgress.total}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--noir-accent)] transition-[width] duration-200"
                style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".mp3,.flac,.ogg,.wav,.m4a,.aac,.opus,audio/*"
          onChange={(e) => {
            if (e.target.files) void importLocalFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error webkitdirectory is supported in Chromium/Firefox/Safari
          webkitdirectory=""
          multiple
          onChange={(e) => {
            if (e.target.files) void importLocalFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
        <input
          ref={lrcRef}
          type="file"
          accept=".lrc,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleLrcImport(f);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* Precision Local Player Controls: Speed, A-B Loop, Crossfade, File Specs & 5-Band EQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Deck Precision & File Inspector */}
        <div className="noir-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Deck Precision &amp; File Specs</h3>
            {currentTrack && (
              <span className="text-xs text-neutral-400 truncate max-w-[180px]">{currentTrack.title}</span>
            )}
          </div>

          {/* Technical Audio Readout */}
          {currentTrack && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-white/[0.06] text-xs">
              <div>
                <p className="text-neutral-500">Codec</p>
                <p className="text-neutral-100 font-medium mt-0.5 truncate">{currentTrack.format || 'Stream'}</p>
              </div>
              <div>
                <p className="text-neutral-500">Sample Rate</p>
                <p className="text-neutral-100 font-medium tabular-nums mt-0.5">
                  {currentTrack.sampleRate ? `${(currentTrack.sampleRate / 1000).toFixed(1)} kHz` : '—'}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Bitrate</p>
                <p className="text-neutral-100 font-medium tabular-nums mt-0.5">
                  {currentTrack.bitrate ? `${currentTrack.bitrate} kbps` : '—'}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Size</p>
                <p className="text-neutral-100 font-medium tabular-nums mt-0.5">
                  {formatBytes(currentTrack.fileSize)}
                </p>
              </div>
            </div>
          )}

          {/* Playback Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium">Playback Speed</span>
              <span className="tabular-nums text-[var(--noir-accent)] font-semibold">
                {playbackRate.toFixed(2)}×
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2.5 py-1 text-xs tabular-nums rounded-md border transition-colors ${
                    Math.abs(playbackRate - rate) < 0.01
                      ? 'bg-[var(--noir-accent)] text-black border-transparent font-semibold'
                      : 'bg-[var(--noir-base)] border-white/10 text-neutral-300 hover:text-white'
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>

          {/* Crossfade / Gapless */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium">Transition Mode</span>
              <span className="tabular-nums text-neutral-200">
                {crossfadeSeconds === 0 ? 'Gapless (0s)' : `Crossfade ${crossfadeSeconds.toFixed(1)}s`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={crossfadeSeconds}
              onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
              className="w-full accent-[var(--noir-accent)]"
            />
          </div>

          {/* A-B Segment Loop */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                <NoirIcon icon={Repeat} className="w-3.5 h-3.5" />
                <span>A–B Loop</span>
              </span>
              <span className="tabular-nums text-neutral-400">
                {abLoop.a !== null ? formatTime(abLoop.a) : '—'} → {abLoop.b !== null ? formatTime(abLoop.b) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAbLoopPoint('a')}
                className="px-3 py-1.5 text-xs font-medium bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 text-white noir-btn"
              >
                Set A
              </button>
              <button
                onClick={() => setAbLoopPoint('b')}
                className="px-3 py-1.5 text-xs font-medium bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 text-white noir-btn"
              >
                Set B
              </button>
              <button
                onClick={() => setAbLoopPoint('clear')}
                className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white border border-white/10 noir-btn"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: 5-Band Parametric EQ */}
        <div className="noir-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NoirIcon icon={Sliders} className="w-4 h-4 text-[var(--noir-accent)]" />
              <h3 className="text-sm font-semibold text-white">5-Band Equalizer</h3>
            </div>

            <button
              onClick={() => updateEq({ enabled: !eq.enabled })}
              className={`px-3 py-1 text-xs font-medium noir-btn border transition-colors ${
                eq.enabled
                  ? 'bg-[var(--noir-accent)] text-black border-transparent font-semibold'
                  : 'bg-[var(--noir-base)] text-neutral-400 border-white/10'
              }`}
            >
              {eq.enabled ? 'Active' : 'Bypassed'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {Object.keys(EQ_PRESETS).map((preset) => (
              <button
                key={preset}
                onClick={() => applyEqPreset(preset)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  eq.preset === preset
                    ? 'bg-white/15 text-white border-white/25'
                    : 'bg-[var(--noir-base)] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-3 pt-2">
            {eq.bands.map((gainDb, idx) => (
              <div key={EQ_LABELS[idx]} className="flex flex-col items-center gap-2">
                <span className="text-[11px] tabular-nums text-[var(--noir-accent)]">
                  {gainDb > 0 ? `+${gainDb}` : gainDb} dB
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={gainDb}
                  onChange={(e) => {
                    const next = [...eq.bands] as [number, number, number, number, number];
                    next[idx] = Number(e.target.value);
                    updateEq({ enabled: true, preset: 'Custom', bands: next });
                  }}
                  aria-label={`${EQ_LABELS[idx]} gain`}
                  className="h-28 accent-[var(--noir-accent)] [writing-mode:vertical-lr] [direction:rtl] cursor-pointer"
                />
                <span className="text-[11px] text-neutral-400 tabular-nums">{EQ_LABELS[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offline & Local Tracks List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Local &amp; Offline Tracks (A–Z)</h3>
          <span className="text-xs text-neutral-500 tabular-nums">{localTracks.length} files</span>
        </div>
        {localTracks.length === 0 ? (
          <div className="noir-card p-8 text-center space-y-2">
            <p className="text-sm text-neutral-300">No local or offline audio files imported yet.</p>
            <p className="text-xs text-neutral-500">
              Select MP3, FLAC, OGG, WAV, or M4A files above, or sync a Spotify playlist to store songs offline.
            </p>
          </div>
        ) : (
          <div className="noir-card p-2">
            {localTracks.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} queueContext={localTracks} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
