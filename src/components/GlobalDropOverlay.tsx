import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { NoirIcon } from './NoirIcon';

export const GlobalDropOverlay: React.FC = () => {
  const [active, setActive] = useState(false);
  const importLocalFiles = usePlayerStore((s) => s.importLocalFiles);

  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter += 1;
        setActive(true);
      }
    };

    const onDragLeave = () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setActive(false);
    };

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    };

    const onDrop = (e: DragEvent) => {
      dragCounter = 0;
      setActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        void importLocalFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [importLocalFiles]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none">
      <div className="noir-card border-2 border-dashed border-[var(--noir-accent)] px-10 py-8 text-center space-y-3">
        <NoirIcon icon={Upload} className="w-8 h-8 text-[var(--noir-accent)] mx-auto" />
        <p className="text-base font-semibold text-white">Drop audio files to import</p>
        <p className="text-xs text-neutral-400">MP3, FLAC, OGG, WAV, M4A · Saved offline in Aurora Vibes</p>
      </div>
    </div>
  );
};
