import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export type CursorWaypoint = {frame: number; x: number; y: number};

// A macOS-style pointer that eases between waypoints, with an optional click
// ripple at given frames.
export const Cursor: React.FC<{
  waypoints: CursorWaypoint[];
  clickFrames?: number[];
  scale?: number;
  appearAt?: number;
}> = ({waypoints, clickFrames = [], scale = 1.6, appearAt = 0}) => {
  const frame = useCurrentFrame();

  const xs = waypoints.map((w) => w.x);
  const ys = waypoints.map((w) => w.y);
  const fs = waypoints.map((w) => w.frame);

  const x = interpolate(frame, fs, xs, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const y = interpolate(frame, fs, ys, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  const opacity = interpolate(frame, [appearAt, appearAt + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Press-down effect around each click frame
  let press = 0;
  let ripple: {r: number; o: number} | null = null;
  for (const cf of clickFrames) {
    const d = frame - cf;
    if (d >= -3 && d <= 3) {
      press = Math.max(press, 1 - Math.abs(d) / 3);
    }
    if (d >= 0 && d <= 16) {
      const t = d / 16;
      const o = (1 - t) * 0.5;
      if (!ripple || o > ripple.o) {
        ripple = {r: 12 + t * 44, o};
      }
    }
  }

  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity, pointerEvents: 'none'}}>
      {ripple ? (
        <div
          style={{
            position: 'absolute',
            left: x - ripple.r,
            top: y - ripple.r,
            width: ripple.r * 2,
            height: ripple.r * 2,
            borderRadius: '50%',
            border: '3px solid rgba(145, 75, 55, 0.8)',
            opacity: ripple.o,
          }}
        />
      ) : null}
      <svg
        width={28 * scale}
        height={28 * scale}
        viewBox="0 0 28 28"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `scale(${1 - press * 0.12})`,
          transformOrigin: '4px 4px',
          filter: 'drop-shadow(0 2px 4px rgba(42,33,28,0.35))',
        }}
      >
        <path
          d="M 5 3 L 5 21 L 9.5 17 L 12.5 23.5 L 15.5 22 L 12.7 15.8 L 18.5 15.5 Z"
          fill="#2a211c"
          stroke="#faf6ef"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
