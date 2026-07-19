import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Logo} from '../components/Logo';
import {SceneFade} from '../components/SceneFade';
import {colors, fontFamily, site} from '../theme';

// Scene 1 — brand reveal: logo tile springs in, wordmark slides out beside it,
// tagline fades up underneath.
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logoIn = spring({frame, fps, config: {damping: 14, mass: 0.9}});
  const wordIn = spring({frame: frame - 12, fps, config: {damping: 16}});
  const tagIn = spring({frame: frame - 30, fps, config: {damping: 18}});

  const wordShift = interpolate(wordIn, [0, 1], [-40, 0]);
  const tagShift = interpolate(tagIn, [0, 1], [24, 0]);

  return (
    <SceneFade fadeIn={0} fadeOut={12}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 44}}>
          <Logo
            size={190}
            style={{
              transform: `scale(${logoIn}) rotate(${(1 - logoIn) * -8}deg)`,
              filter: 'drop-shadow(0 18px 40px rgba(42, 33, 28, 0.18))',
              borderRadius: 42,
            }}
          />
          <div
            style={{
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: colors.primary,
              opacity: wordIn,
              transform: `translateX(${wordShift}px)`,
            }}
          >
            {site.name}
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 46,
            fontWeight: 550,
            letterSpacing: '-0.01em',
            color: colors.mutedForeground,
            opacity: tagIn,
            transform: `translateY(${tagShift}px)`,
          }}
        >
          {site.tagline}
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
