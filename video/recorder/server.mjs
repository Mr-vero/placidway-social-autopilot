#!/usr/bin/env node
// Voice-over recorder: teleprompter page + upload endpoint (zero dependencies).
//   npm run record   → http://localhost:8095
// Each take is cleaned with ffmpeg (high-pass, gentle denoise, edge-silence trim,
// loudness-normalised to -16 LUFS) and saved as public/voice/<scene>.wav. The
// manifest it updates is what the Remotion composition reads for scene timing.
//
// Already recorded elsewhere?  node recorder/server.mjs --import <folder>
// (files named s01.* … s12.*, any format ffmpeg reads)

import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const VOICE = join(ROOT, 'public', 'voice');
const MANIFEST = join(VOICE, 'manifest.json');
const SCRIPT = join(ROOT, 'src', 'script.json');
mkdirSync(VOICE, { recursive: true });

const readManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {});
const FILTER = [
  'highpass=f=75',
  'afftdn=nf=-28',
  'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.30',
  'areverse',
  'acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120',
  'loudnorm=I=-16:TP=-1.5:LRA=9',
].join(',');

function processTake(id, inputPath) {
  const out = join(VOICE, `${id}.wav`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', inputPath, '-af', FILTER, '-ar', '48000', '-ac', '1', out]);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  const m = readManifest();
  m[id] = { file: `${id}.wav`, duration: Math.round(duration * 1000) / 1000 };
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  return m[id];
}

// CLI import mode.
const imp = process.argv.indexOf('--import');
if (imp > -1) {
  const dir = process.argv[imp + 1];
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(s\d{2})\./i);
    if (!m) continue;
    const r = processTake(m[1].toLowerCase(), join(dir, f));
    console.log(`${m[1]} → ${r.duration.toFixed(1)}s`);
  }
  process.exit(0);
}

const PAGE = readFileSync(join(ROOT, 'recorder', 'index.html'));
const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (req.method === 'GET' && url.pathname === '/script') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(readFileSync(SCRIPT)); }
    if (req.method === 'GET' && url.pathname === '/manifest') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(readManifest())); }
    if (req.method === 'GET' && url.pathname.startsWith('/voice/')) {
      const f = join(VOICE, url.pathname.slice(7).replace(/[^a-z0-9._-]/gi, ''));
      if (!existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' }); return res.end(readFileSync(f));
    }
    if (req.method === 'POST' && url.pathname === '/upload') {
      const id = String(url.searchParams.get('id') || '');
      if (!/^s\d{2}$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const tmp = join(tmpdir(), `pw-take-${id}-${Date.now()}${extname(url.searchParams.get('ext') || '.webm')}`);
      writeFileSync(tmp, Buffer.concat(chunks));
      const r = processTake(id, tmp);
      unlinkSync(tmp);
      console.log(`saved ${id} (${r.duration.toFixed(1)}s)`);
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(r));
    }
    if (req.method === 'POST' && url.pathname === '/delete') {
      const id = String(url.searchParams.get('id') || '');
      const m = readManifest();
      if (m[id]) { try { unlinkSync(join(VOICE, m[id].file)); } catch {} delete m[id]; writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); }
      res.writeHead(200); return res.end('{}');
    }
    res.writeHead(404); res.end();
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end(String(e.message));
  }
};
// Loopback only, on both stacks (so "localhost" works whether it resolves to ::1 or 127.0.0.1).
const PORT = Number(process.env.RECORDER_PORT || 8095);
http.createServer(handler).listen(PORT, '127.0.0.1', () => console.log(`🎙  Voice recorder → http://localhost:${PORT}`));
http.createServer(handler).listen(PORT, '::1').on('error', () => {});
