// Scene timing. With recorded narration (public/voice/manifest.json) each scene
// lasts exactly as long as its voice take plus a little air; without it, the
// duration is estimated from word count so the preview paces like a real read.
import script from './script.json';
import { FPS } from './theme';

export type Scene = (typeof script.scenes)[number];
export type VoiceTake = { file: string; duration: number };
export type Manifest = Record<string, VoiceTake>;
export type Align = Record<string, { words: number[]; end: number }>;
export type SceneTiming = { scene: Scene; frames: number; lead: number; voice: VoiceTake | null; wordTimes: number[] | null };

export const LEAD = 0.8; // seconds of picture before the voice starts
export const TAIL = 1.3; // seconds after the voice ends
export const TRANSITION = 14; // frames of crossfade between scenes
const WPS = 2.45; // ~147 wpm, a calm presenter pace

export const words = (t: string) => t.trim().split(/\s+/).length;

export function sceneTimings(manifest: Manifest | null, align: Align | null = null): SceneTiming[] {
  return script.scenes.map((scene) => {
    const voice = manifest?.[scene.id] ?? null;
    const speech = voice ? voice.duration : words(scene.text) / WPS;
    // `hold`: extra seconds where the viewer should take in the picture (live run, live post, end card).
    const seconds = Math.max(scene.min, LEAD + speech + TAIL + ((scene as { hold?: number }).hold ?? 0));
    const wt = voice && align?.[scene.id]?.words?.length === scene.text.split(/\s+/).length ? align[scene.id].words : null;
    return { scene, voice, lead: LEAD, wordTimes: wt, frames: Math.round(seconds * FPS) + TRANSITION };
  });
}

export const totalFrames = (t: SceneTiming[]) => t.reduce((s, x) => s + x.frames, 0) - TRANSITION * (t.length - 1);
