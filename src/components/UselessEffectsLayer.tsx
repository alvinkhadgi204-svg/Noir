import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

interface Spark {
  id: number;
  x: number;
  y: number;
}

export const UselessEffectsLayer: React.FC = () => {
  const features = usePlayerStore((s) => s.uselessFeatures);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const accentColor = usePlayerStore((s) => s.theme.accentColor);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);

  const needsCanvas = features.floatingParticles || features.matrixRain || features.discoLasers;

  // Click Sparks effect (Settings-only)
  useEffect(() => {
    if (!features.clickSparks) {
      setSparks([]);
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const id = Date.now() + Math.random();
      setSparks((prev) => [...prev.slice(-10), { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(() => {
        setSparks((prev) => prev.filter((s) => s.id !== id));
      }, 650);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [features.clickSparks]);

  // Animated background canvas for Particles / Matrix Rain / Disco Lasers (Settings-only)
  useEffect(() => {
    if (!needsCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 42 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 2.2,
      vy: 0.25 + Math.random() * 0.75,
      vx: (Math.random() - 0.5) * 0.4,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    const cols = Math.max(12, Math.floor(window.innerWidth / 22));
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    const glyphs = 'AURORAVIBES♪♫♬01✦◈';

    let tick = 0;
    const draw = () => {
      tick += isPlaying ? 0.032 : 0.014;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (features.discoLasers) {
        const beamCount = 4;
        for (let i = 0; i < beamCount; i += 1) {
          const originX = (w / (beamCount + 1)) * (i + 1);
          const angle = Math.sin(tick * (0.9 + i * 0.25) + i) * 0.65;
          const endX = originX + Math.sin(angle) * h * 1.1;
          const grad = ctx.createLinearGradient(originX, 0, endX, h);
          const hue = (tick * 40 + i * 75) % 360;
          grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.16)`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(originX - 8, 0);
          ctx.lineTo(originX + 8, 0);
          ctx.lineTo(endX + 75, h);
          ctx.lineTo(endX - 75, h);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (features.floatingParticles) {
        for (const p of particles) {
          p.y -= p.vy * (isPlaying ? 1.4 : 0.6);
          p.x += p.vx + Math.sin(tick + p.y * 0.01) * 0.25;
          if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = accentColor || '#22c55e';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (features.matrixRain) {
        ctx.font = '13px monospace';
        ctx.fillStyle = accentColor || '#22c55e';
        for (let i = 0; i < drops.length; i += 1) {
          if (Math.random() > 0.45) continue;
          const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
          ctx.globalAlpha = 0.22;
          ctx.fillText(ch, i * 22, drops[i] * 18);
          if (drops[i] * 18 > h && Math.random() > 0.97) {
            drops[i] = 0;
          }
          drops[i] += 0.65;
        }
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [needsCanvas, features.discoLasers, features.floatingParticles, features.matrixRain, isPlaying, accentColor]);

  return (
    <>
      {needsCanvas && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="fixed inset-0 z-[5] pointer-events-none"
        />
      )}

      {features.crtScanlines && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[65] pointer-events-none aurora-crt-scanlines opacity-35"
        />
      )}

      {features.clickSparks && sparks.length > 0 && (
        <div aria-hidden="true" className="fixed inset-0 z-[66] pointer-events-none overflow-hidden">
          {sparks.map((sp) => (
            <div
              key={sp.id}
              style={{ left: sp.x, top: sp.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <span
                  key={deg}
                  style={{
                    transform: `rotate(${deg}deg) translateY(-18px)`,
                    backgroundColor: 'var(--noir-accent)',
                  }}
                  className="absolute w-1.5 h-1.5 rounded-full opacity-80 animate-ping"
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
