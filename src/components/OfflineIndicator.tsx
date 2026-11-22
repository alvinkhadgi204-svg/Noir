import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-100 bg-[var(--noir-elevated)] border border-white/15 noir-btn shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-[var(--noir-accent)]" />
      <span>Offline Mode — Local library active</span>
    </div>
  );
};
