import React, { useEffect, useState } from 'react';
import { Download, Laptop, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePlayerStore } from '../store/usePlayerStore';
import { NoirIcon } from './NoirIcon';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function isRunningInNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(win.Capacitor?.isNativePlatform?.());
}

export const PWAInstallButton: React.FC<{ collapsed?: boolean; compact?: boolean }> = ({
  collapsed = false,
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const setActiveView = usePlayerStore((s) => s.setActiveView);
  const [modalOpen, setModalOpen] = useState(false);
  const [apkAvailable, setApkAvailable] = useState(false);
  const [apkSizeBytes, setApkSizeBytes] = useState(0);

  useEffect(() => {
    if (!modalOpen) return;
    let active = true;
    fetch('/api/apk-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { available?: boolean; sizeBytes?: number } | null) => {
        if (!active || !data) return;
        setApkAvailable(Boolean(data.available));
        setApkSizeBytes(Number(data.sizeBytes) || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [modalOpen]);

  if (isInstalled || isRunningInNativeApp()) return null;

  return (
    <>
      {compact ? (
        <button
          onClick={() => setModalOpen(true)}
          title="Get Aurora Vibes App"
          className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-neutral-200 bg-[var(--noir-surface)] hover:bg-[var(--noir-elevated)] border border-white/10 noir-btn transition-colors whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Smartphone} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
          <span className="hidden sm:inline">Get App</span>
        </button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          title="Download Android APK & Desktop Apps"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-100 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn transition-colors whitespace-nowrap shrink-0"
        >
          <NoirIcon icon={Smartphone} className="w-3.5 h-3.5 text-[var(--noir-accent)] shrink-0" />
          {!collapsed && <span>Get Aurora App</span>}
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md noir-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Aurora Vibes"
                  className="w-10 h-10 rounded-xl border border-white/15 shrink-0"
                />
                <div>
                  <h3 className="text-base font-semibold text-white">Get Aurora Vibes App</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Android APK, Linux, macOS, and Windows desktop launchers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-neutral-400 hover:text-white rounded-md"
              >
                <NoirIcon icon={X} className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 space-y-3 text-xs text-neutral-300">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">Android Installer (Aurora-Vibes.apk)</p>
                {apkAvailable && apkSizeBytes > 0 && (
                  <span className="text-[11px] text-neutral-400 tabular-nums">{formatBytes(apkSizeBytes)}</span>
                )}
              </div>

              <p className="text-neutral-400 leading-relaxed">
                Supports Samsung Now Bar lock screen media controls, offline MP3/FLAC/OGG/WAV/M4A playback, CAVA visualizer, EQ, and Calm Study mode.
              </p>

              {apkAvailable ? (
                <a
                  href="/api/download/apk"
                  download="Aurora-Vibes.apk"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity"
                >
                  <NoirIcon icon={Download} className="w-4 h-4" />
                  <span>Download Aurora-Vibes.apk</span>
                </a>
              ) : (
                <p className="text-amber-400 text-[11px]">
                  APK package is currently building — refresh in a moment to download.
                </p>
              )}

              <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside pt-1">
                <li>Tap <strong>Download Aurora-Vibes.apk</strong> on your Android phone.</li>
                <li>Open <code>Aurora-Vibes.apk</code> from notifications or Files.</li>
                <li>Allow <strong>Install unknown apps</strong> for your browser, then tap <strong>Install</strong>.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <NoirIcon icon={Laptop} className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
                  Desktop Apps (Windows · macOS · Linux)
                </p>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setActiveView('settings');
                  }}
                  className="text-[11px] text-[var(--noir-accent)] hover:underline"
                >
                  Open in Settings
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <a
                  href="/api/download/desktop/arch"
                  download="Aurora-Vibes-Arch.sh"
                  className="text-center py-1.5 px-2 text-[11px] font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 rounded-md"
                >
                  Arch Linux
                </a>
                <a
                  href="/api/download/desktop/debian"
                  download="Aurora-Vibes-Debian.sh"
                  className="text-center py-1.5 px-2 text-[11px] font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 rounded-md"
                >
                  Debian
                </a>
                <a
                  href="/api/download/desktop/windows"
                  download="Aurora-Vibes-Windows.bat"
                  className="text-center py-1.5 px-2 text-[11px] font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 rounded-md"
                >
                  Windows
                </a>
                <a
                  href="/api/download/desktop/mac"
                  download="Aurora-Vibes-Mac.command"
                  className="text-center py-1.5 px-2 text-[11px] font-medium text-neutral-200 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 rounded-md"
                >
                  macOS
                </a>
              </div>
            </div>

            {isInstallable && (
              <div className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-white">Instant Web App Install</p>
                  <p className="text-neutral-400 mt-0.5">Install directly as a desktop or mobile app.</p>
                </div>
                <button
                  onClick={() => void install()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 noir-btn shrink-0"
                >
                  Install
                </button>
              </div>
            )}

            {isIOS && (
              <div className="p-3.5 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10 space-y-1.5 text-xs text-neutral-300">
                <p className="font-semibold text-white">iPhone / iPad (Safari)</p>
                <p>1. Tap the <strong>Share</strong> icon in Safari&apos;s bottom bar.</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
              </div>
            )}

            <button
              onClick={() => setModalOpen(false)}
              className="w-full py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/10 noir-btn transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
