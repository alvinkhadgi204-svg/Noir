import type { EqSettings, Track } from '../types/music';

interface Deck {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
  track: Track | null;
  corsRetried: boolean;
}

const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000];

export interface EngineCallbacks {
  onTimeUpdate: (time: number, duration: number) => void;
  onTrackEnded: () => void;
  onCrossfadeTriggered: (nextTrack: Track) => void;
  onPlaybackError: (message: string) => void;
  onNextAction: () => void;
  onPrevAction: () => void;
  onPlayStateChange: (playing: boolean) => void;
}

class NoirAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];

  private decks: [Deck, Deck];
  private activeIdx: 0 | 1 = 0;

  private volume = 0.85;
  private isMuted = false;
  private playbackRate = 1;
  private crossfadeSeconds = 2.5;
  private eqSettings: EqSettings = { enabled: false, preset: 'Flat', bands: [0, 0, 0, 0, 0] };

  private abLoop: { a: number | null; b: number | null } = { a: null, b: null };
  private preloadedNextTrack: Track | null = null;
  private isCrossfading = false;

  private ambienceNode: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;

  private callbacks: EngineCallbacks | null = null;
  private lastPositionSyncAt = 0;

  constructor() {
    const makeAudio = () => {
      const a = new Audio();
      a.crossOrigin = 'anonymous';
      a.preload = 'auto';
      a.setAttribute('playsinline', 'true');
      return a;
    };

    this.decks = [
      { audio: makeAudio(), source: null, gain: null, track: null, corsRetried: false },
      { audio: makeAudio(), source: null, gain: null, track: null, corsRetried: false },
    ];

    this.bindDeckEvents(0);
    this.bindDeckEvents(1);
    this.setupMediaSession();
  }

  public setCallbacks(cb: EngineCallbacks) {
    this.callbacks = cb;
  }

  private ensureAudioContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;

        // Build 5-band parametric EQ chain
        this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
          const filter = this.ctx!.createBiquadFilter();
          filter.type = idx === 0 ? 'lowshelf' : idx === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1.1;
          filter.gain.value = this.eqSettings.enabled ? this.eqSettings.bands[idx] : 0;
          return filter;
        });

        // Chain: eq[0] -> ... -> eq[4] -> masterGain -> analyser -> destination
        for (let i = 0; i < this.eqFilters.length - 1; i += 1) {
          this.eqFilters[i].connect(this.eqFilters[i + 1]);
        }
        this.eqFilters[this.eqFilters.length - 1].connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      // Connect both decks if not yet wired
      for (let i = 0; i < 2; i += 1) {
        const deck = this.decks[i];
        if (!deck.source && this.ctx && this.eqFilters.length > 0) {
          deck.source = this.ctx.createMediaElementSource(deck.audio);
          deck.gain = this.ctx.createGain();
          deck.gain.gain.value = i === this.activeIdx ? 1 : 0;
          deck.source.connect(deck.gain);
          deck.gain.connect(this.eqFilters[0]);
        }
      }
    } catch {
      // Fallback cleanly to native HTMLAudioElement playback on older mobile browsers
      const targetVol = this.isMuted ? 0 : this.volume;
      this.decks[0].audio.volume = targetVol;
      this.decks[1].audio.volume = targetVol;
    }
  }

  private bindDeckEvents(idx: 0 | 1) {
    const deck = this.decks[idx];
    const audio = deck.audio;

    audio.addEventListener('timeupdate', () => {
      if (this.activeIdx !== idx) return;

      const cur = audio.currentTime || 0;
      const dur = Number.isFinite(audio.duration) ? audio.duration : deck.track?.duration || 0;

      // A-B Loop enforcement
      if (this.abLoop.a !== null && this.abLoop.b !== null && this.abLoop.b > this.abLoop.a) {
        if (cur >= this.abLoop.b) {
          audio.currentTime = this.abLoop.a;
        }
      }

      this.callbacks?.onTimeUpdate(cur, dur);
      this.updateMediaSessionPosition(cur, dur);

      // Trigger crossfade if enabled and preloaded track is ready
      if (
        !this.isCrossfading &&
        this.crossfadeSeconds > 0 &&
        this.preloadedNextTrack &&
        dur > this.crossfadeSeconds + 1 &&
        dur - cur <= this.crossfadeSeconds &&
        this.abLoop.b === null
      ) {
        void this.performCrossfadeToPreloaded();
      }
    });

    audio.addEventListener('ended', () => {
      if (this.activeIdx !== idx) return;
      if (this.isCrossfading) return;

      // Gapless handover if preloaded deck is ready and crossfade === 0
      const standbyIdx: 0 | 1 = idx === 0 ? 1 : 0;
      const standby = this.decks[standbyIdx];
      if (this.crossfadeSeconds === 0 && this.preloadedNextTrack && standby.track?.id === this.preloadedNextTrack.id) {
        const nextTrack = this.preloadedNextTrack;
        this.preloadedNextTrack = null;
        this.activeIdx = standbyIdx;
        if (standby.gain && this.ctx) {
          standby.gain.gain.setValueAtTime(1, this.ctx.currentTime);
        }
        standby.audio.playbackRate = this.playbackRate;
        void standby.audio.play();
        this.callbacks?.onCrossfadeTriggered(nextTrack);
        this.updateMediaSessionMetadata(nextTrack);
        return;
      }

      this.callbacks?.onTrackEnded();
    });

    audio.addEventListener('loadedmetadata', () => {
      if (this.activeIdx !== idx) return;
      const dur = Number.isFinite(audio.duration) ? audio.duration : deck.track?.duration || 0;
      this.callbacks?.onTimeUpdate(audio.currentTime || 0, dur);
      this.updateMediaSessionPosition(audio.currentTime || 0, dur);
    });

    audio.addEventListener('play', () => {
      if (this.activeIdx !== idx) return;
      this.syncMediaSessionPlaybackState(true);
    });

    audio.addEventListener('playing', () => {
      if (this.activeIdx !== idx) return;
      this.syncMediaSessionPlaybackState(true);
      if (deck.track) {
        this.updateMediaSessionMetadata(deck.track);
      }
      const dur = Number.isFinite(audio.duration) ? audio.duration : deck.track?.duration || 0;
      this.updateMediaSessionPosition(audio.currentTime || 0, dur, true);
    });

    audio.addEventListener('pause', () => {
      if (this.activeIdx !== idx) return;
      this.syncMediaSessionPlaybackState(false);
    });

    audio.addEventListener('error', () => {
      if (this.activeIdx !== idx) return;
      if (!deck.corsRetried && audio.hasAttribute('crossOrigin') && /^https?:\/\//i.test(audio.src)) {
        deck.corsRetried = true;
        audio.removeAttribute('crossOrigin');
        audio.load();
        void audio.play().catch(() => {});
        return;
      }
      const trackTitle = deck.track?.title || 'this track';
      this.syncMediaSessionPlaybackState(false);
      this.callbacks?.onPlaybackError(`Unable to play "${trackTitle}". Check your connection or try another source.`);
    });
  }

  private async performCrossfadeToPreloaded() {
    const nextTrack = this.preloadedNextTrack;
    if (!nextTrack) return;

    const outgoingIdx = this.activeIdx;
    const incomingIdx: 0 | 1 = outgoingIdx === 0 ? 1 : 0;
    const outgoing = this.decks[outgoingIdx];
    const incoming = this.decks[incomingIdx];

    if (incoming.track?.id !== nextTrack.id) return;

    this.isCrossfading = true;
    this.preloadedNextTrack = null;
    this.ensureAudioContext();

    const fadeDur = Math.max(0.4, this.crossfadeSeconds);

    if (this.ctx && outgoing.gain && incoming.gain) {
      const now = this.ctx.currentTime;
      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
      outgoing.gain.gain.linearRampToValueAtTime(0, now + fadeDur);

      incoming.gain.gain.cancelScheduledValues(now);
      incoming.gain.gain.setValueAtTime(0, now);
      incoming.gain.gain.linearRampToValueAtTime(1, now + fadeDur);
    } else {
      incoming.audio.volume = this.isMuted ? 0 : this.volume;
    }

    incoming.audio.currentTime = 0;
    incoming.audio.playbackRate = this.playbackRate;
    try {
      await incoming.audio.play();
    } catch {
      this.isCrossfading = false;
      return;
    }

    this.activeIdx = incomingIdx;
    this.callbacks?.onCrossfadeTriggered(nextTrack);
    this.updateMediaSessionMetadata(nextTrack);

    window.setTimeout(() => {
      if (this.activeIdx !== outgoingIdx) {
        outgoing.audio.pause();
        outgoing.audio.currentTime = 0;
      }
      this.isCrossfading = false;
    }, fadeDur * 1000 + 80);
  }

  public async playTrack(track: Track, autoPlay = true) {
    this.ensureAudioContext();
    this.isCrossfading = false;
    this.preloadedNextTrack = null;

    const outgoingIdx = this.activeIdx;
    const incomingIdx: 0 | 1 = outgoingIdx === 0 ? 1 : 0;
    const outgoing = this.decks[outgoingIdx];
    const incoming = this.decks[incomingIdx];

    // Stop standby and reuse cleanly
    outgoing.audio.pause();
    if (outgoing.gain && this.ctx) {
      outgoing.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      outgoing.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    incoming.track = track;
    incoming.corsRetried = false;
    incoming.audio.crossOrigin = 'anonymous';
    incoming.audio.src = track.streamUrl;
    incoming.audio.playbackRate = this.playbackRate;
    incoming.audio.load();

    if (incoming.gain && this.ctx) {
      incoming.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      incoming.gain.gain.setValueAtTime(1, this.ctx.currentTime);
    }

    this.activeIdx = incomingIdx;
    this.updateMediaSessionMetadata(track);

    if (autoPlay) {
      try {
        await incoming.audio.play();
        this.callbacks?.onPlayStateChange(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          this.callbacks?.onPlayStateChange(false);
        }
      }
    }
  }

  public preloadNext(track: Track | null) {
    if (!track) {
      this.preloadedNextTrack = null;
      return;
    }
    const standbyIdx: 0 | 1 = this.activeIdx === 0 ? 1 : 0;
    const standby = this.decks[standbyIdx];
    if (standby.track?.id === track.id && this.preloadedNextTrack?.id === track.id) {
      return;
    }
    this.preloadedNextTrack = track;
    standby.track = track;
    standby.corsRetried = false;
    standby.audio.crossOrigin = 'anonymous';
    standby.audio.src = track.streamUrl;
    standby.audio.preload = 'auto';
    standby.audio.load();
  }

  public async togglePlay(shouldPlay?: boolean): Promise<boolean> {
    this.ensureAudioContext();
    const active = this.decks[this.activeIdx];
    if (!active.track) return false;

    const targetPlay = shouldPlay !== undefined ? shouldPlay : active.audio.paused;
    if (targetPlay) {
      try {
        await active.audio.play();
        this.callbacks?.onPlayStateChange(true);
        return true;
      } catch {
        this.callbacks?.onPlayStateChange(false);
        return false;
      }
    } else {
      active.audio.pause();
      this.callbacks?.onPlayStateChange(false);
      return false;
    }
  }

  public seek(seconds: number) {
    const active = this.decks[this.activeIdx];
    if (!active.audio.src) return;
    const dur = Number.isFinite(active.audio.duration) ? active.audio.duration : active.track?.duration || 0;
    const clamped = Math.max(0, Math.min(seconds, dur || seconds));
    active.audio.currentTime = clamped;
    this.callbacks?.onTimeUpdate(clamped, dur);
    this.updateMediaSessionPosition(clamped, dur, true);
  }

  public setVolume(vol: number, muted = this.isMuted) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.isMuted = muted;
    const targetVol = this.isMuted ? 0 : this.volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.03);
    } else {
      this.decks[0].audio.volume = targetVol;
      this.decks[1].audio.volume = targetVol;
    }
  }

  public fadeOutAndPause(fadeSeconds = 3) {
    if (!this.masterGain || !this.ctx) {
      void this.togglePlay(false);
      return;
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    window.setTimeout(() => {
      void this.togglePlay(false);
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      }
    }, fadeSeconds * 1000);
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    this.decks[this.activeIdx].audio.playbackRate = this.playbackRate;
  }

  public setCrossfadeSeconds(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(12, seconds));
  }

  public setAbLoop(a: number | null, b: number | null) {
    this.abLoop = { a, b };
  }

  public setEq(eq: EqSettings) {
    this.eqSettings = eq;
    if (this.eqFilters.length === 5 && this.ctx) {
      const now = this.ctx.currentTime;
      eq.bands.forEach((gainDb, idx) => {
        this.eqFilters[idx].gain.setTargetAtTime(eq.enabled ? gainDb : 0, now, 0.04);
      });
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setStudyAmbience(mode: 'off' | 'rain' | 'brown' | 'lounge', volume = 0.22) {
    try {
      if (this.ambienceNode) {
        try {
          this.ambienceNode.stop();
          this.ambienceNode.disconnect();
        } catch {
          // Ignore already stopped
        }
        this.ambienceNode = null;
      }
      if (mode === 'off') return;

      this.ensureAudioContext();
      if (!this.ctx) return;

      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 4;
      const buffer = this.ctx.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch += 1) {
        const data = buffer.getChannelData(ch);
        let lastOut = 0;
        for (let i = 0; i < length; i += 1) {
          const white = Math.random() * 2 - 1;
          if (mode === 'brown') {
            lastOut = (lastOut + 0.02 * white) / 1.02;
            data[i] = lastOut * 2.8;
          } else if (mode === 'rain') {
            lastOut = (lastOut + 0.06 * white) / 1.06;
            const droplet = Math.random() > 0.996 ? (Math.random() - 0.5) * 0.25 : 0;
            data[i] = lastOut * 1.6 + droplet;
          } else {
            lastOut = (lastOut + 0.015 * white) / 1.015;
            data[i] = lastOut * 3.2;
          }
        }
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = mode === 'rain' ? 2400 : mode === 'brown' ? 520 : 320;

      const gain = this.ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(0.6, volume));

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();

      this.ambienceNode = src;
      this.ambienceFilter = filter;
      this.ambienceGain = gain;
    } catch {
      // Ignore if AudioContext cannot start before gesture
    }
  }

  public setStudyAmbienceVolume(volume: number) {
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setTargetAtTime(Math.max(0, Math.min(0.6, volume)), this.ctx.currentTime, 0.05);
    }
  }

  public refreshMediaSession() {
    const active = this.decks[this.activeIdx];
    if (active.track) {
      this.updateMediaSessionMetadata(active.track);
      this.syncMediaSessionPlaybackState(!active.audio.paused);
    }
  }

  // ---------- Media Session API Integration (Samsung Now Bar & Lock Screen) ----------

  private setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => void this.togglePlay(true));
      ms.setActionHandler('pause', () => void this.togglePlay(false));
      ms.setActionHandler('stop', () => void this.togglePlay(false));
      ms.setActionHandler('previoustrack', () => this.callbacks?.onPrevAction());
      ms.setActionHandler('nexttrack', () => this.callbacks?.onNextAction());
      ms.setActionHandler('seekbackward', (details) => {
        const cur = this.decks[this.activeIdx].audio.currentTime || 0;
        this.seek(cur - (details.seekOffset || 10));
      });
      ms.setActionHandler('seekforward', (details) => {
        const cur = this.decks[this.activeIdx].audio.currentTime || 0;
        this.seek(cur + (details.seekOffset || 10));
      });
      ms.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seek(details.seekTime);
        }
      });
    } catch {
      // Ignore unsupported handlers on older browsers
    }
  }

  private syncMediaSessionPlaybackState(playing: boolean) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch {
      // Ignore
    }
  }

  private resolveAbsoluteUrl(url: string): string {
    try {
      if (!url || url.startsWith('blob:')) {
        return new URL('/pwa-512x512.png', window.location.origin).href;
      }
      if (url.startsWith('data:')) return url;
      return new URL(url, window.location.origin).href;
    } catch {
      return url;
    }
  }

  private updateMediaSessionMetadata(track: Track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const hasUsableArt = Boolean(track.artworkUrl && !track.artworkUrl.startsWith('blob:'));
      const artwork = hasUsableArt
        ? [
            { src: this.resolveAbsoluteUrl(track.artworkUrl), sizes: '512x512', type: 'image/jpeg' },
            { src: this.resolveAbsoluteUrl('/pwa-192x192.png'), sizes: '192x192', type: 'image/png' },
            { src: this.resolveAbsoluteUrl('/pwa-512x512.png'), sizes: '512x512', type: 'image/png' },
          ]
        : [
            { src: this.resolveAbsoluteUrl('/pwa-192x192.png'), sizes: '192x192', type: 'image/png' },
            { src: this.resolveAbsoluteUrl('/pwa-512x512.png'), sizes: '512x512', type: 'image/png' },
          ];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Aurora Vibes',
        album: track.album || 'Aurora Vibes',
        artwork,
      });
    } catch {
      // Ignore
    }
  }

  private updateMediaSessionPosition(position: number, duration: number, force = false) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const now = Date.now();
    if (!force && now - this.lastPositionSyncAt < 900) return;
    this.lastPositionSyncAt = now;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.playbackRate,
        position: Math.max(0, Math.min(position, duration)),
      });
    } catch {
      // Ignore
    }
  }
}

export const audioEngine = new NoirAudioEngine();
