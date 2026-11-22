import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';

export const UsernameOnboardingModal: React.FC = () => {
  const initialized = usePlayerStore((s) => s.initialized);
  const hasCompletedOnboarding = usePlayerStore((s) => s.hasCompletedOnboarding);
  const setUsername = usePlayerStore((s) => s.setUsername);

  const [nameInput, setNameInput] = useState('');

  const visible = initialized && !hasCompletedOnboarding;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsername(nameInput.trim() || 'Listener');
  };

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-md noir-card p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
          >
            <div
              className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none opacity-25 blur-3xl"
              style={{ backgroundColor: 'var(--noir-accent)' }}
            />

            <div className="flex items-center gap-3 relative">
              <div className="w-12 h-12 rounded-[var(--noir-radius)] bg-[#0f0f0f] border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                <img src="/pwa-192x192.png" alt="Aurora Vibes" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Welcome to Aurora Vibes</h2>
                <p className="text-xs text-neutral-400">Your personal music &amp; calm study studio</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative">
              <div className="space-y-1.5">
                <label htmlFor="aurora-onboarding-username" className="block text-xs font-medium text-neutral-300">
                  Choose your username
                </label>
                <input
                  id="aurora-onboarding-username"
                  type="text"
                  maxLength={32}
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name or handle..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--noir-base)] border border-white/15 rounded-[var(--noir-btn-radius)] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--noir-accent)] transition-colors"
                />
                <p className="text-[11px] text-neutral-500">
                  Saved locally — only asked once. You can change it anytime in Settings.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUsername('Listener')}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white border border-white/10 noir-btn transition-colors"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-black bg-[var(--noir-accent)] hover:opacity-90 noir-btn transition-opacity"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Continue</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
