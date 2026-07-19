import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {PillButton} from '../components/PillButton';
import {SceneFade} from '../components/SceneFade';
import {colors, fontFamily, site} from '../theme';

const AnimatedWords: React.FC<{
  text: string;
  startFrame: number;
  stagger?: number;
}> = ({text, startFrame, stagger = 4}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <span style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
      {words.map((word, i) => {
        const s = spring({
          frame: frame - startFrame - i * stagger,
          fps,
          config: {damping: 18, mass: 0.7},
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${(1 - s) * 34}px)`,
              marginRight: i < words.length - 1 ? '0.24em' : 0,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// Scene 2 — the landing hero: headline animates in word by word, the
// subheadline types itself like on the site, then the CTA and assurances.
export const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Typed subheadline with blinking block caret (site: `.is-typing`)
  const typeStart = 52;
  const charsShown = Math.max(
    0,
    Math.min(site.heroSub.length, Math.floor((frame - typeStart) / 2))
  );
  const typed = site.heroSub.slice(0, charsShown);
  const caretVisible = Math.floor(frame / 12) % 2 === 0;
  const doneTyping = charsShown >= site.heroSub.length;

  const buttonIn = spring({frame: frame - 96, fps, config: {damping: 13, mass: 0.8}});
  // Simulated hover: the button lifts and the arrow nudges right, like :hover on the site
  const hover = interpolate(frame, [136, 146], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const assuranceIn = (i: number) =>
    spring({frame: frame - 112 - i * 6, fps, config: {damping: 18}});

  return (
    <SceneFade fadeIn={8} fadeOut={12}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: '-0.045em',
            color: colors.foreground,
          }}
        >
          <AnimatedWords text={site.heroLine1} startFrame={6} />
          <br />
          <AnimatedWords text={site.heroLine2} startFrame={22} />
        </h1>

        <div
          style={{
            marginTop: 40,
            fontSize: 40,
            fontWeight: 550,
            letterSpacing: '-0.01em',
            color: colors.mutedForeground,
            minHeight: 56,
          }}
        >
          {typed}
          {frame >= typeStart ? (
            // Kept mounted while blinking via opacity — unmounting would change
            // the centered line's width and make the text jitter.
            <span
              style={{
                display: 'inline-block',
                width: 5,
                height: '0.9em',
                background: 'currentColor',
                marginLeft: 6,
                verticalAlign: '-0.08em',
                opacity: !doneTyping || caretVisible ? 1 : 0,
              }}
            />
          ) : null}
        </div>

        <div
          style={{
            marginTop: 52,
            opacity: buttonIn,
            transform: `scale(${interpolate(buttonIn, [0, 1], [0.7, 1])})`,
          }}
        >
          <PillButton fontSize={34} arrowNudge={hover * 6} lift={hover}>
            Get started
          </PillButton>
        </div>

        <div
          style={{
            marginTop: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            fontSize: 24,
            fontWeight: 520,
            color: colors.mutedForeground,
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
                    margin: '0 22px',
                    display: 'inline-block',
                    flex: 'none',
                  }}
                />
              ) : null}
              <span style={{opacity: assuranceIn(i)}}>{a}</span>
            </React.Fragment>
          ))}
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
