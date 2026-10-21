import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Demo, type DemoProps } from './Demo';
import { sceneTimings, totalFrames, type Manifest } from './timing';
import { FPS, W, H } from './theme';

async function loadJson(name: string) {
  try { const r = await fetch(staticFile(`voice/${name}`)); return r.ok ? await r.json() : null; } catch { return null; }
}

async function loadManifest(): Promise<Manifest | null> {
  try {
    const r = await fetch(staticFile('voice/manifest.json'));
    if (!r.ok) return null;
    const m = await r.json();
    return Object.keys(m).length ? m : null;
  } catch {
    return null;
  }
}

export const Root: React.FC = () => (
  <Composition
    id="Demo"
    component={Demo}
    fps={FPS}
    width={W}
    height={H}
    durationInFrames={FPS * 60}
    defaultProps={{ captions: true, timings: [] } as DemoProps}
    calculateMetadata={async ({ props }) => {
      const timings = sceneTimings(await loadManifest(), await loadJson('align.json'));
      return { durationInFrames: totalFrames(timings), props: { ...props, timings } };
    }}
  />
);
