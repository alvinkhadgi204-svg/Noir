import React, { useRef, useState } from 'react';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';
import type {
  AlbumArtStyle,
  CavaColorMode,
  CavaStyle,
  FontOption,
  FontScale,
  IconStyle,
  PlayerBarPosition,
  SidebarPosition,
} from '../types/music';
import { NoirIcon } from './NoirIcon';

const BASE_PRESETS = [
  { name: 'Obsidian', base: '#0a0a0a', surface: '#1a1a1a', elevated: '#2a2a2a' },
  { name: 'Graphite', base: '#111113', surface: '#1c1c20', elevated: '#2c2c32' },
  { name: 'Midnight Ink', base: '#090b10', surface: '#131722', elevated: '#1f2536' },
  { name: 'Espresso Noir', base: '#0f0c0a', surface: '#1c1714', elevated: '#2c2420' },
  { name: 'Deep Slate', base: '#090d0b', surface: '#131a17', elevated: '#1f2924' },
];

const ACCENT_PRESETS = [
  { name: 'Emerald Green', hex: '#22c55e' },
  { name: 'Aurora Cyan', hex: '#06b6d4' },
  { name: 'Midnight Cobalt', hex: '#3b82f6' },
  { name: 'Violet Synth', hex: '#a855f7' },
  { name: 'Crimson Velvet', hex: '#f43f5e' },
  { name: 'Solar Ember', hex: '#f97316' },
  { name: 'Ivory', hex: '#e5e5e5' },
];

const COMPLETE_THEME_PACKS: Array<{
  name: string;
  base: string;
  surface: string;
  elevated: string;
  accent: string;
  fontFamily: FontOption;
  cornerRadius: number;
}> = [
  {
    name: 'Aurora Emerald',
    base: '#0a0a0a',
    surface: '#1a1a1a',
    elevated: '#2a2a2a',
    accent: '#22c55e',
    fontFamily: 'Plus Jakarta Sans',
    cornerRadius: 12,
  },
  {
    name: 'Midnight Study',
    base: '#070a12',
    surface: '#111626',
    elevated: '#1b2238',
    accent: '#38bdf8',
    fontFamily: 'Satoshi',
    cornerRadius: 14,
  },
  {
    name: 'Violet Synth',
    base: '#090712',
    surface: '#161126',
    elevated: '#241c3d',
    accent: '#a855f7',
    fontFamily: 'Syne',
    cornerRadius: 16,
  },
  {
    name: 'Crimson Velvet',
    base: '#0d0709',
    surface: '#1b1014',
    elevated: '#2c1920',
    accent: '#f43f5e',
    fontFamily: 'Playfair Display',
    cornerRadius: 10,
  },
  {
    name: 'Mono Terminal',
    base: '#050505',
    surface: '#121212',
    elevated: '#1f1f1f',
    accent: '#e4e4e7',
    fontFamily: 'JetBrains Mono',
    cornerRadius: 4,
  },
  {
    name: 'Cyber Mint',
    base: '#060c0a',
    surface: '#0f1c17',
    elevated: '#182b24',
    accent: '#10b981',
    fontFamily: 'Space Grotesk',
    cornerRadius: 8,
  },
];

const FONT_OPTIONS: Array<{ id: FontOption; label: string; styleLabel: string; css: string }> = [
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', styleLabel: 'Clean Geometric', css: `'Plus Jakarta Sans', sans-serif` },
  { id: 'Satoshi', label: 'Satoshi', styleLabel: 'Studio Sans', css: `'Satoshi', sans-serif` },
  { id: 'Space Grotesk', label: 'Space Grotesk', styleLabel: 'Tech Display', css: `'Space Grotesk', sans-serif` },
  { id: 'Playfair Display', label: 'Playfair Display', styleLabel: 'Editorial Serif', css: `'Playfair Display', serif` },
  { id: 'JetBrains Mono', label: 'JetBrains Mono', styleLabel: 'Monospace', css: `'JetBrains Mono', monospace` },
  { id: 'Syne', label: 'Syne', styleLabel: 'Art Display', css: `'Syne', sans-serif` },
  { id: 'Outfit', label: 'Outfit', styleLabel: 'Rounded Modern', css: `'Outfit', sans-serif` },
  { id: 'Inter', label: 'Inter', styleLabel: 'Classic UI', css: `'Inter', sans-serif` },
];

export const ThemeEditorDrawer: React.FC = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importText, setImportText] = useState('');
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [customFontInput, setCustomFontInput] = useState('');
  const [customThemeName, setCustomThemeName] = useState('');

  const open = usePlayerStore((s) => s.themeEditorOpen);
  const setOpen = usePlayerStore((s) => s.setThemeEditorOpen);
  const theme = usePlayerStore((s) => s.theme);
  const updateTheme = usePlayerStore((s) => s.updateTheme);
  const resetTheme = usePlayerStore((s) => s.resetTheme);
  const importThemeJson = usePlayerStore((s) => s.importThemeJson);
  const savedThemes = usePlayerStore((s) => s.savedThemes);
  const saveCustomTheme = usePlayerStore((s) => s.saveCustomTheme);
  const deleteCustomTheme = usePlayerStore((s) => s.deleteCustomTheme);
  const showToast = usePlayerStore((s) => s.showToast);

  const handleExportJson = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aurora-theme.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported aurora-theme.json', 'success');
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="relative z-10 w-full max-w-md h-full noir-glass border-l border-white/10 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.08] shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-white">Theme Studio</h2>
                <p className="text-xs text-neutral-400">Live customization saved locally</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close theme editor"
                className="p-2 text-neutral-400 hover:text-white rounded-md hover:bg-white/10"
              >
                <NoirIcon icon={X} className="w-4 h-4" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Complete Custom Theme Packs */}
              <section className="space-y-2.5">
                <p className="font-medium text-neutral-200">Custom Theme Packs</p>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLETE_THEME_PACKS.map((pack) => {
                    const active =
                      theme.baseBg.toLowerCase() === pack.base &&
                      theme.accentColor.toLowerCase() === pack.accent;
                    return (
                      <button
                        key={pack.name}
                        onClick={() =>
                          updateTheme({
                            baseBg: pack.base,
                            surfaceBg: pack.surface,
                            elevatedBg: pack.elevated,
                            accentColor: pack.accent,
                            fontFamily: pack.fontFamily,
                            cornerRadius: pack.cornerRadius,
                          })
                        }
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--noir-btn-radius)] border text-left transition-colors ${
                          active
                            ? 'border-[var(--noir-accent)] text-white bg-white/[0.08]'
                            : 'border-white/10 text-neutral-300 hover:border-white/25'
                        }`}
                      >
                        <span className="flex items-center -space-x-1 shrink-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: pack.base }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: pack.accent }}
                          />
                        </span>
                        <span className="truncate font-medium">{pack.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Save Your Own Custom Theme */}
              <section className="space-y-2.5">
                <p className="font-medium text-neutral-200">Your Saved Custom Themes</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!customThemeName.trim()) return;
                    saveCustomTheme(customThemeName);
                    setCustomThemeName('');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={customThemeName}
                    onChange={(e) => setCustomThemeName(e.target.value)}
                    placeholder="Name this color & font theme..."
                    className="flex-1 px-3 py-2 text-xs bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn shrink-0"
                  >
                    Save
                  </button>
                </form>

                {savedThemes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {savedThemes.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-[var(--noir-btn-radius)] bg-[var(--noir-base)] border border-white/10"
                      >
                        <button
                          onClick={() => updateTheme(preset.theme)}
                          className="flex items-center gap-1.5 text-neutral-200 hover:text-white"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: preset.theme.accentColor }}
                          />
                          <span>{preset.name}</span>
                        </button>
                        <button
                          onClick={() => deleteCustomTheme(preset.id)}
                          aria-label={`Delete ${preset.name}`}
                          className="p-1 text-neutral-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Matte Base Presets */}
              <section className="space-y-2.5">
                <p className="font-medium text-neutral-200">Dark Palette Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {BASE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() =>
                        updateTheme({ baseBg: p.base, surfaceBg: p.surface, elevatedBg: p.elevated })
                      }
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--noir-btn-radius)] border text-left transition-colors ${
                        theme.baseBg.toLowerCase() === p.base
                          ? 'border-[var(--noir-accent)] text-white bg-white/[0.06]'
                          : 'border-white/10 text-neutral-300 hover:border-white/25'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: p.base }}
                      />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Color Pickers */}
              <section className="space-y-3">
                <p className="font-medium text-neutral-200">Colors</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    <span className="text-neutral-300">Base BG</span>
                    <input
                      type="color"
                      value={theme.baseBg}
                      onChange={(e) => updateTheme({ baseBg: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    <span className="text-neutral-300">Surface</span>
                    <input
                      type="color"
                      value={theme.surfaceBg}
                      onChange={(e) => updateTheme({ surfaceBg: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    <span className="text-neutral-300">Elevated</span>
                    <input
                      type="color"
                      value={theme.elevatedBg}
                      onChange={(e) => updateTheme({ elevatedBg: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    <span className="text-neutral-300">Accent</span>
                    <input
                      type="color"
                      value={theme.accentColor}
                      onChange={(e) => updateTheme({ accentColor: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Accent Swatches */}
                <div className="flex items-center gap-2 pt-1">
                  {ACCENT_PRESETS.map((sw) => (
                    <button
                      key={sw.hex}
                      title={sw.name}
                      onClick={() => updateTheme({ accentColor: sw.hex })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        theme.accentColor.toLowerCase() === sw.hex ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>
              </section>

              {/* Fonts & Typography */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-neutral-200">Fonts &amp; Typography</p>
                  <span className="text-[11px] text-[var(--noir-accent)] truncate max-w-[160px]">
                    {theme.fontFamily}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map((f) => {
                    const active = theme.fontFamily === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => updateTheme({ fontFamily: f.id })}
                        style={{ fontFamily: f.css }}
                        className={`p-2.5 rounded-[var(--noir-btn-radius)] border text-left transition-colors ${
                          active
                            ? 'border-[var(--noir-accent)] bg-white/[0.08] text-white'
                            : 'border-white/10 bg-[var(--noir-base)] text-neutral-300 hover:border-white/25'
                        }`}
                      >
                        <p className="text-xs font-semibold truncate">{f.label}</p>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{f.styleLabel}</p>
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = customFontInput.trim();
                    if (!trimmed) return;
                    updateTheme({ fontFamily: trimmed });
                    showToast(`Font changed to "${trimmed}"`, 'success');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={customFontInput}
                    onChange={(e) => setCustomFontInput(e.target.value)}
                    placeholder="Any Google or system font (e.g. Poppins, Lora)..."
                    className="flex-1 px-3 py-2 text-xs bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn shrink-0"
                  >
                    Apply
                  </button>
                </form>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-neutral-400">Text Size</span>
                  <div className="flex items-center gap-1 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    {(['S', 'M', 'L', 'XL'] as FontScale[]).map((sc) => (
                      <button
                        key={sc}
                        onClick={() => updateTheme({ fontScale: sc })}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          theme.fontScale === sc
                            ? 'bg-[var(--noir-accent)] text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Geometry & Motion Sliders */}
              <section className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Corner Radius</span>
                    <span className="tabular-nums text-[var(--noir-accent)]">{theme.cornerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={theme.cornerRadius}
                    onChange={(e) => updateTheme({ cornerRadius: Number(e.target.value) })}
                    className="w-full accent-[var(--noir-accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Overlay Blur Intensity</span>
                    <span className="tabular-nums text-[var(--noir-accent)]">{theme.blurIntensity}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={theme.blurIntensity}
                    onChange={(e) => updateTheme({ blurIntensity: Number(e.target.value) })}
                    className="w-full accent-[var(--noir-accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Animation Speed</span>
                    <span className="tabular-nums text-[var(--noir-accent)]">
                      {theme.animationSpeed === 0 ? 'Off' : `${theme.animationSpeed.toFixed(1)}×`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.25}
                    value={theme.animationSpeed}
                    onChange={(e) => updateTheme({ animationSpeed: Number(e.target.value) })}
                    className="w-full accent-[var(--noir-accent)]"
                  />
                </div>
              </section>

              {/* Icon Style & Layout */}
              <section className="space-y-3">
                <p className="font-medium text-neutral-200">Iconography &amp; Layout</p>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-400">Icon Style</span>
                  <div className="flex items-center gap-1 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    {(['outline', 'filled', 'duotone'] as IconStyle[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => updateTheme({ iconStyle: style })}
                        className={`px-2.5 py-1 capitalize rounded transition-colors ${
                          theme.iconStyle === style
                            ? 'bg-[var(--noir-accent)] text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-400">Sidebar</span>
                  <div className="flex items-center gap-1 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    {(['left', 'right'] as SidebarPosition[]).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => updateTheme({ sidebarPosition: pos })}
                        className={`px-3 py-1 capitalize rounded transition-colors ${
                          theme.sidebarPosition === pos
                            ? 'bg-[var(--noir-accent)] text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-400">Player Bar</span>
                  <div className="flex items-center gap-1 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    {(['bottom', 'floating'] as PlayerBarPosition[]).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => updateTheme({ playerBarPosition: pos })}
                        className={`px-3 py-1 capitalize rounded transition-colors ${
                          theme.playerBarPosition === pos
                            ? 'bg-[var(--noir-accent)] text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-neutral-400 block">Album Art Style</span>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                    {(['square', 'rounded', 'circular', 'blurred'] as AlbumArtStyle[]).map((art) => (
                      <button
                        key={art}
                        onClick={() => updateTheme({ albumArtStyle: art })}
                        className={`py-1.5 capitalize rounded transition-colors ${
                          theme.albumArtStyle === art
                            ? 'bg-[var(--noir-accent)] text-black font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {art}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* CAVA Visualizer Style & Color Options */}
              <section className="space-y-3">
                <p className="font-medium text-neutral-200">CAVA Visualizer Style &amp; Colors</p>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                  {(
                    [
                      { id: 'bars', label: 'Bars' },
                      { id: 'mirror', label: 'Mirror' },
                      { id: 'wave', label: 'Wave' },
                      { id: 'blocks', label: 'Blocks' },
                      { id: 'peaks', label: 'Peaks' },
                      { id: 'radial', label: 'Radial' },
                    ] as Array<{ id: CavaStyle; label: string }>
                  ).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => updateTheme({ cavaStyle: st.id })}
                      className={`py-1.5 rounded transition-colors ${
                        theme.cavaStyle === st.id
                          ? 'bg-[var(--noir-accent)] text-black font-semibold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'accent', label: 'Accent' },
                      { id: 'aurora', label: 'Aurora' },
                      { id: 'cyber', label: 'Cyber' },
                      { id: 'sunset', label: 'Sunset' },
                      { id: 'rainbow', label: 'Rainbow' },
                      { id: 'monochrome', label: 'Mono' },
                      { id: 'custom', label: 'Custom' },
                    ] as Array<{ id: CavaColorMode; label: string }>
                  ).map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() => updateTheme({ cavaColorMode: cm.id })}
                      className={`px-2.5 py-1 rounded-md border transition-colors ${
                        theme.cavaColorMode === cm.id
                          ? 'border-[var(--noir-accent)] bg-white/10 text-white font-semibold'
                          : 'border-white/10 bg-[var(--noir-base)] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {cm.label}
                    </button>
                  ))}
                </div>

                {theme.cavaColorMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                      <span className="text-neutral-300">CAVA Base</span>
                      <input
                        type="color"
                        value={theme.cavaPrimaryColor}
                        onChange={(e) => updateTheme({ cavaPrimaryColor: e.target.value })}
                        className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between px-3 py-2 bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)]">
                      <span className="text-neutral-300">CAVA Peak</span>
                      <input
                        type="color"
                        value={theme.cavaSecondaryColor}
                        onChange={(e) => updateTheme({ cavaSecondaryColor: e.target.value })}
                        className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </section>

              {/* Custom CSS Injection */}
              <section className="space-y-2">
                <p className="font-medium text-neutral-200">Custom CSS (Advanced)</p>
                <textarea
                  value={theme.customCss}
                  onChange={(e) => updateTheme({ customCss: e.target.value })}
                  rows={4}
                  placeholder=".noir-card { border-color: rgba(255,255,255,0.12); }"
                  className="w-full p-2.5 font-mono text-[11px] bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-neutral-200 focus:outline-none focus:border-[var(--noir-accent)] resize-y"
                />
              </section>

              {/* Export / Import JSON */}
              <section className="pt-2 border-t border-white/[0.08] space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 text-neutral-100 noir-btn"
                  >
                    <NoirIcon icon={Download} className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--noir-elevated)] hover:bg-white/15 border border-white/10 text-neutral-100 noir-btn"
                  >
                    <NoirIcon icon={Upload} className="w-3.5 h-3.5" />
                    <span>Import File</span>
                  </button>

                  <button
                    onClick={() => setShowJsonPaste((v) => !v)}
                    className="px-3 py-2 border border-white/10 text-neutral-300 hover:text-white noir-btn"
                  >
                    Paste JSON
                  </button>

                  <button
                    onClick={resetTheme}
                    className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-neutral-400 hover:text-white noir-btn ml-auto"
                  >
                    <NoirIcon icon={RotateCcw} className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                {showJsonPaste && (
                  <div className="space-y-2">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={3}
                      placeholder="Paste exported Noir theme JSON..."
                      className="w-full p-2 font-mono text-[11px] bg-[var(--noir-base)] border border-white/10 rounded-[var(--noir-btn-radius)] text-neutral-200"
                    />
                    <button
                      onClick={() => {
                        if (importThemeJson(importText)) {
                          setImportText('');
                          setShowJsonPaste(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-[var(--noir-accent)] text-black font-semibold noir-btn"
                    >
                      Apply JSON
                    </button>
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const text = await f.text();
                      importThemeJson(text);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
