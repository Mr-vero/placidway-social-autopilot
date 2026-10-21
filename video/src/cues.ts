import { FPS } from './theme';
import { TRANSITION, type SceneTiming } from './timing';
import type { Seg } from './components/kit';

/** Frame at which a phrase is (approximately) spoken: proportional to character position. */
export function cue(t: SceneTiming, phrase: string, offsetSec = 0) {
  const i = t.scene.text.indexOf(phrase);
  if (i < 0) throw new Error(`cue phrase not found in ${t.scene.id}: "${phrase}"`);
  const start = t.lead * FPS;
  if (t.wordTimes) {
    // Exact: the recorded time of the phrase's first word (from the forced alignment).
    const wi = t.scene.text.slice(0, i).split(/\s+/).filter(Boolean).length;
    return Math.round(start + (t.wordTimes[Math.min(wi, t.wordTimes.length - 1)] + offsetSec) * FPS);
  }
  const speech = t.voice ? t.voice.duration * FPS : t.frames - start - 0.9 * FPS - TRANSITION;
  return Math.round(start + (i / t.scene.text.length) * speech + offsetSec * FPS);
}

/** Maps a time in a source recording (seconds) to a frame in a <Clip> with the same segments. */
export function segMap(segs: Seg[], frames: number, start = 0) {
  const fixed = segs.filter((s) => !s.fit).reduce((n, s) => n + ((s.to - s.from) / (s.rate || 1)) * FPS, 0);
  const fitSrc = segs.filter((s) => s.fit).reduce((n, s) => n + (s.to - s.from) * FPS, 0);
  const fitRate = fitSrc ? Math.max(0.5, fitSrc / Math.max(1, frames - start - fixed)) : 1;
  return (sec: number) => {
    let at = start;
    for (const s of segs) {
      const rate = s.fit ? fitRate : s.rate || 1;
      const len = ((s.to - s.from) * FPS) / rate;
      if (sec <= s.to) return Math.round(at + (Math.max(0, sec - s.from) * FPS) / rate);
      at += len;
    }
    return Math.round(at);
  };
}
