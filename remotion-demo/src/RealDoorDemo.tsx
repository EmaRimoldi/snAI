import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {GridBackground} from './components/GridBackground';
import {AppUnderstand} from './scenes/AppUnderstand';
import {AppUpload} from './scenes/AppUpload';
import {Hero} from './scenes/Hero';
import {Intro} from './scenes/Intro';
import {Outro} from './scenes/Outro';
import {Phases} from './scenes/Phases';
import {colors} from './theme';
import './load-fonts';

// 30 seconds @ 30 fps = 900 frames
//   0–4s   Intro (brand reveal)
//   4–11s  Hero (headline, typed subheadline, CTA)
//  11–16s  The three phases
//  16–22s  In-app: upload documents, checklist completes
//  22–27s  In-app: cited Q&A + readiness verdict
//  27–30s  Outro
export const SCENES = {
  intro: {from: 0, duration: 120},
  hero: {from: 120, duration: 210},
  phases: {from: 330, duration: 150},
  appUpload: {from: 480, duration: 180},
  appUnderstand: {from: 660, duration: 150},
  outro: {from: 810, duration: 90},
} as const;

export const TOTAL_DURATION = 900;

export const RealDoorDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <GridBackground />
      <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration}>
        <Intro />
      </Sequence>
      <Sequence from={SCENES.hero.from} durationInFrames={SCENES.hero.duration}>
        <Hero />
      </Sequence>
      <Sequence from={SCENES.phases.from} durationInFrames={SCENES.phases.duration}>
        <Phases />
      </Sequence>
      <Sequence from={SCENES.appUpload.from} durationInFrames={SCENES.appUpload.duration}>
        <AppUpload />
      </Sequence>
      <Sequence
        from={SCENES.appUnderstand.from}
        durationInFrames={SCENES.appUnderstand.duration}
      >
        <AppUnderstand />
      </Sequence>
      <Sequence from={SCENES.outro.from} durationInFrames={SCENES.outro.duration}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
