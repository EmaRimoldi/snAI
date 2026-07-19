import React from 'react';
import {Composition} from 'remotion';
import {RealDoorDemo, TOTAL_DURATION} from './RealDoorDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RealDoorDemo"
      component={RealDoorDemo}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
