import React from 'react';
import {colors} from '../theme';

// Inline replica of the site's /logo.svg (a door opening inside a rounded tile).
export const Logo: React.FC<{size?: number; style?: React.CSSProperties}> = ({
  size = 100,
  style,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={style}
    >
      <rect width="100" height="100" rx="22" fill={colors.logoTile} />
      <rect x="18" y="14" width="64" height="72" rx="13" fill={colors.logoDoorClosed} />
      <rect x="18" y="14" width="40" height="72" rx="13" fill={colors.logoDoorOpen} />
    </svg>
  );
};
