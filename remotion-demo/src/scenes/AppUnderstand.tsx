import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {SceneFade} from '../components/SceneFade';
import {Stepper} from '../components/Stepper';
import {colors, fontFamily, site} from '../theme';

const QUESTION = 'Does overtime pay count toward my income?';
const ANSWER =
  "Yes — regular overtime is generally counted in your annual income for affordable housing. Here's the rule that answer comes from:";
const VERDICT_FRAME = 100;

// Scene 5 — steps 2 & 3: ask about the rules, get a cited answer, and see the
// readiness verdict once everything checks out.
export const AppUnderstand: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const questionIn = spring({frame: frame - 10, fps, config: {damping: 15, mass: 0.8}});
  const thinking = frame >= 26 && frame < 48;
  const answerIn = spring({frame: frame - 48, fps, config: {damping: 16, mass: 0.9}});
  const citationIn = spring({frame: frame - 62, fps, config: {damping: 15}});
  const verdictIn = spring({frame: frame - VERDICT_FRAME, fps, config: {damping: 13, mass: 0.8}});

  const stepperStates: ['done', 'active', 'locked'] | ['done', 'done', 'active'] =
    frame >= VERDICT_FRAME ? ['done', 'done', 'active'] : ['done', 'active', 'locked'];

  return (
    <SceneFade fadeIn={8} fadeOut={12}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily}}>
        <BrowserFrame width={1560} height={920}>
          <div style={{padding: '38px 56px 0'}}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: colors.foreground,
              }}
            >
              {site.appTitle}
            </div>
            <div style={{marginTop: 8, fontSize: 23, color: colors.mutedForeground}}>
              {site.appSubtitle}
            </div>

            <div style={{marginTop: 28}}>
              <Stepper states={stepperStates} />
            </div>

            <div
              style={{
                marginTop: 28,
                border: `1.5px solid rgba(181, 101, 74, 0.4)`,
                background: 'rgba(232, 223, 207, 0.42)',
                borderRadius: 26,
                padding: '26px 36px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingBottom: 16,
                  borderBottom: `1.5px solid rgba(213, 198, 180, 0.7)`,
                }}
              >
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: colors.success,
                    boxShadow: '0 0 0 5px rgba(54, 110, 69, 0.25)',
                  }}
                />
                <span
                  style={{
                    fontSize: 25,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: colors.foreground,
                  }}
                >
                  Ask about the rules
                </span>
                <span style={{fontSize: 19, color: colors.mutedForeground}}>
                  Every answer cites its source.
                </span>
              </div>

              <div style={{marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16}}>
                <div
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '72%',
                    background: colors.primaryDark,
                    color: colors.primaryForeground,
                    borderRadius: '18px 18px 5px 18px',
                    padding: '14px 22px',
                    fontSize: 23,
                    fontWeight: 600,
                    opacity: questionIn,
                    transform: `translateX(${(1 - questionIn) * 60}px)`,
                  }}
                >
                  {QUESTION}
                </div>

                {thinking ? (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: colors.background,
                      borderRadius: '18px 18px 18px 5px',
                      padding: '16px 22px',
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: colors.mutedForeground,
                          opacity:
                            0.3 +
                            0.7 *
                              Math.abs(
                                Math.sin((frame - 26) / 5 + (i * Math.PI) / 3)
                              ),
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                {frame >= 48 ? (
                  // The wrapper animates layout height from the thinking
                  // bubble's size, so the chat card grows smoothly instead of
                  // popping taller the moment the full answer mounts.
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '86%',
                      overflow: 'hidden',
                      borderRadius: '18px 18px 18px 5px',
                      maxHeight: 46 + answerIn * 240,
                    }}
                  >
                  <div
                    style={{
                      background: colors.background,
                      borderRadius: '18px 18px 18px 5px',
                      padding: '18px 24px',
                      opacity: answerIn,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 999,
                        border: `1.5px solid ${colors.input}`,
                        background: 'rgba(232, 223, 207, 0.35)',
                        color: colors.primaryDark,
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        padding: '3px 14px',
                        marginBottom: 12,
                      }}
                    >
                      ANSWERED
                    </div>
                    <div style={{fontSize: 23, lineHeight: 1.6, color: colors.foreground}}>
                      {ANSWER}
                    </div>
                    <div style={{marginTop: 14, display: 'flex', gap: 12, opacity: citationIn}}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          borderRadius: 999,
                          border: `1.5px solid ${colors.input}`,
                          color: colors.primaryDark,
                          fontSize: 18,
                          fontWeight: 750,
                          padding: '7px 18px',
                        }}
                      >
                        24 CFR 5.609 — Annual income
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 999,
                          border: `1.5px solid ${colors.input}`,
                          background: 'rgba(232, 223, 207, 0.45)',
                          color: colors.primaryDark,
                          fontSize: 16,
                          fontWeight: 800,
                          padding: '7px 14px',
                        }}
                      >
                        HUD
                      </span>
                    </div>
                  </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: verdictIn,
                transform: `translateY(${(1 - verdictIn) * 30}px)`,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 999,
                  border: `2.5px solid ${colors.primary}`,
                  background: 'rgba(232, 223, 207, 0.45)',
                  color: colors.primaryDark,
                  fontSize: 26,
                  fontWeight: 800,
                  padding: '12px 28px',
                }}
              >
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Ready to apply
              </span>
              <span style={{fontSize: 23, color: colors.mutedForeground, fontWeight: 550}}>
                Export your application packet when you&#39;re ready.
              </span>
            </div>
          </div>
        </BrowserFrame>
      </AbsoluteFill>
    </SceneFade>
  );
};
