import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '../store/usePlayerStore';

export const ToastBanner: React.FC = () => {
  const toast = usePlayerStore((s) => s.toast);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-xs font-medium rounded-[var(--noir-btn-radius)] border shadow-2xl noir-glass ${
            toast.tone === 'error'
              ? 'border-red-500/40 text-red-200'
              : toast.tone === 'success'
              ? 'border-[var(--noir-accent)]/50 text-white'
              : 'border-white/15 text-neutral-100'
          }`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
