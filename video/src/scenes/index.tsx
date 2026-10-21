import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { C, sans, serif, mono, FPS } from '../theme';
import { Backdrop, Window, ZoomPan, Clip, Note, Pill, Title, Shot, useIn, usePop, clamp, ease, type Seg } from '../components/kit';
import { cue, segMap } from '../cues';
import type { SceneTiming } from '../timing';
import data from '../data.json';
import tests from '../tests.json';

type P = { t: SceneTiming };
// Main stage: a 16:9 browser window centred under the chapter rail.
const STAGE: React.CSSProperties = { left: 200, top: 108, width: 1520, height: 899 };
const REPO = 'github.com/Mr-vero/placidway-social-autopilot';

const LogoMark: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, background: `radial-gradient(120% 120% at 20% 10%, ${C.coral2} 0%, ${C.coral} 45%, ${C.red} 100%)`, display: 'grid', placeItems: 'center', boxShadow: `0 20px 60px -10px ${C.coral}aa` }}>
    <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M6 20V4h7a5 5 0 010 10H6" /></svg>
  </div>
);

// ───────────────────────────── 01 Intro
export const S01: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const a = useIn(6, 26);
  const b = useIn(22, 24);
  const c = useIn(40, 24);
  const live = cue(t, 'run it live');
  const drift = interpolate(f, [0, t.frames], [0, -60]);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ opacity: 0.22, filter: 'blur(1.5px) saturate(.9)' }}>
        <Img src={staticFile('captures/canvas-pipeline-done.png')} style={{ position: 'absolute', width: 1300, left: -120 + drift, top: 520, transform: 'rotate(-6deg)', borderRadius: 18 }} />
        <Img src={staticFile('captures/fb-post.jpg')} style={{ position: 'absolute', width: 520, right: 60 - drift, top: 80, transform: 'rotate(5deg)', borderRadius: 18 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(20,18,16,.2) 0%, rgba(20,18,16,.92) 70%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <div style={{ opacity: a, transform: `scale(${0.9 + a * 0.1})` }}><LogoMark size={110} /></div>
        <div style={{ marginTop: 40, fontFamily: serif, fontWeight: 500, fontSize: 110, letterSpacing: '-.025em', color: C.ink, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
          PlacidWay <em style={{ color: C.coral, fontStyle: 'italic' }}>Social Autopilot</em>
        </div>
        <div style={{ marginTop: 18, fontFamily: sans, fontSize: 34, color: C.ink2, opacity: b }}>One on-brand, fact-checked Facebook post a day: n8n · Claude · Facebook Graph API</div>
        <div style={{ marginTop: 44, fontFamily: sans, fontWeight: 600, fontSize: 24, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, opacity: c }}>AI Automation Candidate Assessment &nbsp;·&nbsp; Irvan Fahlepi</div>
        <div style={{ marginTop: 46, display: 'flex', gap: 16, opacity: useIn(live, 18) }}>
          <Pill color={C.coral}>● Live run</Pill><Pill color={C.peach}>Real PlacidWay pages</Pill><Pill color={C.green}>Real post on a test Page</Pill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 02 Architecture
const Box: React.FC<{ x: number; y: number; w: number; h: number; at: number; title: string; sub?: string; icon: string; accent?: string; children?: React.ReactNode }> = ({ x, y, w, h, at, title, sub, icon, accent = C.coral, children }) => {
  const p = usePop(at);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, p * 1.4), transform: `scale(${0.85 + 0.15 * p})`, background: 'rgba(34,30,26,.92)', border: `1.5px solid ${accent}55`, borderRadius: 22, padding: '22px 26px', boxShadow: `0 30px 70px -25px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${accent}22`, display: 'grid', placeItems: 'center', fontSize: 28 }}>{icon}</div>
        <div><div style={{ fontFamily: sans, fontWeight: 700, fontSize: 28, color: C.ink }}>{title}</div>{sub && <div style={{ fontFamily: sans, fontSize: 20, color: C.ink3, marginTop: 2 }}>{sub}</div>}</div>
      </div>
      {children}
    </div>
  );
};
const Wire: React.FC<{ d: string; at: number; color?: string }> = ({ d, at, color = C.coral }) => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [at, at + 22], [0, 1], { ...clamp, easing: ease });
  return (
    <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width="1920" height="1080">
      <path d={d} fill="none" stroke={`${color}40`} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
      {draw >= 1 && <path d={d} fill="none" stroke={color} strokeWidth={3} strokeDasharray="10 18" strokeDashoffset={-f * 1.6} opacity={0.9} />}
    </svg>
  );
};
export const S02: React.FC<P> = ({ t }) => {
  const n8n = cue(t, 'n8n runs');
  const chips = ['daily pipeline', 'publish sub-workflow', 'small API', 'engagement read-back', 'error handler'].map((p) => cue(t, p));
  const labels = ['1 · Daily Post Pipeline', '2 · Publish Post', '3 · Dashboard API', '4 · Engagement Read-back', '5 · Error Handler'];
  const pg = cue(t, 'Postgres');
  const claude = cue(t, 'Claude');
  const fb = cue(t, 'Facebook Graph API');
  const pw = Math.max(10, n8n - 20);
  const dash = cue(t, 'review dashboard');
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Title kicker="Architecture" start={4} style={{ top: 100 }}>Five workflows, one memory, two AI roles.</Title>
      <Box x={120} y={380} w={360} h={170} at={pw} icon="🌐" title="placidway.com" sub="public sitemaps + pages" accent={C.peach} />
      <Box x={120} y={640} w={360} h={170} at={dash} icon="🧑‍⚕️" title="Review dashboard" sub="approve · edit · reject" accent={C.blue} />
      <Box x={620} y={290} w={640} h={480} at={n8n} icon="⚙️" title="n8n (Docker)" sub="the automation" accent={C.coral}>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {labels.map((l, i) => {
            const p = interpolate(f, [chips[i], chips[i] + 14], [0, 1], { ...clamp, easing: ease });
            return <div key={l} style={{ opacity: p, transform: `translateX(${(1 - p) * -20}px)`, fontFamily: sans, fontWeight: 600, fontSize: 25, color: C.ink, background: 'rgba(255,255,255,.05)', border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 18px', display: 'flex', justifyContent: 'space-between' }}><span>{l}</span>{i === 4 && <span style={{ color: C.coral, fontSize: 20 }}>never silent</span>}</div>;
          })}
        </div>
      </Box>
      <Box x={680} y={790} w={520} h={110} at={pg} icon="🐘" title="Postgres" sub="used URLs · drafts · runs · alerts" accent={C.green} />
      <Box x={1400} y={300} w={400} h={200} at={claude} icon="✳️" title="Claude (CLI)" sub="Sonnet writes · Haiku reviews" accent={C.peach} />
      <Box x={1400} y={600} w={400} h={200} at={fb} icon="📣" title="Facebook Page" sub="Graph API v26 · test Page" accent={C.blue} />
      <Wire d="M480 465 C 550 465, 560 470, 620 470" at={n8n + 10} color={C.peach} />
      <Wire d="M480 725 C 550 725, 560 700, 620 700" at={dash + 8} color={C.blue} />
      <Wire d="M940 770 L 940 790" at={pg + 6} color={C.green} />
      <Wire d="M1260 390 C 1320 390, 1340 400, 1400 400" at={claude + 8} color={C.peach} />
      <Wire d="M1260 700 C 1320 700, 1340 700, 1400 700" at={fb + 8} color={C.blue} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 03 Brief → implementation
export const S03: React.FC<P> = ({ t }) => {
  const rows: [string, string, string][] = [
    ['Trigger', 'Daily 07:00 schedule · manual · dashboard “Run now”', 'daily schedule'],
    ['Extract', 'Public sitemaps + the page’s own JSON-LD', 'sitemap extraction'],
    ['Select', 'Postgres UNIQUE(source_url): never the same page twice', 'never-twice'],
    ['Generate', 'Structured output (hook · lines · CTA · tags) + code assembly', 'structured generation'],
    ['Guardrails', 'Deterministic rules + an independent AI reviewer', 'two layers'],
    ['Publish', 'Graph API v26 with the branded image (immediate or scheduled)', 'two layers'],
    ['Review option', 'publish_mode: approval ⇄ auto (one switch)', 'approval switch'],
    ['Logging & errors', 'Run log · retries · alerts · error workflow', 'logging'],
  ];
  return (
    <AbsoluteFill>
      <Backdrop glow={C.peach} />
      <Title kicker="The brief" start={4}>Every requirement, mapped.</Title>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 330, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {rows.map(([req, impl, phrase], i) => {
          const at = cue(t, phrase) + (i === 5 ? 12 : 0);
          return <Req key={req} at={at} n={i + 1} req={req} impl={impl} />;
        })}
      </div>
    </AbsoluteFill>
  );
};
const Req: React.FC<{ at: number; n: number; req: string; impl: string }> = ({ at, n, req, impl }) => {
  const p = usePop(at);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'rgba(34,30,26,.9)', border: `1px solid ${p > 0.5 ? C.green + '55' : C.line}`, borderRadius: 18, padding: '20px 24px', opacity: 0.32 + 0.68 * Math.min(1, p * 1.5), transform: `translateY(${(1 - Math.min(1, p)) * 6}px)` }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: p > 0.6 ? C.green : 'rgba(255,255,255,.08)', color: '#fff', fontSize: 28, fontWeight: 700, transform: `scale(${0.6 + 0.4 * p})` }}>✓</div>
      <div><div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, color: C.ink }}><span style={{ color: C.ink3, marginRight: 10 }}>{n}.</span>{req}</div><div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 4 }}>{impl}</div></div>
    </div>
  );
};

// ───────────────────────────── 04 Canvas tour
export const S04: React.FC<P> = ({ t }) => {
  const sel = cue(t, 'Select reads');
  const ext = cue(t, 'Extract claims');
  const gen = cue(t, 'Then generate');
  const img = cue(t, 'image, and');
  const end = t.frames - 20;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window url="localhost:5678 · PW · 1 · Daily Post Pipeline" style={STAGE}>
        <ZoomPan keys={[
          { t: 0, x: 0.5, y: 0.5, s: 1 }, { t: sel - 10, x: 0.5, y: 0.5, s: 1 },
          { t: sel + 14, x: 0.37, y: 0.36, s: 1.75 }, { t: ext - 8, x: 0.37, y: 0.36, s: 1.75 },
          { t: ext + 16, x: 0.74, y: 0.36, s: 1.9 }, { t: gen - 8, x: 0.74, y: 0.36, s: 1.9 },
          { t: gen + 16, x: 0.47, y: 0.56, s: 1.45 }, { t: img - 6, x: 0.47, y: 0.56, s: 1.45 },
          { t: img + 16, x: 0.5, y: 0.78, s: 1.45 }, { t: end - 30, x: 0.5, y: 0.78, s: 1.45 }, { t: end, x: 0.5, y: 0.5, s: 1 },
        ]}>
          <Shot src="captures/canvas-pipeline.png" />
        </ZoomPan>
      </Window>
      <Note from={sel + 16} to={ext} x={1180} y={760} w={560} icon="🌐" title="4 requests · 1.1 s apart" body="Sitemaps are what robots.txt invites crawlers to use: 5 requests a day in total, ≤ 1 per second." accent={C.peach} />
      <Note from={ext + 18} to={gen} x={240} y={760} w={600} icon="🔒" title="Claim first: UNIQUE(source_url)" body="The database refuses a second post for any URL, even if two runs race." accent={C.green} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 05 Live run (real execution, speed-ramped through the LLM waits)
const LIVE_SEGS: Seg[] = [
  { from: 0.6, to: 11.6, rate: 1 },
  { from: 11.6, to: 55.2, fit: true, badge: 'Claude Sonnet is writing · sped up' },
  { from: 55.2, to: 77.6, fit: true, badge: 'Claude Haiku is fact-checking · sped up' },
  { from: 77.6, to: 79.8, rate: 1 },
];
export const S05: React.FC<P> = ({ t }) => {
  const at = segMap(LIVE_SEGS, t.frames, 0);
  const picked = cue(t, 'It picked');
  const extract = cue(t, 'Extraction reads');
  const writes = cue(t, 'Then Claude writes');
  const quote = cue(t, 'plus a verbatim quote');
  const assemble = cue(t, 'Code assembles');
  const p = data.post;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window url="localhost:5678 · live execution · Manual Run" style={STAGE}>
        <ZoomPan keys={[
          { t: 0, x: 0.5, y: 0.5, s: 1 }, { t: at(4.4), x: 0.5, y: 0.5, s: 1 },
          { t: at(6.5), x: 0.42, y: 0.37, s: 1.9 }, { t: at(11), x: 0.62, y: 0.37, s: 1.9 },
          { t: at(14), x: 0.36, y: 0.56, s: 2.1 }, { t: at(54), x: 0.36, y: 0.56, s: 2.1 },
          { t: at(57), x: 0.52, y: 0.56, s: 2.1 }, { t: at(76.5), x: 0.56, y: 0.56, s: 2.1 },
          { t: at(78.6), x: 0.5, y: 0.6, s: 1.15 },
        ]}>
          <Clip src="captures/n8n-live.mp4" segs={LIVE_SEGS} frames={t.frames} />
        </ZoomPan>
      </Window>
      <Note from={at(3.8)} to={at(9)} x={260} y={820} w={520} icon="▶" title="Execute · Manual Run" body="A real run: real PlacidWay pages, real Claude calls." />
      <Note from={Math.max(at(9.2), picked - 6)} to={extract - 4} x={1110} y={700} w={620} icon="🎯" title={p.title.replace(/ \| .*/, '')} body={<>“{data.selection.reason}”</>} accent={C.peach} />
      <Note from={extract} to={writes - 4} x={1110} y={700} w={620} icon="🧾" title={`Extracted via ${data.extracted_via}`} body={<>Body text · listed price <b style={{ color: C.ink }}>USD 750</b> · FAQ · category, straight from the page’s structured data.</>} accent={C.green} />
      <Note from={writes} to={assemble - 4} x={1110} y={640} w={620} icon="✳️" title="Structured output, not free text" body={<>hook · 2–4 lines · CTA · hashtags<br />+ <b style={{ color: C.peach }}>claims[]</b>: a verbatim source quote per line{quote ? '' : ''}</>} accent={C.peach} />
      <Note from={assemble} to={t.frames - 6} x={1080} y={430} w={660} icon="🧩" title="Assembled by code" body={<span style={{ fontFamily: mono, fontSize: 18, whiteSpace: 'pre-wrap', color: C.ink }}>{p.text.split('👉')[0].trim()}</span>} accent={C.coral} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 06 Guardrails
const RULE_LABEL: Record<string, string> = {
  structure: 'Hook · 2–4 lines · CTA', length: '< 500 chars before link', hashtags: '3–5 valid hashtags', link: 'Links the exact source',
  medical_claims: 'No cure / guarantee / “proven”', superlatives: 'No unsupported superlatives', numbers: 'Every number is in the source',
  prices: 'No invented prices', grounding: 'Every quote exists on the page',
};
export const S06: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const r0 = cue(t, 'First, deterministic');
  const r1 = cue(t, 'Second, a separate');
  const fail = cue(t, 'If either one fails');
  const human = cue(t, 'After three tries');
  const rules = data.rules;
  const step = (r1 - r0 - 10) / rules.length;
  const panel = (at: number) => ({ opacity: interpolate(f, [at, at + 16], [0, 1], clamp), transform: `translateY(${interpolate(f, [at, at + 16], [20, 0], { ...clamp, easing: ease })}px)` });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Title kicker="Guardrails" start={4}>Two independent layers.<br /><span style={{ color: C.ink3 }}>Fail closed.</span></Title>
      <div style={{ position: 'absolute', left: 120, top: 390, width: 820, ...panel(r0 - 10) }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: '.12em', textTransform: 'uppercase', color: C.peach, marginBottom: 16 }}>Layer 1 · Deterministic rules (code)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {rules.map((r, i) => {
            const on = f >= r0 + i * step;
            return (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: on ? 'rgba(92,192,146,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${on ? C.green + '66' : C.line}`, transition: 'none' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? C.green : 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 18 }}>{on ? '✓' : ''}</span>
                <span style={{ fontFamily: sans, fontSize: 22, color: on ? C.ink : C.ink3, fontWeight: 600 }}>{RULE_LABEL[r.id] || r.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1010, top: 390, width: 790, ...panel(r1) }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: '.12em', textTransform: 'uppercase', color: C.blue, marginBottom: 16 }}>Layer 2 · Independent reviewer</div>
        <div style={{ background: 'rgba(34,30,26,.92)', border: `1px solid ${C.line}`, borderRadius: 18, padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, color: C.ink }}>✳️ Claude Haiku · compliance audit</span>
            <Pill color={C.green} style={{ fontSize: 20, padding: '6px 14px' }}>verdict: {data.llm.verdict}</Pill>
          </div>
          <div style={{ marginTop: 14, fontFamily: sans, fontSize: 21, lineHeight: 1.5, color: C.ink2 }}>“{String(data.llm.summary).slice(0, 260)}{String(data.llm.summary).length > 260 ? '…' : ''}”</div>
          <div style={{ marginTop: 14, fontFamily: sans, fontSize: 19, color: C.ink3 }}>Flags: medical claims · unsupported facts · invented prices (high) · misleading framing (medium)</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 840, display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ ...panel(fail), display: 'flex', gap: 14, alignItems: 'center' }}>
          <Pill color={C.green}>pass → review queue / auto-publish</Pill>
          <Pill color={C.amber}>fail → rewrite with the exact findings ⟲</Pill>
        </div>
        <div style={{ ...panel(human) }}><Pill color={C.coral}>3 failed attempts → human review · never auto-publishes</Pill></div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 07 Human review (dashboard)
export const S07: React.FC<P> = ({ t }) => {
  const prev = cue(t, 'On the left');
  const guard = cue(t, 'On the right');
  const edit = cue(t, 'If I edit');
  const server = cue(t, 'The server re-checks');
  return (
    <AbsoluteFill>
      <Backdrop glow={C.blue} />
      <Window url="localhost:8080 · PlacidWay Autopilot · review queue" style={STAGE}>
        <ZoomPan keys={[
          { t: 0, x: 0.5, y: 0.5, s: 1 }, { t: prev - 6, x: 0.5, y: 0.5, s: 1 },
          { t: prev + 12, x: 0.42, y: 0.55, s: 1.38 }, { t: guard - 4, x: 0.42, y: 0.55, s: 1.38 },
          { t: guard + 14, x: 0.68, y: 0.52, s: 1.38 }, { t: edit - 4, x: 0.68, y: 0.52, s: 1.38 },
          { t: edit + 14, x: 0.55, y: 0.5, s: 1.3 }, { t: t.frames - 30, x: 0.55, y: 0.5, s: 1.3 }, { t: t.frames - 4, x: 0.5, y: 0.5, s: 1.05 },
        ]}>
          {/* Footage locked to the narration: queue+preview → guardrail report/grounding → the blocked edit. */}
          <Sequence from={0} durationInFrames={guard} layout="none">
            <Clip src="captures/dash-review.mp4" segs={[{ from: 0.6, to: 8.0, fit: true }]} frames={guard} />
          </Sequence>
          <Sequence from={guard} durationInFrames={edit - guard} layout="none">
            <Clip src="captures/dash-review.mp4" segs={[{ from: 8.0, to: 28.4, fit: true }]} frames={edit - guard} />
          </Sequence>
          <Sequence from={edit} layout="none">
            <Clip src="captures/dash-review.mp4" segs={[{ from: 28.4, to: 42.6, fit: true }]} frames={t.frames - edit} />
          </Sequence>
        </ZoomPan>
      </Window>
      <Note from={prev} to={guard - 4} x={1240} y={820} w={520} icon="👁" title="Exactly what Facebook will show" body="Post text, link and the branded image." accent={C.blue} />
      <Note from={guard} to={edit - 4} x={1240} y={780} w={520} icon="🛡" title="Guardrail report + grounding" body="9/9 rules · AI verdict · hover a claim to light up its source quote." accent={C.green} />
      <Note from={edit + 10} to={server} x={1240} y={800} w={520} icon="⛔" title="Edits get the same rules, live" body="“Guaranteed results” → rule fails → Approve disabled." accent={C.coral} />
      <Note from={server} to={t.frames - 6} x={1240} y={800} w={520} icon="🔐" title="Server re-checks too" body={<>Bypass the UI and the API answers <b style={{ color: C.ink }}>HTTP 422</b>.</>} accent={C.coral} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 08 Publish → live on Facebook
export const S08: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const approve = cue(t, "I'll approve");
  const live = cue(t, 'here it is');
  const fbIn = interpolate(f, [live - 14, live + 10], [0, 1], { ...clamp, easing: ease });
  const clipFrames = Math.max(60, live);
  return (
    <AbsoluteFill>
      <Backdrop glow={C.green} />
      <div style={{ opacity: 1 - fbIn * 0.85, transform: `scale(${1 - fbIn * 0.06})`, transformOrigin: '30% 50%' }}>
        <Window url="localhost:8080 · approve & publish" style={STAGE}>
          <Sequence from={0} durationInFrames={approve} layout="none">
            <Clip src="captures/dash-tour.mp4" segs={[{ from: 16.2, to: 26, fit: true }]} frames={approve} />
          </Sequence>
          <Sequence from={approve} layout="none">
            <Clip src="captures/dash-review.mp4" segs={[{ from: 42.3, to: 53.5, fit: true }]} frames={Math.max(30, clipFrames - approve)} />
          </Sequence>
        </Window>
      </div>
      <div style={{ position: 'absolute', left: 1030, top: 120, width: 700, opacity: fbIn, transform: `translateY(${(1 - fbIn) * 40}px) rotate(${(1 - fbIn) * 2}deg)` }}>
        <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 120px -30px rgba(0,0,0,.85)', border: '1px solid rgba(255,255,255,.1)' }}>
          <Img src={staticFile('captures/fb-post.jpg')} style={{ width: '100%', display: 'block' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 160, top: 300, width: 800, opacity: fbIn }}>
        <Pill color={C.green} style={{ fontSize: 26 }}>● LIVE on the test Page</Pill>
        <div style={{ marginTop: 26, fontFamily: serif, fontSize: 60, lineHeight: 1.1, color: C.ink, letterSpacing: '-.02em' }}>Published through<br />the Graph API.</div>
        <div style={{ marginTop: 26, fontFamily: mono, fontSize: 22, lineHeight: 1.7, color: C.ink2 }}>
          POST /{'{page}'}/photos <span style={{ color: C.ink3 }}>published=false</span><br />
          POST /{'{page}'}/feed <span style={{ color: C.ink3 }}>attached_media=[photo]</span><br />
          <span style={{ color: C.peach }}>post id {data.post.fb_post_id}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 09 Logging & failures
export const S09: React.FC<P> = ({ t }) => {
  const silent = cue(t, 'And nothing fails');
  const site = cue(t, 'PlacidWay unreachable');
  const llm = cue(t, 'the language model down');
  const tok = cue(t, 'an invalid Facebook token');
  const release = cue(t, 'A failed draft');
  return (
    <AbsoluteFill>
      <Backdrop glow={C.red} />
      <Window url="localhost:8080 · run log & alerts" style={STAGE}>
        <ZoomPan keys={[{ t: 0, x: 0.5, y: 0.5, s: 1 }, { t: 30, x: 0.4, y: 0.5, s: 1.22 }, { t: silent - 10, x: 0.4, y: 0.55, s: 1.22 }, { t: silent + 10, x: 0.42, y: 0.35, s: 1.18 }, { t: t.frames - 10, x: 0.42, y: 0.45, s: 1.18 }]}>
        <Sequence from={0} durationInFrames={silent} layout="none">
          <Clip src="captures/dash-tour.mp4" segs={[{ from: 6.6, to: 16, fit: true }]} frames={silent} />
        </Sequence>
        <Sequence from={silent} layout="none">
          <Clip src="captures/dash-failures.mp4" segs={[{ from: 0.6, to: 33.2, fit: true }]} frames={t.frames - silent} />
        </Sequence>
        </ZoomPan>
      </Window>
      <Note from={12} to={silent - 4} x={1220} y={780} w={540} icon="🧾" title="Every run, logged" body="Item chosen · final post text · Facebook post id · status · selection reason." accent={C.peach} />
      <Note from={site} to={release + 30} x={1220} y={430} w={540} icon="🌐" title="PlacidWay unreachable" body="3 retries → run marked error → alert with hint" accent={C.coral} />
      <Note from={llm} to={release + 30} x={1220} y={590} w={540} icon="✳️" title="LLM down" body="Alert · half-drafted URL released for the next run" accent={C.coral} />
      <Note from={tok} to={release + 30} x={1220} y={750} w={540} icon="🔑" title="Invalid token (code 190)" body="Classified → “regenerate the Page token” → one-click Retry" accent={C.coral} />
    </AbsoluteFill>
  );
};

// ───────────────────────────── 10 Stretch goals
export const S10: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const items: [string, string, string, string][] = [
    ['rotation', '📅', 'Variety rules', 'Weekday content-type rotation + category cool-down'],
    ['smart-cropped', '🖼', 'Branded images', 'Smart crop + brand bar, or a rendered title card'],
    ['native Facebook scheduling', '⏰', 'Native scheduling', 'post_time “18:30” → scheduled_publish_time'],
    ['Instagram', '📸', 'Instagram path', 'Built; needs an IG Business account linked to the Page'],
    ['this dashboard', '🧭', 'Dashboard', 'Queue · posts · run log · settings · alerts'],
    ['engagement read-back', '📈', 'Engagement read-back', 'Reactions · clicks · views snapshots every 6 h'],
  ];
  const imgAt = cue(t, 'smart-cropped');
  const swap = interpolate(f, [imgAt + 20, imgAt + 50], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Backdrop glow={C.peach} />
      <Title kicker="Stretch goals" start={4}>All five, plus a few extras.</Title>
      <div style={{ position: 'absolute', left: 120, top: 330, width: 900, height: 473, borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 100px -30px rgba(0,0,0,.8)', opacity: useIn(6, 18) }}>
        <Img src={staticFile('captures/original-post-9.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - swap * 100}% 0 0)` }}>
          <Img src={staticFile('captures/branded-post-9.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${swap * 100}%`, width: 4, background: C.coral, opacity: swap > 0 && swap < 1 ? 1 : 0 }} />
        <div style={{ position: 'absolute', left: 18, top: 16 }}><Pill color="#fff" style={{ background: 'rgba(0,0,0,.55)', fontSize: 20 }}>{swap < 0.5 ? 'PlacidWay OG image (padded)' : 'Pipeline output: cover crop + brand bar'}</Pill></div>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 830, width: 900, display: 'flex', gap: 16, alignItems: 'center', opacity: useIn(imgAt + 40, 16) }}>
        <Img src={staticFile('captures/card.jpg')} style={{ width: 300, borderRadius: 12, boxShadow: '0 20px 50px -20px rgba(0,0,0,.8)' }} />
        <div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, lineHeight: 1.45 }}>No image on the page?<br /><b style={{ color: C.ink }}>A branded title card is rendered</b> instead.</div>
      </div>
      <div style={{ position: 'absolute', left: 1080, top: 330, width: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(([phrase, icon, title, body]) => {
          const at = cue(t, phrase);
          const p = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: ease });
          return (
            <div key={title} style={{ opacity: 0.25 + 0.75 * p, transform: `translateX(${(1 - p) * 16}px)`, display: 'flex', gap: 16, alignItems: 'center', background: 'rgba(34,30,26,.9)', border: `1px solid ${p > 0.5 ? C.coral + '55' : C.line}`, borderRadius: 16, padding: '16px 20px' }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <div><div style={{ fontFamily: sans, fontWeight: 700, fontSize: 25, color: C.ink }}>{title}</div><div style={{ fontFamily: sans, fontSize: 20, color: C.ink3 }}>{body}</div></div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────────── 11 Engineering
export const S11: React.FC<P> = ({ t }) => {
  const f = useCurrentFrame();
  const files = cue(t, 'All the Code-node');
  const dry = cue(t, 'Everything starts in dry run');
  const prod = cue(t, 'what I\'d change for production');
  const lines = tests.lines;
  const shown = Math.floor(interpolate(f, [files, files + 70], [0, lines.length], clamp));
  return (
    <AbsoluteFill>
      <Backdrop />
      <Title kicker="Engineering" start={4}>Built like software,<br />not a demo.</Title>
      <div style={{ position: 'absolute', left: 120, top: 360, width: 860, height: 560, borderRadius: 18, background: '#0E0D0C', border: `1px solid ${C.line}`, boxShadow: '0 40px 100px -30px rgba(0,0,0,.8)', overflow: 'hidden', opacity: useIn(8, 16) }}>
        <div style={{ height: 40, background: '#1A1816', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', fontFamily: mono, fontSize: 16, color: C.ink3 }}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}<span style={{ marginLeft: 12 }}>~/placidWay · npm test</span></div>
        <div style={{ padding: '14px 20px', fontFamily: mono, fontSize: 16.5, lineHeight: 1.62 }}>
          {lines.slice(0, shown).slice(-16).map((l, i) => <div key={i} style={{ color: l.startsWith('✔') ? C.green : C.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>)}
          {shown >= lines.length && <div style={{ marginTop: 8, color: C.green, fontWeight: 500 }}>ℹ pass {tests.pass} · fail 0</div>}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1040, top: 360, width: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Step at={files + 20} title="Code nodes are real files" body="workflows/src/code/*.js → build → workflows/*.json (importable n8n)" />
        <Step at={dry} title="Dry run by default" body="Every Graph API call recorded, nothing sent until you flip one switch" />
        <Step at={prod} title="What I’d change for production" body="System-user token · idempotent publish retry · queue-mode n8n" accent={C.peach} />
      </div>
    </AbsoluteFill>
  );
};
const Step: React.FC<{ at: number; title: string; body: string; accent?: string }> = ({ at, title, body, accent = C.coral }) => {
  const p = usePop(at);
  return (
    <div style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 16}px)`, background: 'rgba(34,30,26,.92)', border: `1px solid ${C.line}`, borderLeft: `5px solid ${accent}`, borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 28, color: C.ink }}>{title}</div>
      <div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 6 }}>{body}</div>
    </div>
  );
};

// ───────────────────────────── 12 Close
export const S12: React.FC<P> = ({ t }) => {
  const a = useIn(6, 22);
  const repo = cue(t, 'The workflows');
  const thanks = cue(t, 'Thanks for watching');
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <div style={{ opacity: a }}><LogoMark size={92} /></div>
        <div style={{ marginTop: 34, fontFamily: serif, fontWeight: 500, fontSize: 82, lineHeight: 1.1, color: C.ink, letterSpacing: '-.02em', opacity: a }}>One trustworthy post a day.</div>
        <div style={{ marginTop: 22, fontFamily: sans, fontSize: 32, color: C.ink2, opacity: useIn(20, 20) }}>Grounded in PlacidWay’s own content · a human in the loop whenever it matters</div>
        <div style={{ marginTop: 50, opacity: useIn(repo, 18) }}><Pill color={C.peach} style={{ fontSize: 28, fontFamily: mono }}>{REPO}</Pill></div>
        <div style={{ marginTop: 18, fontFamily: sans, fontSize: 22, color: C.ink3, opacity: useIn(repo + 10, 18) }}>workflows · README · sample posts · tests</div>
        <div style={{ marginTop: 56, fontFamily: serif, fontStyle: 'italic', fontSize: 44, color: C.coral, opacity: useIn(thanks, 18) }}>Thank you, Irvan Fahlepi</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SCENES: Record<string, React.FC<P>> = { s01: S01, s02: S02, s03: S03, s04: S04, s05: S05, s06: S06, s07: S07, s08: S08, s09: S09, s10: S10, s11: S11, s12: S12 };
