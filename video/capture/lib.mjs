// Capture helpers: env, n8n login, DevTools screencast recorder, on-screen cursor.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export const ROOT = new URL('../..', import.meta.url).pathname;
export const OUT = join(ROOT, 'video', 'public', 'captures');
mkdirSync(OUT, { recursive: true });

export const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sql = (q) => execSync(`docker compose exec -T postgres psql -U pw -d pw -tAc ${JSON.stringify(q)}`, { cwd: ROOT }).toString().trim();

export async function n8nLogin(page) {
  await page.goto('http://localhost:5678/signin');
  await page.waitForSelector('input[type="email"], input[name="emailOrLdapLoginId"]', { timeout: 60000 });
  await page.fill('input[type="email"], input[name="emailOrLdapLoginId"]', env.N8N_RECORDER_EMAIL);
  await page.fill('input[type="password"]', env.N8N_RECORDER_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 30000 });
  await sleep(1500);
}

export async function dismissN8nPopups(page) {
  for (const sel of ['[data-test-id="production-checklist"] button[aria-label="Close"]', 'button:has-text("Dismiss")', '.el-dialog__headerbtn']) {
    const b = page.locator(sel).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
  // Production checklist card: close via its X (top-right of the card).
  const card = page.getByText('Production Checklist').first();
  if (await card.isVisible().catch(() => false)) {
    const box = await card.locator('xpath=ancestor::div[.//button][1]').boundingBox().catch(() => null);
    const x = page.locator('xpath=//*[text()="Production Checklist"]/following::button[1]').first();
    await x.click({ timeout: 2000 }).catch(async () => { if (box) await page.mouse.click(box.x + box.width - 20, box.y + 25); });
  }
}

// DevTools screencast -> timestamped JPEG frames -> constant-30fps MP4 (crisp, unlike default video).
export async function startRecording(page, name, { quality = 88, scale = 1 } = {}) {
  const dir = join(OUT, `.${name}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const frames = [];
  const t0 = Date.now();
  const marks = [];
  cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    const i = frames.length;
    const file = join(dir, `${String(i).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: Math.round(vp.width * scale), maxHeight: Math.round(vp.height * scale), everyNthFrame: 1 });
  return {
    mark(label) { marks.push({ label, s: (Date.now() - t0) / 1000 }); console.log(`  [${name}] ${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`); },
    async stop() {
      await sleep(400);
      await cdp.send('Page.stopScreencast').catch(() => {});
      await sleep(300);
      if (!frames.length) throw new Error('no frames captured');
      // concat demuxer with per-frame durations, then resample to 30fps CFR.
      const start = frames[0].t;
      const lines = [];
      frames.forEach((f, i) => {
        const next = frames[i + 1] ? frames[i + 1].t : f.t + 0.5;
        lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
      });
      lines.push(`file '${frames[frames.length - 1].file}'`);
      const list = join(dir, 'list.txt');
      writeFileSync(list, lines.join('\n'));
      const out = join(OUT, `${name}.mp4`);
      execSync(`ffmpeg -loglevel error -y -f concat -safe 0 -i "${list}" -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -preset slow -crf 16 "${out}"`);
      const offset = (frames[0].t - start);
      writeFileSync(join(OUT, `${name}.marks.json`), JSON.stringify({ marks, frames: frames.length, firstFrameOffset: offset }, null, 2));
      rmSync(dir, { recursive: true, force: true });
      console.log(`  [${name}] saved ${out} (${frames.length} frames)`);
      return out;
    },
  };
}

// A visible cursor (headless pages have none) that eases between points and pulses on click.
export async function installCursor(page) {
  await page.addInitScript(() => {
    const add = () => {
      if (document.getElementById('__cur')) return;
      const c = document.createElement('div');
      c.id = '__cur';
      c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span></span>';
      Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-3px,-2px)', transition: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.35))' });
      const ring = c.querySelector('span');
      Object.assign(ring.style, { position: 'absolute', left: '-14px', top: '-14px', width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #E85A4F', opacity: '0', transform: 'scale(.4)', transition: 'all .35s ease-out' });
      document.documentElement.appendChild(c);
      window.addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, true);
      window.addEventListener('mousedown', () => { ring.style.transition = 'none'; ring.style.opacity = '1'; ring.style.transform = 'scale(.4)'; requestAnimationFrame(() => { ring.style.transition = 'all .45s ease-out'; ring.style.opacity = '0'; ring.style.transform = 'scale(1.4)'; }); }, true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  });
}

let cursorPos = { x: 960, y: 540 };
export async function glide(page, x, y, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  const from = { ...cursorPos };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  cursorPos = { x, y };
}
export async function glideTo(page, locator, { ms = 700, dx = 0.5, dy = 0.5 } = {}) {
  await locator.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
  await sleep(250);
  const box = await locator.boundingBox();
  if (!box) throw new Error('element not visible for glideTo');
  await glide(page, box.x + box.width * dx, box.y + box.height * dy, ms);
  return box;
}
export async function clickAt(page, locator, opts) {
  await glideTo(page, locator, opts);
  await sleep(150);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
