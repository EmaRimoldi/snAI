import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors} from '../theme';

// Replica of the site's `.cursor-grid`: a faint terracotta grid that slowly
// drifts (38px every 9s on the site) and is revealed through a soft radial
// spotlight. In the video the spotlight roams gently instead of following a
// mouse cursor.
export const GridBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  const cell = 38;
  const drift = (frame * cell) / (9 * fps); // 38px per 9 seconds, like the site

  const x = width / 2 + Math.sin(frame / 110) * width * 0.3;
  const y = height / 2 + Math.cos(frame / 140) * height * 0.24;
  const mask = `radial-gradient(circle 460px at ${x.toFixed(1)}px ${y.toFixed(
    1
  )}px, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 48%, rgba(0,0,0,0.28) 100%)`;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(90deg, ${colors.gridLine} 1.5px, transparent 1.5px), linear-gradient(${colors.gridLine} 1.5px, transparent 1.5px)`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${drift.toFixed(2)}px ${drift.toFixed(2)}px`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
};
