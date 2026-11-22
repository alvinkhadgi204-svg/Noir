import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

interface NoirIconProps extends LucideProps {
  icon: LucideIcon;
  fillable?: boolean;
}

export const NoirIcon: React.FC<NoirIconProps> = ({
  icon: IconComponent,
  fillable = false,
  className = '',
  strokeWidth,
  fill,
  ...rest
}) => {
  const iconStyle = usePlayerStore((s) => s.theme.iconStyle);

  let computedFill = fill ?? 'none';
  let computedStrokeWidth = strokeWidth ?? 1.75;

  if (iconStyle === 'filled' && fillable) {
    computedFill = 'currentColor';
    computedStrokeWidth = strokeWidth ?? 1.5;
  } else if (iconStyle === 'duotone') {
    computedFill = fillable ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    computedStrokeWidth = strokeWidth ?? 1.85;
  }

  return (
    <IconComponent
      className={className}
      strokeWidth={computedStrokeWidth}
      fill={computedFill}
      {...rest}
    />
  );
};
