#!/usr/bin/env node
// LLM bridge: a tiny HTTP front for the Claude CLI (or the Anthropic API).
//
// Why it exists: n8n runs in Docker, but the Claude CLI's login lives in the
// host's macOS Keychain. Rather than baking credentials into the image, n8n
// calls this host process over HTTP and it shells out to `claude -p`.
// Setting LLM_BACKEND=api with ANTHROPIC_API_KEY swaps in the Messages API
// with no workflow changes, which is the production path.
//
//   POST /v1/generate  { system, prompt, model?, schema?, max_tokens? }
//     -> { ok, data, text, model, backend, duration_ms, cost_usd }
//   GET  /health
//
// Zero dependencies. Node >= 18.

import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.BRIDGE_PORT || 8787);
const HOST = process.env.BRIDGE_HOST || '127.0.0.1'; // Docker Desktop's host.docker.internal reaches host loopback
const TOKEN = process.env.LLM_BRIDGE_TOKEN || '';
const BACKEND = process.env.LLM_BACKEND || 'cli'; // cli | api
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT_MS || 180_000);
const MAX_CONCURRENCY = Number(process.env.BRIDGE_CONCURRENCY || 2);

// Aliases keep the workflow model-agnostic. The CLI understands the short names;
// the API path maps them to full model ids.
const API_MODELS = {
  sonnet: process.env.API_MODEL_SONNET || 'claude-sonnet-5-5',
  haiku: process.env.API_MODEL_HAIKU || 'claude-haiku-5-5',
  opus: process.env.API_MODEL_OPUS || 'claude-opus-5-5',
};

// An empty working dir so the CLI never picks up a project CLAUDE.md.
const SANDBOX = mkdtempSync(join(tmpdir(), 'pw-bridge-'));

let active = 0;
const queue = [];
const acquire = () => new Promise((res) => (active < MAX_CONCURRENCY ? (active++, res()) : queue.push(res)));
const release = () => { const next = queue.shift(); next ? next() : active--; };

const log = (...a) => console.log(new Date().toISOString(), ...a);

function runCli({ system, prompt, model, schema }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'json',
      '--model', model,
      '--no-session-persistence',
      '--setting-sources', '',
      '--tools', '',
      '--system-prompt', system || 'You are a helpful assistant.',
    ];
    if (schema) args.push('--json-schema', JSON.stringify(schema));

    const child = spawn(CLAUDE_BIN, args, { cwd: SANDBOX, env: process.env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`claude CLI timed out after ${TIMEOUT_MS}ms`)); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      let parsed;
      try { parsed = JSON.parse(out); } catch {
        return reject(new Error(`claude CLI exited ${code}; unparseable output: ${(err || out).slice(0, 500)}`));
      }
      if (parsed.is_error) return reject(new Error(`claude CLI error: ${parsed.result || parsed.subtype}`));
      const usedModel = Object.keys(parsed.modelUsage || {})[0] || model;
      resolve({
        data: parsed.structured_output ?? tryJson(parsed.result),
        text: parsed.result,
        model: usedModel,
        cost_usd: parsed.total_cost_usd,
      });
    });
    child.stdin.end(prompt);
  });
}

async function runApi({ system, prompt, model, schema, max_tokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('LLM_BACKEND=api but ANTHROPIC_API_KEY is not set');
  const body = {
    model: API_MODELS[model] || model,
    max_tokens: max_tokens || 1500,
    system,
    messages: [{ role: 'user', content: prompt }],
  };
  // Structured output via a forced tool call keeps the contract identical to the CLI path.
  if (schema) {
    body.tools = [{ name: 'respond', description: 'Return the result', input_schema: schema }];
    body.tool_choice = { type: 'tool', name: 'respond' };
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(`Anthropic API ${r.status}: ${j?.error?.message}`), { status: r.status });
  const tool = j.content.find((c) => c.type === 'tool_use');
  const text = j.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { data: tool ? tool.input : tryJson(text), text: text || JSON.stringify(tool?.input), model: j.model };
}

function tryJson(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, backend: BACKEND, active, queued: queue.length });
  }
  if (req.method !== 'POST' || req.url !== '/v1/generate') return send(res, 404, { ok: false, error: 'not found' });
  if (TOKEN && req.headers['x-bridge-token'] !== TOKEN) return send(res, 401, { ok: false, error: 'bad token' });

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let input;
  try { input = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'invalid JSON body' }); }
  if (!input.prompt) return send(res, 400, { ok: false, error: '`prompt` is required' });
  input.model = input.model || 'sonnet';

  const t0 = Date.now();
  await acquire();
  try {
    const out = await (BACKEND === 'api' ? runApi(input) : runCli(input));
    if (input.schema && !out.data) throw new Error('model did not return structured output');
    const duration_ms = Date.now() - t0;
    log(`ok   ${BACKEND}/${input.model} ${duration_ms}ms tag=${input.tag || '-'}`);
    send(res, 200, { ok: true, backend: BACKEND, duration_ms, ...out });
  } catch (e) {
    log(`fail ${BACKEND}/${input.model} ${Date.now() - t0}ms tag=${input.tag || '-'}: ${e.message}`);
    // 503 lets n8n's retry-on-fail treat it as transient.
    send(res, e.status && e.status < 500 && e.status !== 429 ? 400 : 503, { ok: false, error: e.message });
  } finally {
    release();
  }
});

server.listen(PORT, HOST, () => log(`LLM bridge listening on http://${HOST}:${PORT} (backend=${BACKEND}, concurrency=${MAX_CONCURRENCY})`));
