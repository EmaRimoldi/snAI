import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// Fades scene content in at the start and out at the end of its Sequence.
// The shared cream background + grid stay constant, so this reads as a calm
// crossfade between sections.
export const SceneFade: React.FC<{
  children: React.ReactNode;
  fadeIn?: number;
  fadeOut?: number;
  style?: React.CSSProperties;
}> = ({children, fadeIn = 10, fadeOut = 10, style}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const inOpacity = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 1;
  const outOpacity = fadeOut > 0
    ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <AbsoluteFill style={{opacity: Math.min(inOpacity, outOpacity), ...style}}>
      {children}
    </AbsoluteFill>
  );
};
