import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {SceneFade} from '../components/SceneFade';
import {colors, fontFamily, site} from '../theme';

// Scene 3 — the landing page's three phase cards, entering with the same
// staggered rise the site uses (`phase-card-enter`).
export const Phases: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const headingIn = spring({frame, fps, config: {damping: 18}});

  return (
    <SceneFade fadeIn={8} fadeOut={12}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
        }}
      >
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: colors.foreground,
            opacity: headingIn,
            transform: `translateY(${(1 - headingIn) * 24}px)`,
            marginBottom: 76,
          }}
        >
          How RealDoor helps
        </div>
        <div style={{display: 'flex', gap: 44}}>
          {site.phases.map((phase, i) => {
            const s = spring({
              frame: frame - 14 - i * 9,
              fps,
              config: {damping: 15, mass: 0.9},
            });
            return (
              <div
                key={phase.title}
                style={{
                  width: 430,
                  minHeight: 380,
                  borderRadius: 30,
                  background: 'rgba(232, 223, 207, 0.55)',
                  boxShadow: '0 10px 30px rgba(42, 33, 28, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '58px 46px',
                  opacity: s,
                  transform: `translateY(${(1 - s) * 60}px) scale(${interpolate(
                    s,
                    [0, 1],
                    [0.96, 1]
                  )})`,
                }}
              >
                <div
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: '50%',
                    background: colors.primary,
                    color: colors.primaryForeground,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    fontWeight: 800,
                  }}
                >
                  {phase.n}
                </div>
                <div
                  style={{
                    marginTop: 34,
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: colors.foreground,
                  }}
                >
                  {phase.title}
                </div>
                <div
                  style={{
                    marginTop: 20,
                    fontSize: 27,
                    lineHeight: 1.6,
                    color: colors.mutedForeground,
                  }}
                >
                  {phase.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
