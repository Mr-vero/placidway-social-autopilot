import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import script from '../script.json';
import { C, sans, FPS } from '../theme';
import { clamp, ease } from './kit';
import type { SceneTiming } from '../timing';

/** Splits narration into caption chunks (sentence-ish, ≤ 13 words). */
function chunks(text: string) {
  // Sentences → clauses (split at commas/colons) → packed into ≤ 14-word caption cards.
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const out: string[] = [];
  for (const s of sentences) {
    const clauses = s.trim().split(/(?<=[,:;])\s+/);
    let cur: string[] = [];
    for (const c of clauses) {
      const w = c.split(/\s+/);
      if (cur.length && cur.length + w.length > 14) { out.push(cur.join(' ')); cur = []; }
      if (w.length > 14) { for (let i = 0; i < w.length; i += 12) out.push(w.slice(i, i + 12).join(' ')); }
      else cur.push(...w);
    }
    if (cur.length) out.push(cur.join(' '));
  }
  return out.filter(Boolean);
}

/** Captions timed across the speech window, proportional to characters. */
const Captions: React.FC<{ t: SceneTiming }> = ({ t }) => {
  const f = useCurrentFrame();
  const startF = t.lead * FPS;
  const speechF = t.voice ? t.voice.duration * FPS : t.frames - startF - 0.9 * FPS - 14;
  const cs = chunks(t.scene.text);
  const total = cs.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  const spans = cs.map((c) => { const a = startF + (acc / total) * speechF; acc += c.length; return { c, a, b: startF + (acc / total) * speechF }; });
  const cur = spans.find((s) => f >= s.a && f < s.b);
  if (!cur) return null;
  const o = interpolate(f, [cur.a, cur.a + 5, cur.b - 4, cur.b], [0, 1, 1, 0.0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 46, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ maxWidth: 1380, textAlign: 'center', fontFamily: sans, fontWeight: 600, fontSize: 36, lineHeight: 1.3, color: '#fff', background: 'rgba(14,12,10,.78)', padding: '12px 26px', borderRadius: 14, opacity: o, textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{cur.c}</div>
    </div>
  );
};

/** Top chapter rail: 12 segments, current one filling. */
const ChapterRail: React.FC<{ index: number; frames: number }> = ({ index, frames }) => {
  const f = useCurrentFrame();
  const n = script.scenes.length;
  const p = interpolate(f, [0, frames], [0, 1], clamp);
  const label = script.scenes[index].chapter;
  const a = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: ease });
  return (
    <>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 44, display: 'flex', gap: 8 }}>
        {script.scenes.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${i < index ? 100 : i === index ? p * 100 : 0}%`, background: i === index ? C.coral : 'rgba(255,255,255,.45)' }} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 120, top: 62, opacity: a, fontFamily: sans, fontWeight: 600, fontSize: 19, letterSpacing: '.14em', textTransform: 'uppercase', color: C.ink3 }}>
        <span style={{ color: C.coral }}>{String(index + 1).padStart(2, '0')}</span>&nbsp;/&nbsp;{String(n).padStart(2, '0')}&nbsp;&nbsp;·&nbsp;&nbsp;{label}
      </div>
    </>
  );
};

export const SceneShell: React.FC<{ t: SceneTiming; index: number; captions: boolean; rail?: boolean; children: React.ReactNode }> = ({ t, index, captions, rail = true, children }) => (
  <AbsoluteFill>
    {children}
    {rail && <ChapterRail index={index} frames={t.frames} />}
    {captions && <Captions t={t} />}
    {t.voice && (
      <Sequence from={Math.round(t.lead * FPS)} layout="none">
        <Audio src={staticFile(`voice/${t.voice.file}`)} volume={1} />
      </Sequence>
    )}
  </AbsoluteFill>
);
