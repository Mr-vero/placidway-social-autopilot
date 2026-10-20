// Dev: log into n8n as the recorder and screenshot each workflow canvas.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://localhost:5678/signin');
await page.fill('input[type="email"], input[name="emailOrLdapLoginId"]', env.N8N_RECORDER_EMAIL);
await page.fill('input[type="password"]', env.N8N_RECORDER_PASSWORD);
await page.keyboard.press('Enter');
await page.waitForURL(/home|workflows|projects/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/peek-home.png' });
for (const id of (process.argv[2] || 'pwDailyPipeline1').split(',')) {
  await page.goto(`http://localhost:5678/workflow/${id}`);
  await page.waitForTimeout(4000);
  await page.keyboard.press('Shift+1').catch(() => {}); // zoom to fit
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/peek-${id}.png` });
}
await browser.close();
