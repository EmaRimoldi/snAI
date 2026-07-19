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

// Scene 6 — closing card: brand lockup, tagline, URL, and the honest footnote.
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const lockupIn = spring({frame, fps, config: {damping: 14, mass: 0.9}});
  const tagIn = spring({frame: frame - 14, fps, config: {damping: 18}});
  const urlIn = spring({frame: frame - 26, fps, config: {damping: 15}});
  const noteIn = interpolate(frame, [44, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneFade fadeIn={8} fadeOut={0}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 36,
            opacity: lockupIn,
            transform: `scale(${interpolate(lockupIn, [0, 1], [0.85, 1])})`,
          }}
        >
          <Logo
            size={150}
            style={{
              filter: 'drop-shadow(0 16px 36px rgba(42, 33, 28, 0.18))',
              borderRadius: 33,
            }}
          />
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: colors.primary,
            }}
          >
            {site.name}
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 42,
            fontWeight: 550,
            color: colors.mutedForeground,
            opacity: tagIn,
            transform: `translateY(${(1 - tagIn) * 20}px)`,
          }}
        >
          {site.tagline}
        </div>

        <div
          style={{
            marginTop: 44,
            opacity: urlIn,
            transform: `scale(${interpolate(urlIn, [0, 1], [0.8, 1])})`,
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 999,
            border: `1.5px solid ${colors.primaryDark}`,
            background: colors.primaryDark,
            color: colors.primaryForeground,
            fontSize: 30,
            fontWeight: 750,
            padding: '18px 46px',
            boxShadow: '0 14px 34px rgba(145, 75, 55, 0.2)',
          }}
        >
          {site.url}
        </div>

        <div
          style={{
            marginTop: 46,
            display: 'flex',
            alignItems: 'center',
            fontSize: 23,
            fontWeight: 520,
            color: colors.mutedForeground,
            opacity: noteIn,
          }}
        >
          {site.assurances.map((a, i) => (
            <React.Fragment key={a}>
              {i > 0 ? (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'currentColor',
                    opacity: 0.72,
                    margin: '0 20px',
                    display: 'inline-block',
                  }}
                />
              ) : null}
              <span>{a}</span>
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 19,
            color: colors.mutedForeground,
            opacity: noteIn * 0.85,
          }}
        >
          RealDoor prepares and checks paperwork — it never decides eligibility.
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
