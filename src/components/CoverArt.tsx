import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { AlbumArtStyle } from '../types/music';

interface CoverArtProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  overrideStyle?: AlbumArtStyle;
  className?: string;
  isPlaying?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<CoverArtProps['size']>, string> = {
  xs: 'w-9 h-9',
  sm: 'w-11 h-11',
  md: 'w-14 h-14',
  lg: 'w-44 h-44',
  xl: 'w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80',
};

export const CoverArt: React.FC<CoverArtProps> = ({
  src,
  alt,
  size = 'sm',
  overrideStyle,
  className = '',
  isPlaying = false,
}) => {
  const [errored, setErrored] = useState(false);
  const albumArtStyle = usePlayerStore((s) => overrideStyle ?? s.theme.albumArtStyle);
  const cornerRadius = usePlayerStore((s) => s.theme.cornerRadius);
  const vinylWobble = usePlayerStore((s) => s.uselessFeatures.vinylWobble);

  const radiusStyle: React.CSSProperties =
    albumArtStyle === 'circular'
      ? { borderRadius: '9999px' }
      : albumArtStyle === 'square'
      ? { borderRadius: '2px' }
      : { borderRadius: `${Math.min(cornerRadius, size === 'xs' || size === 'sm' ? 8 : cornerRadius)}px` };

  const spinClass =
    albumArtStyle === 'circular' && isPlaying && (size === 'lg' || size === 'xl')
      ? 'animate-[spin_18s_linear_infinite]'
      : '';

  const wobbleClass =
    isPlaying && vinylWobble && (size === 'lg' || size === 'xl')
      ? 'aurora-vinyl-wobble'
      : '';

  return (
    <div
      style={radiusStyle}
      className={`relative overflow-hidden shrink-0 select-none bg-[var(--noir-elevated)] border border-white/10 ${SIZE_CLASSES[size]} ${spinClass} ${wobbleClass} ${className}`}
    >
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center relative"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(var(--noir-accent-rgb), 0.22), #0f0f0f)',
          }}
        >
          <img
            src="/pwa-192x192.png"
            alt={alt || 'Aurora Vibes'}
            className="w-[70%] h-[70%] object-contain opacity-85"
          />
          <Disc3 className="sr-only" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
