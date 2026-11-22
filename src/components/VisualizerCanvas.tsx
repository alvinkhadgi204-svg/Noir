import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { usePlayerStore } from '../store/usePlayerStore';
import type { CavaColorMode, VisualizerMode } from '../types/music';

interface VisualizerCanvasProps {
  mode: VisualizerMode;
  height?: number;
  compact?: boolean;
  className?: string;
}

function getPaletteColors(
  colorMode: CavaColorMode,
  accentColor: string,
  primary: string,
  secondary: string
): [string, string, string] {
  switch (colorMode) {
    case 'aurora':
      return ['#22c55e', '#06b6d4', '#818cf8'];
    case 'cyber':
      return ['#ec4899', '#a855f7', '#22d3ee'];
    case 'sunset':
      return ['#f97316', '#f43f5e', '#c084fc'];
    case 'monochrome':
      return ['#71717a', '#d4d4d8', '#ffffff'];
    case 'custom':
      return [primary || accentColor, secondary || '#06b6d4', '#ffffff'];
    case 'accent':
    default:
      return [accentColor, accentColor, '#f4f4f5'];
  }
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  mode,
  height = 140,
  compact = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(96));
  const peakCapsRef = useRef<Float32Array>(new Float32Array(96));
  const peakHoldRef = useRef<Float32Array>(new Float32Array(96));

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const accentColor = usePlayerStore((s) => s.theme.accentColor);
  const cavaStyle = usePlayerStore((s) => s.theme.cavaStyle || 'bars');
  const cavaColorMode = usePlayerStore((s) => s.theme.cavaColorMode || 'accent');
  const cavaPrimaryColor = usePlayerStore((s) => s.theme.cavaPrimaryColor || '#22c55e');
  const cavaSecondaryColor = usePlayerStore((s) => s.theme.cavaSecondaryColor || '#06b6d4');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let phase = 0;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(100, Math.floor(rect.width * dpr));
      const targetH = Math.max(40, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const analyser = audioEngine.getAnalyser();
      const bufferLen = analyser ? analyser.frequencyBinCount : 128;
      const freqData = new Uint8Array(bufferLen);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqData);
      } else if (isPlaying) {
        phase += 0.055;
        for (let i = 0; i < bufferLen; i += 1) {
          const wave =
            Math.sin(i * 0.22 + phase) * 0.45 +
            Math.cos(i * 0.09 - phase * 1.4) * 0.35 +
            0.45;
          const taper = Math.max(0.2, 1 - i / (bufferLen * 1.1));
          freqData[i] = Math.max(8, Math.min(240, Math.round(wave * taper * 200)));
        }
      }

      const [c0, c1, c2] = getPaletteColors(cavaColorMode, accentColor, cavaPrimaryColor, cavaSecondaryColor);
      const effectiveCircular = mode === 'circular' || (mode === 'cava' && cavaStyle === 'radial');

      if (!effectiveCircular) {
        const barCount = compact ? 28 : cavaStyle === 'blocks' ? 32 : 48;
        const smoothed = smoothedBarsRef.current;
        const peaks = peakCapsRef.current;
        const holdTimers = peakHoldRef.current;

        const padX = 2 * dpr;
        const usableW = Math.max(10, w - padX * 2);
        const slotW = usableW / barCount;
        const barW = Math.max(2 * dpr, Math.floor(slotW * (cavaStyle === 'peaks' ? 0.48 : 0.7)));
        const offsetX = Math.floor((slotW - barW) / 2);

        const segH = Math.max(2 * dpr, Math.floor((cavaStyle === 'blocks' ? 6 : compact ? 3 : 4) * dpr));
        const segGap = Math.max(1 * dpr, Math.floor((cavaStyle === 'blocks' ? 2.5 : 1.5) * dpr));
        const segStep = segH + segGap;
        const maxDrawH = h - 3 * dpr;

        const verticalGrad = ctx.createLinearGradient(0, h, 0, 0);
        verticalGrad.addColorStop(0, c0);
        verticalGrad.addColorStop(0.55, c1);
        verticalGrad.addColorStop(1, c2);

        const minBin = 1;
        const maxBin = Math.max(minBin + 2, Math.floor(bufferLen * 0.62));

        const values: number[] = [];

        for (let i = 0; i < barCount; i += 1) {
          const t0 = i / barCount;
          const t1 = (i + 1) / barCount;
          const b0 = Math.floor(minBin * Math.pow(maxBin / minBin, t0));
          const b1 = Math.max(b0 + 1, Math.floor(minBin * Math.pow(maxBin / minBin, t1)));

          let sum = 0;
          let peakBin = 0;
          for (let b = b0; b < b1 && b < bufferLen; b += 1) {
            const val = freqData[b] || 0;
            sum += val;
            if (val > peakBin) peakBin = val;
          }
          const avg = sum / Math.max(1, b1 - b0);
          const trebleBoost = 0.88 + t0 * 0.42;
          const rawTarget = isPlaying
            ? Math.min(1, ((avg * 0.55 + peakBin * 0.45) / 255) * trebleBoost)
            : 0;

          const prev = smoothed[i] || 0;
          const nextVal =
            rawTarget > prev
              ? prev + (rawTarget - prev) * 0.52
              : Math.max(0, prev - (0.022 + prev * 0.045));
          smoothed[i] = nextVal;
          values.push(nextVal);

          if (nextVal >= peaks[i]) {
            peaks[i] = nextVal;
            holdTimers[i] = 14;
          } else if (holdTimers[i] > 0) {
            holdTimers[i] -= 1;
          } else {
            peaks[i] = Math.max(nextVal, peaks[i] - 0.014);
          }
        }

        if (cavaStyle === 'wave') {
          const horizGrad = ctx.createLinearGradient(0, 0, w, 0);
          if (cavaColorMode === 'rainbow') {
            horizGrad.addColorStop(0, '#f43f5e');
            horizGrad.addColorStop(0.25, '#f59e0b');
            horizGrad.addColorStop(0.5, '#22c55e');
            horizGrad.addColorStop(0.75, '#06b6d4');
            horizGrad.addColorStop(1, '#a855f7');
          } else {
            horizGrad.addColorStop(0, c0);
            horizGrad.addColorStop(0.5, c1);
            horizGrad.addColorStop(1, c2);
          }

          ctx.beginPath();
          const baseline = h - 4 * dpr;
          ctx.moveTo(padX, baseline);
          for (let i = 0; i < values.length; i += 1) {
            const x = padX + i * slotW + slotW / 2;
            const y = baseline - values[i] * (maxDrawH - 4 * dpr);
            if (i === 0) {
              ctx.lineTo(x, y);
            } else {
              const prevX = padX + (i - 1) * slotW + slotW / 2;
              const prevY = baseline - values[i - 1] * (maxDrawH - 4 * dpr);
              const midX = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + y) / 2);
            }
          }
          ctx.lineTo(w - padX, baseline);
          ctx.closePath();
          ctx.globalAlpha = isPlaying ? 0.24 : 0.1;
          ctx.fillStyle = horizGrad;
          ctx.fill();

          ctx.beginPath();
          for (let i = 0; i < values.length; i += 1) {
            const x = padX + i * slotW + slotW / 2;
            const y = baseline - values[i] * (maxDrawH - 4 * dpr);
            if (i === 0) ctx.moveTo(x, y);
            else {
              const prevX = padX + (i - 1) * slotW + slotW / 2;
              const prevY = baseline - values[i - 1] * (maxDrawH - 4 * dpr);
              const midX = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + y) / 2);
            }
          }
          ctx.globalAlpha = isPlaying ? 0.95 : 0.35;
          ctx.strokeStyle = horizGrad;
          ctx.lineWidth = 2.4 * dpr;
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          for (let i = 0; i < barCount; i += 1) {
            const nextVal = values[i];
            const x = Math.floor(padX + i * slotW + offsetX);
            const barFill =
              cavaColorMode === 'rainbow'
                ? `hsl(${Math.round((i / barCount) * 320)}, 85%, 60%)`
                : verticalGrad;

            if (cavaStyle === 'mirror') {
              const centerY = h / 2;
              const halfH = Math.max(2 * dpr, nextVal * (h * 0.45));
              ctx.fillStyle = barFill;
              ctx.globalAlpha = isPlaying ? 0.9 : 0.3;
              ctx.beginPath();
              ctx.roundRect(x, centerY - halfH, barW, halfH * 2, Math.min(barW / 2, 4 * dpr));
              ctx.fill();
            } else if (cavaStyle === 'peaks') {
              const barH = Math.max(2 * dpr, nextVal * maxDrawH);
              ctx.fillStyle = barFill;
              ctx.globalAlpha = isPlaying ? 0.48 : 0.2;
              ctx.fillRect(x, h - barH, barW, barH);

              if (peaks[i] > 0.02) {
                const peakY = Math.max(0, Math.floor(h - peaks[i] * maxDrawH - 2 * dpr));
                ctx.fillStyle = cavaColorMode === 'rainbow' ? barFill : c2;
                ctx.globalAlpha = isPlaying ? 0.95 : 0.35;
                ctx.fillRect(x, peakY, barW, 2.5 * dpr);
              }
            } else {
              // Classic segmented CAVA 'bars' or chunky LED 'blocks'
              const totalBarH = Math.max(segH, nextVal * maxDrawH);
              const segments = Math.max(1, Math.floor(totalBarH / segStep));
              ctx.fillStyle = barFill;
              for (let s = 0; s < segments; s += 1) {
                const sy = Math.floor(h - (s + 1) * segStep + segGap);
                if (sy < 0) break;
                ctx.globalAlpha = isPlaying ? 0.38 + (s / Math.max(1, Math.floor(maxDrawH / segStep))) * 0.62 : 0.25;
                ctx.fillRect(x, sy, barW, segH);
              }

              if (peaks[i] > 0.03) {
                const peakY = Math.max(0, Math.floor(h - peaks[i] * maxDrawH - segH));
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = isPlaying ? 0.85 : 0.25;
                ctx.fillRect(x, peakY, barW, Math.max(1.5 * dpr, segH * 0.6));
              }
            }
          }
          ctx.globalAlpha = 1;
        }
      } else {
        // Circular / Radial CAVA spectrum
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = Math.min(w, h) * (compact ? 0.24 : 0.28);
        const maxBarLen = Math.min(w, h) * 0.19;
        const bars = compact ? 64 : 108;

        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();

        ctx.lineCap = 'round';
        ctx.lineWidth = compact ? 2 * dpr : 2.6 * dpr;

        for (let i = 0; i < bars; i += 1) {
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const sampleIdx = Math.floor((i / bars) * (bufferLen * 0.5));
          const val = (freqData[sampleIdx] || 0) / 255;
          const len = Math.max(3 * dpr, val * maxBarLen);

          const x1 = cx + Math.cos(angle) * (baseRadius + 3 * dpr);
          const y1 = cy + Math.sin(angle) * (baseRadius + 3 * dpr);
          const x2 = cx + Math.cos(angle) * (baseRadius + 3 * dpr + len);
          const y2 = cy + Math.sin(angle) * (baseRadius + 3 * dpr + len);

          ctx.strokeStyle =
            cavaColorMode === 'rainbow'
              ? `hsl(${Math.round((i / bars) * 360)}, 85%, 60%)`
              : i % 2 === 0
              ? c0
              : c1;
          ctx.globalAlpha = 0.35 + val * 0.65;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [mode, isPlaying, accentColor, compact, cavaStyle, cavaColorMode, cavaPrimaryColor, cavaSecondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`w-full block ${className}`}
    />
  );
};
