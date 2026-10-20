# Demo video: record your voice and render

The video is built from **real captures of this system**:

- the n8n editor executing a live run
- the review dashboard
- the post that went live on the test Facebook Page

Motion graphics come from [Remotion](https://remotion.dev) (`video/`). Your narration drives the timing: each scene stretches to fit your take, and captions follow it.

## 1. Record (about 15 minutes)

```bash
cd video
npm run record          # → open http://localhost:8095 in Chrome
```

The page is a teleprompter, one scene at a time (12 scenes, ~6 minutes of speech in total).

- **Space** record/stop (a 3-2-1 countdown first), **P** play the take back, **→** next scene. Re-record any scene as often as you like.
- Pick your best microphone in the top-right menu. A headset or USB mic in a quiet room beats a laptop mic by a mile.
- Don't worry about pauses at the start or end: every take is automatically high-pass filtered, gently de-noised, trimmed, compressed and normalised to −16 LUFS (broadcast loudness).
- Takes land in `video/public/voice/` with a `manifest.json` the video reads.

Already recorded elsewhere (QuickTime, Audacity, a phone)? Name the files `s01.m4a` … `s12.m4a` (any format) and run:

```bash
npm run voice:import -- /path/to/folder
```

## 2. Render

```bash
npm run render          # → video/out/placidway-autopilot-demo.mp4 (1080p30, H.264)
```

`npm run studio` opens Remotion Studio to scrub through the timeline before rendering.

## What each scene shows

| # | Scene | Real footage / data |
|---|---|---|
| 1 | Intro | title |
| 2 | Architecture | animated system diagram |
| 3 | The brief | each requirement → its implementation |
| 4 | The workflow | n8n canvas tour (hi-res capture) |
| 5 | Live run | **real n8n execution** (Manual Run → draft in 79 s), speed-ramped through the Claude calls, with the actual selection reason, extraction and assembled post |
| 6 | Guardrails | the 9 rules and the reviewer verdict **from that run** |
| 7 | Human review | dashboard: preview, guardrail report, claim grounding, a blocked edit |
| 8 | Publish | live approval → **the post on the test Facebook Page** |
| 9 | Logging & failures | run log + the real alerts from the site-down, LLM-down and bad-token tests |
| 10 | Stretch goals | before/after image branding, title card, rotation, scheduling, IG, engagement |
| 11 | Engineering | the actual `npm test` output, build pipeline, production trade-offs |
| 12 | Wrap-up | repository link |

## Re-capturing footage

Capture scripts live in `video/capture/` (Playwright + DevTools screencast for crisp frames). They log into n8n with a local recording-only admin (`N8N_RECORDER_*` in `.env`):

```bash
npm run capture:n8n        # real pipeline run in the editor (creates a new draft)
npm run capture:dashboard  # dashboard segments (approves the new draft: this POSTS LIVE if dry_run is off)
npm run capture:stills     # canvases and lists
```

Facebook screenshots were taken from a logged-in browser and cropped to the post, so no personal account details appear.
