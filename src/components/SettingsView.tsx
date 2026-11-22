import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Laptop,
  Monitor,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  Terminal,
  User,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePlayerStore } from '../store/usePlayerStore';
import type { UselessFeaturesConfig } from '../types/music';
import { NoirIcon } from './NoirIcon';

const USELESS_FEATURE_ITEMS: Array<{
  key: keyof UselessFeaturesConfig;
  title: string;
  description: string;
}> = [
  {
    key: 'discoLasers',
    title: 'Disco Laser Horizon',
    description: 'Sweeping multi-color laser beams behind the player synced to playback.',
  },
  {
    key: 'floatingParticles',
    title: 'Floating Stardust Particles',
    description: 'Drifting accent-colored embers rising gently across the screen.',
  },
  {
    key: 'vinylWobble',
    title: 'Vinyl Turntable Wobble',
    description: 'Adds analog pitch-like visual sway to spinning album artwork.',
  },
  {
    key: 'crtScanlines',
    title: 'Retro CRT Scanlines',
    description: 'Classic 1980s monitor phosphor scanline overlay across the UI.',
  },
  {
    key: 'matrixRain',
    title: 'Matrix Character Rain',
    description: 'Subtle falling digital Aurora characters behind cards.',
  },
  {
    key: 'fakeEngineerTelemetry',
    title: 'Fake Audio Engineer Telemetry',
    description: 'Displays imaginary ultra-audiophile metrics like Quantum Jitter & 6N Copper Gain.',
  },
  {
    key: 'zeroGravityArt',
    title: 'Zero-Gravity Fullscreen Art',
    description: 'Makes fullscreen album art gently float in zero gravity.',
  },
  {
    key: 'clickSparks',
    title: 'Click Sparks Burst',
    description: 'Pops tiny accent sparks whenever you tap or click anywhere.',
  },
];

export const SettingsView: React.FC = () => {
  const username = usePlayerStore((s) => s.username);
  const setUsername = usePlayerStore((s) => s.setUsername);
  const showToast = usePlayerStore((s) => s.showToast);

  const appVersion = usePlayerStore((s) => s.appVersion);
  const autoUpdateEnabled = usePlayerStore((s) => s.autoUpdateEnabled);
  const setAutoUpdateEnabled = usePlayerStore((s) => s.setAutoUpdateEnabled);
  const updateAvailable = usePlayerStore((s) => s.updateAvailable);
  const checkingUpdate = usePlayerStore((s) => s.checkingUpdate);
  const lastCheckedAt = usePlayerStore((s) => s.lastCheckedAt);
  const latestReleaseNotes = usePlayerStore((s) => s.latestReleaseNotes);
  const checkForAppUpdate = usePlayerStore((s) => s.checkForAppUpdate);
  const applySelfUpdate = usePlayerStore((s) => s.applySelfUpdate);

  const uselessFeatures = usePlayerStore((s) => s.uselessFeatures);
  const toggleUselessFeature = usePlayerStore((s) => s.toggleUselessFeature);
  const resetUselessFeatures = usePlayerStore((s) => s.resetUselessFeatures);

  const { isInstallable, install } = usePWAInstall();

  const [nameDraft, setNameDraft] = useState(username);
  const [apkInfo, setApkInfo] = useState<{ available: boolean; sizeBytes: number }>({
    available: false,
    sizeBytes: 0,
  });

  useEffect(() => {
    setNameDraft(username);
  }, [username]);

  useEffect(() => {
    fetch('/api/apk-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { available?: boolean; sizeBytes?: number } | null) => {
        if (d) setApkInfo({ available: Boolean(d.available), sizeBytes: Number(d.sizeBytes) || 0 });
      })
      .catch(() => {});
  }, []);

  const enabledCount = Object.values(uselessFeatures).filter(Boolean).length;
  const mediaSessionSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    setUsername(nameDraft);
    showToast(`Username updated to "${nameDraft.trim() || 'Listener'}"`, 'success');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="Aurora Vibes"
            className="w-10 h-10 rounded-[var(--noir-btn-radius)] border border-white/10 object-cover"
          />
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <NoirIcon icon={SettingsIcon} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Aurora Vibes Settings</span>
            </h2>
            <p className="text-xs text-neutral-400">
              Profile, self-updates, Samsung Now Bar, cross-platform apps &amp; hidden studio toys
            </p>
          </div>
        </div>
        <span className="text-xs text-neutral-400 tabular-nums">v{appVersion}</span>
      </div>

      {/* 1. User Profile */}
      <section className="noir-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <NoirIcon icon={User} className="w-4 h-4 text-[var(--noir-accent)]" />
          <span>Profile &amp; Greeting</span>
        </div>
        <form onSubmit={handleSaveUsername} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            maxLength={32}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your display username..."
            className="flex-1 px-3.5 py-2 text-sm bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-white focus:outline-none focus:border-[var(--noir-accent)]"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn shrink-0"
          >
            Save Username
          </button>
        </form>
      </section>

      {/* 2. Self-Updating System */}
      <section className="noir-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <NoirIcon icon={RefreshCw} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Self-Updating Engine</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Installed: <span className="text-neutral-200 tabular-nums">v{appVersion}</span>
              {lastCheckedAt && (
                <span> · Last checked {new Date(lastCheckedAt).toLocaleTimeString()}</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
              className={`px-3 py-1.5 text-xs font-medium noir-btn border transition-colors ${
                autoUpdateEnabled
                  ? 'bg-[var(--noir-accent)] text-black border-transparent font-semibold'
                  : 'bg-[var(--noir-base)] text-neutral-400 border-white/10'
              }`}
            >
              Auto-Update: {autoUpdateEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => void checkForAppUpdate(false)}
              disabled={checkingUpdate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? 'Checking...' : 'Check Updates'}</span>
            </button>

            {updateAvailable && (
              <button
                onClick={() => void applySelfUpdate()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Update &amp; Reload</span>
              </button>
            )}
          </div>
        </div>

        <ul className="space-y-1.5 text-xs text-neutral-400 border-t border-white/[0.06] pt-3">
          {latestReleaseNotes.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--noir-accent)] shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Samsung Now Bar & Lock Screen Controls */}
      <section className="noir-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Samsung Now Bar &amp; Lock Screen</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Media Session API:{' '}
              <span className={mediaSessionSupported ? 'text-[var(--noir-accent)]' : 'text-neutral-500'}>
                {mediaSessionSupported ? 'Active & Synced' : 'Not Supported on This Browser'}
              </span>
            </p>
          </div>
          <button
            onClick={() => {
              audioEngine.refreshMediaSession();
              showToast('Synced track metadata & artwork to Samsung Now Bar / Lock Screen', 'success');
            }}
            className="px-3.5 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn"
          >
            Sync Now Bar Control
          </button>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          When playing audio in Samsung Internet, Chrome, or the installed Android app, Aurora Vibes broadcasts live artwork, track title, playback state, and seek progress directly to Samsung One UI&apos;s Now Bar and lock screen media pill.
        </p>
      </section>

      {/* 4. Desktop & Mobile Apps (Arch Linux, Debian/Ubuntu, macOS, Windows, Android) */}
      <section className="noir-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Apps for Arch Linux, Debian, macOS, Windows &amp; Phone</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Native launchers with desktop menu icons or signed Android APK (v{appVersion}).
            </p>
          </div>
          {isInstallable && (
            <button
              onClick={() => void install()}
              className="px-4 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn"
            >
              1-Click Install App
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <a
            href="/api/download/desktop/arch"
            download="Aurora-Vibes-Arch.sh"
            className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 hover:border-[var(--noir-accent)] transition-colors space-y-1.5 block"
          >
            <div className="flex items-center justify-between">
              <NoirIcon icon={Terminal} className="w-4 h-4 text-[var(--noir-accent)]" />
              <Download className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <p className="font-semibold text-white">Arch Linux</p>
            <p className="text-[11px] text-neutral-400">Launcher + .desktop / PKGBUILD</p>
          </a>

          <a
            href="/api/download/desktop/debian"
            download="Aurora-Vibes-Debian.sh"
            className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 hover:border-[var(--noir-accent)] transition-colors space-y-1.5 block"
          >
            <div className="flex items-center justify-between">
              <NoirIcon icon={Terminal} className="w-4 h-4 text-[var(--noir-accent)]" />
              <Download className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <p className="font-semibold text-white">Debian / Ubuntu</p>
            <p className="text-[11px] text-neutral-400">Launcher + .deb / App Menu</p>
          </a>

          <a
            href="/api/download/desktop/windows"
            download="Aurora-Vibes-Windows.bat"
            className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 hover:border-[var(--noir-accent)] transition-colors space-y-1.5 block"
          >
            <div className="flex items-center justify-between">
              <NoirIcon icon={Monitor} className="w-4 h-4 text-[var(--noir-accent)]" />
              <Download className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <p className="font-semibold text-white">Windows</p>
            <p className="text-[11px] text-neutral-400">Standalone App (.bat / .exe)</p>
          </a>

          <a
            href="/api/download/desktop/mac"
            download="Aurora-Vibes-Mac.command"
            className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 hover:border-[var(--noir-accent)] transition-colors space-y-1.5 block"
          >
            <div className="flex items-center justify-between">
              <NoirIcon icon={Laptop} className="w-4 h-4 text-[var(--noir-accent)]" />
              <Download className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <p className="font-semibold text-white">macOS</p>
            <p className="text-[11px] text-neutral-400">Launcher + Electron (.dmg)</p>
          </a>

          <a
            href={apkInfo.available ? '/api/download/apk' : undefined}
            download="Aurora-Vibes.apk"
            className={`p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 transition-colors space-y-1.5 block ${
              apkInfo.available ? 'hover:border-[var(--noir-accent)]' : 'opacity-60 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between">
              <NoirIcon icon={Smartphone} className="w-4 h-4 text-[var(--noir-accent)]" />
              <Download className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <p className="font-semibold text-white">Android APK</p>
            <p className="text-[11px] text-neutral-400 tabular-nums">
              {apkInfo.available
                ? `${(apkInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB · Samsung Now Bar`
                : 'Building APK...'}
            </p>
          </a>
        </div>
      </section>

      {/* 5. Cool & Useless Features (Only Turned On Here in Settings!) */}
      <section className="noir-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <NoirIcon icon={Sparkles} className="w-4 h-4 text-[var(--noir-accent)]" />
              <span>Cool &amp; Useless Studio Features</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              All disabled by default — can only be turned on from Settings ({enabledCount} active).
            </p>
          </div>
          {enabledCount > 0 && (
            <button
              onClick={resetUselessFeatures}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 noir-btn"
            >
              <NoirIcon icon={RotateCcw} className="w-3.5 h-3.5" />
              <span>Turn Off All</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {USELESS_FEATURE_ITEMS.map((item) => {
            const active = uselessFeatures[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleUselessFeature(item.key)}
                className={`p-3.5 rounded-[var(--noir-btn-radius)] border text-left transition-colors flex items-start justify-between gap-3 ${
                  active
                    ? 'border-[var(--noir-accent)] bg-white/[0.06]'
                    : 'border-white/10 bg-[var(--noir-base)] hover:border-white/25'
                }`}
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">{item.description}</p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded shrink-0 ${
                    active
                      ? 'bg-[var(--noir-accent)] text-black'
                      : 'bg-white/[0.06] text-neutral-400'
                  }`}
                >
                  {active ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
