import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { SCENES } from './scenes';
import { SceneShell } from './components/shell';
import { TRANSITION, type SceneTiming } from './timing';
import { C } from './theme';

export type DemoProps = { captions: boolean; timings: SceneTiming[] };

export const Demo: React.FC<DemoProps> = ({ captions, timings }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <TransitionSeries>
      {timings.flatMap((t, i) => {
        const Scene = SCENES[t.scene.id];
        const seq = (
          <TransitionSeries.Sequence key={t.scene.id} durationInFrames={t.frames}>
            <SceneShell t={t} index={i} captions={captions} rail={i !== 0 && i !== timings.length - 1}>
              <Scene t={t} />
            </SceneShell>
          </TransitionSeries.Sequence>
        );
        return i === 0 ? [seq] : [<TransitionSeries.Transition key={`tr-${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />, seq];
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
