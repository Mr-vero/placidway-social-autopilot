// Hi-res stills of the remaining n8n views.
import { chromium } from 'playwright';
import { join } from 'node:path';
import { n8nLogin, dismissN8nPopups, sleep, OUT } from './lib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await n8nLogin(page);
for (const [id, file] of [['pwPublishPost001', 'canvas-publish.png'], ['pwErrorHandler01', 'canvas-errors.png'], ['pwDashboardApi01', 'canvas-api.png']]) {
  await page.goto(`http://localhost:5678/workflow/${id}`);
  await sleep(3500);
  await dismissN8nPopups(page);
  await page.locator('[data-test-id="zoom-to-fit"]').click().catch(() => {});
  await sleep(1000);
  await page.mouse.move(1910, 600);
  await page.screenshot({ path: join(OUT, file) });
}
await page.goto('http://localhost:5678/workflow/pwDailyPipeline1/executions');
await sleep(4000);
await dismissN8nPopups(page);
await page.screenshot({ path: join(OUT, 'n8n-executions.png') });
await page.goto('http://localhost:5678/home/workflows');
await sleep(3500);
await dismissN8nPopups(page);
await page.screenshot({ path: join(OUT, 'n8n-workflows.png') });
await b.close();
