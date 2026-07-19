import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Cursor} from '../components/Cursor';
import {SceneFade} from '../components/SceneFade';
import {Stepper} from '../components/Stepper';
import {colors, fontFamily, site} from '../theme';

const CLICK_FRAME = 58;
const FILE_FRAMES = [74, 92, 110];
const FILE_NAMES = ['application_summary.pdf', 'pay_stub_march.pdf', 'employment_letter.pdf'];

// Scene 4 — inside the app (step 1, Profile): the user picks their PDFs and
// the readiness checklist flips from "Still missing" to "Uploaded".
export const AppUpload: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const frameIn = spring({frame, fps, config: {damping: 16, mass: 0.9}});
  const dropzoneActive = interpolate(
    frame,
    [CLICK_FRAME - 6, CLICK_FRAME, CLICK_FRAME + 40, CLICK_FRAME + 52],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <SceneFade fadeIn={8} fadeOut={12}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily}}>
        <div
          style={{
            opacity: frameIn,
            transform: `translateY(${(1 - frameIn) * 60}px) scale(${interpolate(
              frameIn,
              [0, 1],
              [0.97, 1]
            )})`,
          }}
        >
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
              <div
                style={{
                  marginTop: 8,
                  fontSize: 23,
                  color: colors.mutedForeground,
                }}
              >
                {site.appSubtitle}
              </div>

              <div style={{marginTop: 28}}>
                <Stepper states={['active', 'locked', 'locked']} />
              </div>

              <div
                style={{
                  marginTop: 28,
                  border: `1.5px solid ${colors.input}`,
                  background: 'rgba(232, 223, 207, 0.22)',
                  borderRadius: 26,
                  padding: '30px 36px',
                }}
              >
                <div
                  style={{
                    fontSize: 27,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: colors.foreground,
                  }}
                >
                  Upload your documents
                </div>

                <div
                  style={{
                    marginTop: 18,
                    border: `2.5px dashed ${
                      dropzoneActive > 0.5 ? colors.primary : colors.input
                    }`,
                    background:
                      dropzoneActive > 0.5
                        ? 'rgba(232, 223, 207, 0.42)'
                        : colors.background,
                    borderRadius: 26,
                    padding: '26px 30px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: colors.mutedForeground,
                      textAlign: 'center',
                    }}
                  >
                    Drag PDFs here, or choose files — pay stubs, benefit or employment
                    letters, your application summary.
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 999,
                      border: `1.5px solid ${colors.primaryDark}`,
                      background: colors.primaryDark,
                      color: colors.primaryForeground,
                      fontWeight: 700,
                      fontSize: 22,
                      padding: '12px 26px',
                      transform: `scale(${
                        1 -
                        0.06 *
                          Math.max(
                            0,
                            1 - Math.abs(frame - CLICK_FRAME) / 4
                          )
                      })`,
                    }}
                  >
                    Choose files
                  </div>
                  <div style={{display: 'flex', gap: 12, minHeight: 40}}>
                    {FILE_NAMES.map((name, i) => {
                      const s = spring({
                        frame: frame - FILE_FRAMES[i],
                        fps,
                        config: {damping: 14, mass: 0.7},
                      });
                      return (
                        <div
                          key={name}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 999,
                            border: `1.5px solid ${colors.input}`,
                            background: colors.background,
                            color: colors.primaryDark,
                            fontSize: 17,
                            fontWeight: 700,
                            padding: '7px 16px',
                            opacity: s,
                            transform: `translateY(${(1 - s) * 18}px)`,
                          }}
                        >
                          <svg
                            width={15}
                            height={15}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          {name}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{marginTop: 22, display: 'grid', gap: 12}}>
                  {site.checklist.map((item, i) => {
                    const flipFrame = FILE_FRAMES[i] + 8;
                    const done = frame >= flipFrame;
                    const pop = spring({
                      frame: frame - flipFrame,
                      fps,
                      config: {damping: 11, mass: 0.6},
                    });
                    return (
                      <div
                        key={item}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          border: `1.5px ${done ? 'solid' : 'dashed'} ${colors.input}`,
                          borderRadius: 16,
                          padding: '13px 20px',
                          fontSize: 22,
                          color: done ? colors.foreground : colors.mutedForeground,
                          background: done ? colors.background : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 24,
                            color: done ? colors.primaryDark : colors.mutedForeground,
                            transform: done ? `scale(${0.6 + pop * 0.4})` : undefined,
                            display: 'inline-block',
                          }}
                        >
                          {done ? '✓' : '○'}
                        </span>
                        <span style={{fontWeight: done ? 650 : 500}}>{item}</span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 18,
                            fontWeight: 700,
                            color: done ? colors.success : colors.mutedForeground,
                          }}
                        >
                          {done ? 'Uploaded' : 'Still missing'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>

        <Cursor
          appearAt={16}
          waypoints={[
            {frame: 16, x: 1460, y: 980},
            {frame: CLICK_FRAME - 4, x: 985, y: 560},
            {frame: CLICK_FRAME + 14, x: 985, y: 560},
            {frame: CLICK_FRAME + 46, x: 1330, y: 800},
          ]}
          clickFrames={[CLICK_FRAME]}
        />
      </AbsoluteFill>
    </SceneFade>
  );
};
