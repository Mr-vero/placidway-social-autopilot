// Records a REAL pipeline execution in the n8n editor, then grabs node-output stills.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
const require_exec = (c) => execSync(c, { cwd: ROOT }).toString().trim();
import { n8nLogin, dismissN8nPopups, startRecording, installCursor, glide, glideTo, clickAt, sleep, sql, OUT } from './lib.mjs';

const SCALE = 1.5;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
const page = await ctx.newPage();
await installCursor(page);
await n8nLogin(page);
await page.goto('http://localhost:5678/workflow/pwDailyPipeline1');
await sleep(4000);
await dismissN8nPopups(page);
await page.locator('[data-test-id="zoom-to-fit"]').click();
await sleep(1200);
await page.mouse.move(1500, 900);

// Hi-res still of the idle canvas for the guided tour.
await page.screenshot({ path: join(OUT, 'canvas-pipeline.png') });

const lastRun = sql("select coalesce(max(id),0) from runs");
const n8nSql = (q) => require_exec(`docker compose exec -T postgres psql -U pw -d n8n -tAc ${JSON.stringify(q)}`);
const lastExec = n8nSql('select coalesce(max(id),0) from execution_entity');
const rec = await startRecording(page, 'n8n-live', { scale: SCALE });
await sleep(1500);
rec.mark('hover-manual');
const trigger = page.locator('[data-test-id="canvas-node"]', { hasText: 'Manual Run' }).first();
await glideTo(page, trigger, { ms: 1100 });
await sleep(700);
const btn = page.locator('[data-test-id="execute-workflow-button-Manual Run"]');
await btn.waitFor({ state: 'visible', timeout: 5000 });
await clickAt(page, btn, { ms: 500 });
rec.mark('clicked-execute');
await glide(page, 1700, 1000, 900);

// Follow the run via the app DB (the same runs table the dashboard reads).
let runId = null;
const t0 = Date.now();
for (;;) {
  await sleep(1500);
  const row = sql(`select run_id||'|'||status from runs where id > ${lastRun} and workflow='pipeline' order by id desc limit 1`);
  if (row) {
    const [rid, status] = row.split('|');
    if (!runId) { runId = rid; rec.mark(`run-started ${rid}`); }
    if (status !== 'running') { rec.mark(`run-finished ${status}`); break; }
  }
  const ex = n8nSql(`select status from execution_entity where id > ${lastExec} and mode='manual' order by id desc limit 1`);
  if (ex && !['running', 'new', 'waiting'].includes(ex)) { rec.mark(`execution-ended ${ex}`); if (ex !== 'success') throw new Error('execution failed: ' + ex); break; }
  if (Date.now() - t0 > 8 * 60 * 1000) throw new Error('run timed out');
}
await sleep(4000);
await rec.stop();

// Finished canvas (green ticks + item counts).
await page.screenshot({ path: join(OUT, 'canvas-pipeline-done.png') });

// Node output stills: open each node's panel (NDV), JSON view.
async function nodeStill(name, file) {
  const node = page.locator('[data-test-id="canvas-node"]', { hasText: name }).first();
  await node.dblclick();
  await sleep(1800);
  const json = page.locator('[data-test-id="ndv-output-panel"] [data-test-id="radio-button-json"], [data-test-id="ndv-output-panel"] label:has-text("JSON")').first();
  if (await json.isVisible().catch(() => false)) { await json.click().catch(() => {}); await sleep(800); }
  await page.screenshot({ path: join(OUT, file) });
  await page.keyboard.press('Escape');
  await sleep(800);
}
for (const [n, f] of [['Pick Candidate', 'ndv-pick.png'], ['Extract Content', 'ndv-extract.png'], ['Write Post (Claude)', 'ndv-write.png'], ['Assemble Post', 'ndv-assemble.png'], ['Rule-Based Checks', 'ndv-rules.png'], ['Guardrail Verdict', 'ndv-verdict.png'], ['Brand Image', 'ndv-brand.png']]) {
  await nodeStill(n, f).catch((e) => console.log('  still failed', n, e.message));
}

const execId = runId ? runId.replace('pipe-', '') : null;
writeFileSync(join(OUT, 'n8n-live.run.json'), JSON.stringify({ runId, execId }, null, 2));
console.log('done', runId);
await browser.close();
