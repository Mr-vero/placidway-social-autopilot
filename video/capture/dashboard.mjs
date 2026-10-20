// Records the review dashboard: failures/alerts, overview, review + guardrails, LIVE approve, posts, run log, settings.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startRecording, installCursor, glide, glideTo, clickAt, sleep, sql, OUT } from './lib.mjs';

const { runId } = JSON.parse(readFileSync(join(OUT, 'n8n-live.run.json'), 'utf8'));
const POST = Number(process.env.POST || sql(`select id from posts where run_id='${runId}'`));
if (!POST) throw new Error('no draft from the live run');
console.log('draft', POST);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await ctx.newPage();
await installCursor(page);
await page.addInitScript(() => { try { localStorage.setItem('pw.tab', 'review'); localStorage.removeItem('pw.theme'); } catch (e) {} });
const scrollTo = (y) => page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
const tab = (t) => page.locator(`.tab[data-tab="${t}"]`);
async function openTab(t) { await scrollTo(0); await sleep(800); await clickAt(page, tab(t), { ms: 800 }); await sleep(600); }

const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
async function segment(name, fn) {
  if (ONLY && !ONLY.includes(name)) return;
  await page.goto('http://localhost:8080');
  await page.waitForSelector('#kpis .kpi:not(.skeleton)', { timeout: 30000 });
  await sleep(1200);
  await glide(page, 1500, 760, 10);
  const rec = await startRecording(page, name);
  await sleep(800);
  await fn(rec);
  await sleep(1000);
  await rec.stop();
}

// F: failures are visible and actionable (real alerts from the live failure tests).
await segment('dash-failures', async (rec) => {
  rec.mark('alerts');
  await glideTo(page, page.locator('.alert').first(), { ms: 1200, dx: 0.3 });
  await sleep(2500);
  await glideTo(page, page.locator('.alert').nth(1), { ms: 700, dx: 0.35 });
  await sleep(2000);
  await glideTo(page, page.locator('.alert').nth(2), { ms: 700, dx: 0.35 });
  await sleep(2000);
  rec.mark('runlog');
  await clickAt(page, tab('runs'));
  await sleep(600);
  await scrollTo(560);
  await sleep(1500);
  const errRow = page.locator('tr[data-run-row^="pipe-"]').filter({ hasText: 'Error' }).first();
  if (await errRow.count()) { await clickAt(page, errRow, { dx: 0.15 }); await sleep(3500); await clickAt(page, errRow, { dx: 0.15 }); }
  const pubErr = page.locator('tr[data-run-row^="pub-"]').filter({ hasText: 'token_expired' }).first();
  if (await pubErr.count()) { await glideTo(page, pubErr, { dx: 0.45 }); await sleep(2500); }
  rec.mark('dismiss');
  await scrollTo(0);
  await sleep(900);
  for (let i = 0; i < 3; i++) {
    const b = page.locator('[data-ack]').first();
    if (!(await b.count())) break;
    await clickAt(page, b, { ms: 500 });
    await sleep(1300);
  }
});

// A: overview.
await segment('dash-overview', async (rec) => {
  rec.mark('hero');
  await glideTo(page, page.locator('#run-status'), { ms: 1200, dx: 0.3 });
  await sleep(1800);
  await glideTo(page, page.locator('.kpi').nth(0), { ms: 800 });
  await sleep(900);
  await glideTo(page, page.locator('.kpi').nth(2), { ms: 700 });
  await sleep(1400);
  rec.mark('week');
  await glideTo(page, page.locator('.day.today'), { ms: 900 });
  await sleep(1500);
  await glideTo(page, page.locator('.day').nth(5), { ms: 900 });
  await sleep(1200);
});

// R: review the live draft, see grounding, try a banned edit, then approve LIVE.
await segment('dash-review', async (rec) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  rec.mark('queue');
  await clickAt(page, page.locator(`[data-select="${POST}"]`), { ms: 1100 });
  await sleep(700);
  await scrollTo(430);
  await sleep(1500);
  rec.mark('preview');
  await glideTo(page, page.locator('.fb-text'), { ms: 1000, dx: 0.4, dy: 0.25 });
  await sleep(2500);
  rec.mark('guardrails');
  await glideTo(page, page.locator('.verdict'), { ms: 900, dx: 0.3 });
  await sleep(2000);
  await scrollTo(800);
  await sleep(1200);
  for (let i = 0; i < 6; i++) { const row = page.locator('.checks li').nth(i); if (await row.count()) { await glideTo(page, row, { ms: 260, dx: 0.25 }); await sleep(220); } }
  await sleep(800);
  rec.mark('grounding');
  await scrollTo(1350);
  await sleep(1400);
  for (let i = 0; i < 4; i++) {
    const row = page.locator(`[data-claim-row="${i}"]`);
    if (await row.count()) { await glideTo(page, row, { ms: 600, dx: 0.3 }); await sleep(1500); }
  }
  rec.mark('edit');
  await scrollTo(380);
  await sleep(1200);
  await clickAt(page, page.locator('[data-edit]'));
  await sleep(700);
  await page.locator('#editor').evaluate((el) => { el.focus(); el.setSelectionRange(0, 0); });
  await page.keyboard.type('Guaranteed results! ', { delay: 85 });
  await sleep(1400);
  rec.mark('blocked');
  const bad = page.locator('.checks li.bad').first();
  if (await bad.count()) { await glideTo(page, bad, { ms: 900, dx: 0.3 }); await sleep(2200); }
  await glideTo(page, page.locator('[data-approve]'), { ms: 800 });
  await sleep(1800);
  await clickAt(page, page.locator('[data-cancel-edit]'));
  await sleep(1200);
  rec.mark('approve');
  await clickAt(page, page.locator(`[data-approve="${POST}"]`), { ms: 900 });
  await page.waitForSelector('.toast', { timeout: 120000 });
  rec.mark('published');
  await sleep(2600);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await sleep(1500);
  const fb = page.locator('a:has-text("View on Facebook")').first();
  if (await fb.count()) { await glideTo(page, fb, { ms: 900 }); await sleep(2000); }
});

// P: posts gallery + run log entry for the live publish + settings.
await segment('dash-tour', async (rec) => {
  rec.mark('posts');
  await openTab('posts');
  await scrollTo(470);
  await sleep(2600);
  rec.mark('runlog');
  await openTab('runs');
  await scrollTo(470);
  await sleep(900);
  const pub = page.locator('tr[data-run-row^="pub-"]').first();
  await clickAt(page, pub, { dx: 0.12 });
  await sleep(3800);
  rec.mark('settings');
  await openTab('settings');
  await scrollTo(470);
  await sleep(1200);
  await glideTo(page, page.locator('#s-mode'), { ms: 900 });
  await sleep(1300);
  await glideTo(page, page.locator('.rotation'), { ms: 900, dx: 0.4 });
  await sleep(1800);
});

writeFileSync(join(OUT, 'dashboard.run.json'), JSON.stringify({ post: POST }, null, 2));
const live = sql(`select fb_post_id||' '||coalesce(fb_permalink,'') from posts where id=${POST}`);
console.log('published:', live);
await browser.close();
