import React from 'react';
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { C, sans, serif, mono, FPS } from '../theme';

export const ease = Easing.bezier(0.33, 0, 0.15, 1);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0→1 over [start, start+len] frames with easing. */
export function useIn(start: number, len = 18) {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + len], [0, 1], { ...clamp, easing: ease });
}
export function usePop(start: number) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - start, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
}

/** Warm dark backdrop with slow drifting glows + fine grain. */
export const Backdrop: React.FC<{ glow?: string }> = ({ glow = C.coral }) => {
  const f = useCurrentFrame();
  const a = Math.sin(f / 140) * 80;
  const b = Math.cos(f / 170) * 60;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1400, height: 1400, left: -380 + a, top: -720 + b, borderRadius: '50%', background: `radial-gradient(circle, ${glow}33 0%, transparent 62%)` }} />
      <div style={{ position: 'absolute', width: 1200, height: 1200, right: -420 - b, bottom: -700 + a, borderRadius: '50%', background: `radial-gradient(circle, ${C.peach}1f 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)' }} />
    </AbsoluteFill>
  );
};

/** Browser-like frame around a capture. */
export const Window: React.FC<{ children: React.ReactNode; url?: string; style?: React.CSSProperties; radius?: number }> = ({ children, url, style, radius = 18 }) => (
  <div style={{ position: 'absolute', borderRadius: radius, overflow: 'hidden', background: '#fff', boxShadow: '0 40px 120px -30px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08)', ...style }}>
    <div style={{ height: 44, background: '#F1ECE6', display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', borderBottom: '1px solid #E2DAD0' }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />)}
      {url && <div style={{ marginLeft: 18, flex: 1, maxWidth: 760, height: 28, borderRadius: 8, background: '#fff', border: '1px solid #E2DAD0', fontFamily: sans, fontSize: 15, color: '#6B6560', display: 'flex', alignItems: 'center', padding: '0 12px' }}>{url}</div>}
    </div>
    <div style={{ position: 'absolute', inset: '44px 0 0 0', overflow: 'hidden', background: '#fff' }}>{children}</div>
  </div>
);

export type Key = { t: number; x: number; y: number; s: number };
/** Animated zoom/pan over media. Keys use frame times; x/y are the focus point (0..1). */
export const ZoomPan: React.FC<{ keys: Key[]; children: React.ReactNode }> = ({ keys, children }) => {
  const f = useCurrentFrame();
  const ts = keys.map((k) => k.t);
  const pick = (p: 'x' | 'y' | 's') => (keys.length === 1 ? keys[0][p] : interpolate(f, ts, keys.map((k) => k[p]), { ...clamp, easing: ease }));
  const s = pick('s');
  const x = pick('x');
  const y = pick('y');
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${(0.5 - x * s) * 100}%, ${(0.5 - y * s) * 100}%) scale(${s})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Highlight box + label, positioned in % of its container. */
export const Callout: React.FC<{ from: number; to: number; x: number; y: number; w: number; h: number; label?: string; side?: 'top' | 'bottom'; color?: string }> = ({ from, to, x, y, w, h, label, side = 'top', color = C.coral }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 10, to - 8, to], [0, 1, 1, 0], clamp);
  const sc = interpolate(f, [from, from + 14], [1.06, 1], { ...clamp, easing: ease });
  if (f < from || f > to) return null;
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, opacity: o, transform: `scale(${sc})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `4px solid ${color}`, boxShadow: `0 0 0 9999px rgba(10,8,6,${0.38 * o}), 0 0 40px ${color}88` }} />
      {label && (
        <div style={{ position: 'absolute', left: -4, [side === 'top' ? 'bottom' : 'top']: 'calc(100% + 12px)', background: color, color: '#fff', fontFamily: sans, fontWeight: 600, fontSize: 26, padding: '9px 16px', borderRadius: 10, whiteSpace: 'nowrap', boxShadow: '0 10px 30px rgba(0,0,0,.35)' } as React.CSSProperties}>{label}</div>
      )}
    </div>
  );
};

export type Seg = { from: number; to: number; rate?: number; fit?: boolean; badge?: string };
/** Plays pieces of a recording back-to-back. Segments with fit:true share whatever time is left. */
export const Clip: React.FC<{ src: string; segs: Seg[]; frames: number; start?: number; style?: React.CSSProperties }> = ({ src, segs, frames, start = 0, style }) => {
  const fixed = segs.filter((s) => !s.fit).reduce((n, s) => n + ((s.to - s.from) / (s.rate || 1)) * FPS, 0);
  const fitSrc = segs.filter((s) => s.fit).reduce((n, s) => n + (s.to - s.from) * FPS, 0);
  const fitRate = fitSrc ? Math.max(0.5, fitSrc / Math.max(1, frames - start - fixed)) : 1;
  let at = start;
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={style}>
      {segs.map((s, i) => {
        const rate = s.fit ? fitRate : s.rate || 1;
        const len = Math.max(1, Math.round(((s.to - s.from) * FPS) / rate));
        const from = at;
        at += len;
        const last = i === segs.length - 1;
        return (
          <Sequence key={i} from={from} durationInFrames={last ? Math.max(len, frames - from) : len} layout="none">
            <AbsoluteFill>
              <OffthreadVideo src={staticFile(src)} startFrom={Math.round(s.from * FPS)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </AbsoluteFill>
            {(s.badge || rate > 1.4) && f >= from && f < from + len && <SpeedBadge text={s.badge || `${rate.toFixed(rate >= 10 ? 0 : 1)}× speed`} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const SpeedBadge: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', right: 26, top: 22, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(20,18,16,.82)', color: '#fff', fontFamily: sans, fontWeight: 600, fontSize: 24, padding: '10px 16px', borderRadius: 999, backdropFilter: 'blur(6px)' }}>
    <span style={{ fontSize: 20 }}>⏩</span>{text}
  </div>
);

/** Pill label. */
export const Pill: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.coral, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: `${color}22`, border: `1.5px solid ${color}66`, color, fontFamily: sans, fontWeight: 600, fontSize: 24, ...style }}>{children}</span>
);

/** Floating annotation card (appears/disappears on a frame window). */
export const Note: React.FC<{ from: number; to: number; x: number; y: number; w?: number; title: string; body?: React.ReactNode; icon?: string; accent?: string }> = ({ from, to, x, y, w = 520, title, body, icon, accent = C.coral }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 12, to - 10, to], [0, 1, 1, 0], clamp);
  const ty = interpolate(f, [from, from + 16], [24, 0], { ...clamp, easing: ease });
  if (f < from || f > to) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: o, transform: `translateY(${ty}px)`, background: 'rgba(28,25,22,.92)', border: `1px solid ${C.line}`, borderLeft: `5px solid ${accent}`, borderRadius: 16, padding: '20px 24px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', backdropFilter: 'blur(10px)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontFamily: sans, fontWeight: 700, fontSize: 27, color: C.ink }}>{icon && <span>{icon}</span>}{title}</div>
      {body && <div style={{ marginTop: 8, fontFamily: sans, fontSize: 22, lineHeight: 1.45, color: C.ink2 }}>{body}</div>}
    </div>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => <span style={{ fontFamily: mono, ...style }}>{children}</span>;

export const Title: React.FC<{ kicker?: string; children: React.ReactNode; start?: number; style?: React.CSSProperties }> = ({ kicker, children, start = 0, style }) => {
  const a = useIn(start, 20);
  return (
    <div style={{ position: 'absolute', left: 120, top: 120, opacity: a, transform: `translateY(${(1 - a) * 20}px)`, ...style }}>
      {kicker && <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22, letterSpacing: '.18em', textTransform: 'uppercase', color: C.coral, marginBottom: 14 }}>{kicker}</div>}
      <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 64, lineHeight: 1.08, color: C.ink, letterSpacing: '-.02em' }}>{children}</div>
    </div>
  );
};

export const Shot: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', ...style }} />;
