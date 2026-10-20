import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCode } from './harness.mjs';

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const SETTINGS = { publish_mode: 'approval', dry_run: 'true', max_attempts: '3', avoid_recent_categories: '3', brand_images: 'true',
  rotation: '{"0":"answer","1":"article","2":"package","3":"answer","4":"article","5":"package","6":"news"}' };

const run = (dow = 1) => ({ run: { run_id: 'pipe-1', trigger: 'manual', dow, tz: 'UTC' } });

function sitemap(urls) {
  return `<?xml version="1.0"?><urlset>${urls.map(([loc, lastmod, img]) =>
    `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>${img ? `<image:image><image:loc>${img}</image:loc></image:image>` : ''}</url>`).join('')}</urlset>`;
}

const targets = ['article', 'package', 'answer', 'news'].map((type) => ({ target: { type, url: `https://x/${type}.xml` } }));
const A = 'https://www.placidway.com/article';

test('pick-candidate: follows weekday rotation and skips used URLs', async () => {
  const bodies = [
    { data: sitemap([[`${A}/9796/Stem-Cell-Therapy-for-Autism-in-Mexico`, '2026-10-19', 'i.png'], [`${A}/9795/Body-Contouring-in-Mexico-After-Ozempic`, '2026-10-19', 'j.png']]) },
    { data: sitemap([['https://www.placidway.com/package/8700/Dental-Implants-Package-in-Cancun', '2026-10-20']]) },
    { data: sitemap([]) }, { data: sitemap([]) },
  ];
  const [out] = await runCode('pick-candidate.js', {
    input: bodies,
    nodes: {
      'Start Run': run(1),
      'Load Settings': { settings: SETTINGS, used_urls: [`${A}/9796/Stem-Cell-Therapy-for-Autism-in-Mexico`], recent: [] },
      'Sitemap Targets': targets,
    },
  });
  assert.equal(out.json.found, true);
  assert.equal(out.json.item.type, 'article');                      // Monday = article
  assert.match(out.json.item.url, /9795/);                         // 9796 already used
  assert.equal(out.json.item.category, 'Bariatric & Weight Loss');
});

test('pick-candidate: avoids recently used categories and falls back across types', async () => {
  const bodies = [
    { data: sitemap([[`${A}/2/Stem-Cell-Knee-Treatment-Japan`, '2026-10-19'], [`${A}/1/Dental-Veneers-Guide-Costa-Rica`, '2026-10-18']]) },
    { data: sitemap([]) }, { data: sitemap([]) }, { data: sitemap([]) },
  ];
  const [out] = await runCode('pick-candidate.js', {
    input: bodies,
    nodes: {
      'Start Run': run(2),                                          // Tuesday = package, but none exist
      'Load Settings': { settings: SETTINGS, used_urls: [], recent: [{ category: 'Stem Cell & Regenerative', content_type: 'answer' }] },
      'Sitemap Targets': targets,
    },
  });
  assert.equal(out.json.item.type, 'article');
  assert.equal(out.json.item.category, 'Dental Care');              // stem cell was just used
  assert.match(out.json.selection.reason, /fell back/);
});

test('pick-candidate: throws when every sitemap is empty (site down / markup change)', async () => {
  await assert.rejects(runCode('pick-candidate.js', {
    input: [{ data: '' }, { data: '' }, { data: '' }, { data: '' }],
    nodes: { 'Start Run': run(1), 'Load Settings': { settings: SETTINGS, used_urls: [], recent: [] }, 'Sitemap Targets': targets },
  }), /empty or unparseable/);
});

async function extract(file, type, url) {
  const [out] = await runCode('extract-content.js', {
    input: [{ data: fixture(file) }],
    nodes: { 'Pick Candidate': { ...run(), settings: SETTINGS, item: { url, type, title_guess: 'x', image: null } }, 'Claim URL': { id: 42 } },
  });
  return out.json;
}

test('extract: article via JSON-LD articleBody, breadcrumb category, OG image', async () => {
  const j = await extract('article.html', 'article', `${A}/9795/Lost-Weight-With-Ozempic`);
  assert.equal(j.post_id, 42);
  assert.equal(j.source.extracted_via, 'json-ld:article');
  assert.match(j.source.title, /GLP-1/);
  assert.equal(j.source.category, 'Obesity/Bariatric Surgery');
  assert.ok(j.source.body_chars > 2000);
  assert.match(j.source.image, /^https:\/\/www\.placidway\.com\/cdn-cgi\/image/);
  assert.ok(j.source.excerpt.length <= 9000);
  assert.ok(j.source.faqs.length > 0);
});

test('extract: package captures listed price from Product offers', async () => {
  const j = await extract('package.html', 'package', 'https://www.placidway.com/package/8699/Cardiac-Risk-Assessment');
  assert.equal(j.source.extracted_via, 'json-ld:product');
  assert.match(j.source.summary, /USD 550/);
  assert.ok(j.source.price_facts.length > 0, 'price facts');
  assert.match(j.source.excerpt, /LISTED PRICE/);
});

test('extract: Q&A page via BlogPosting', async () => {
  const j = await extract('answer.html', 'answer', 'https://www.placidway.com/answer-detail/569700/How-Much-Does-Stem-Cell-Therapy-Cost-in-Japan');
  assert.match(j.source.title, /Stem Cell/i);
  assert.ok(j.source.body_chars > 500);
});

// ---------- guardrails ----------
const SOURCE = {
  url: `${A}/9795/Lost-Weight`,
  excerpt: 'TITLE: Body contouring in Mexico\nBODY: In 2025, 82% of American Society of Plastic Surgeons member surgeons said they had received consultation requests related to GLP-1 medication use. Tummy tuck, breast surgery, arm lift, thigh lift and body lift were among the procedures most commonly discussed. Package price: USD 550.',
};
const good = {
  hook: 'Lost weight on GLP-1 meds and now dealing with loose skin?',
  lines: ['82% of ASPS surgeons report GLP-1 related consultation requests', 'Tummy tuck, arm lift and body lift are among the most discussed procedures'],
  cta: 'Read the full guide on PlacidWay before you decide.',
  hashtags: ['BodyContouring', '#MedicalTourism', 'Mexico'],
  claims: [
    { line: 'a', source_quote: '82% of American Society of Plastic Surgeons member surgeons said they had received consultation requests' },
    { line: 'b', source_quote: 'Tummy tuck, breast surgery, arm lift, thigh lift and body lift were among the procedures most commonly discussed' },
  ],
};

async function check(gen) {
  const [a] = await runCode('assemble-post.js', {
    input: [{ ok: true, data: gen, model: 'test' }],
    nodes: { 'Build Prompt': { ...run(), source: SOURCE, llm_request: {} } },
    env: { PW_UTM: 'utm_source=facebook' }, mode: 'each',
  });
  const [r] = await runCode('rule-checks.js', { input: [a.json], mode: 'each' });
  return r.json;
}
const failed = (r) => r.guardrail.rules.checks.filter((c) => !c.pass).map((c) => c.id);

test('guardrails: a grounded, compliant post passes every rule', async () => {
  const r = await check(good);
  assert.deepEqual(failed(r), []);
  assert.match(r.post.text, /👉 https:\/\/www\.placidway\.com\/article\/9795\/Lost-Weight\?utm_source=facebook/);
  assert.match(r.post.text, /#BodyContouring #MedicalTourism #Mexico$/);
  assert.ok(r.post.body_chars < 500);
});

test('guardrails: blocks medical claims', async () => {
  const r = await check({ ...good, hook: 'This guaranteed treatment can cure loose skin for good!' });
  assert.ok(failed(r).includes('medical_claims'));
});

test('guardrails: cautionary negations are allowed, promises are not', async () => {
  const ok = await check({ ...good, lines: ["A clinic offering it doesn't mean it's proven to work", good.lines[1]] });
  assert.ok(!failed(ok).includes('medical_claims'), JSON.stringify(ok.guardrail.rules.checks));
  const bad = await check({ ...good, lines: ['A proven treatment with no side effects', good.lines[1]] });
  assert.ok(failed(bad).includes('medical_claims'));
});

test('guardrails: blocks numbers and prices not in the source', async () => {
  const r = await check({ ...good, lines: ['Save up to 70% vs the US', 'Packages from $2,999 all-inclusive'] });
  assert.ok(failed(r).includes('numbers'));
  assert.ok(failed(r).includes('prices'));
});

test('guardrails: allows a price that is in the source', async () => {
  const r = await check({ ...good, lines: [...good.lines.slice(0, 1), 'Listed package price: USD 550'], claims: [...good.claims.slice(0, 1), { line: 'p', source_quote: 'Package price: USD 550' }] });
  assert.ok(!failed(r).includes('prices'));
  assert.ok(!failed(r).includes('numbers'));
});

test('guardrails: flags quotes that are not in the source (hallucinated grounding)', async () => {
  const r = await check({ ...good, claims: [good.claims[0], { line: 'b', source_quote: 'Mexico has the most experienced surgeons in the world at a fraction of the price' }] });
  assert.ok(failed(r).includes('grounding'));
});

test('guardrails: structure, hashtag count and length limits', async () => {
  const r = await check({ ...good, lines: ['only one line'], hashtags: ['#a'], cta: 'x'.repeat(520) });
  for (const id of ['structure', 'hashtags', 'length']) assert.ok(failed(r).includes(id), id);
});

test('guardrails: unsupported superlatives', async () => {
  const r = await check({ ...good, cta: 'Find the best surgeon in Mexico on PlacidWay.' });
  assert.ok(failed(r).includes('superlatives'));
});

test('verdict: retries with feedback, then escalates to human review', async () => {
  const base = { ...run(), settings: SETTINGS, source: SOURCE, post: { text: 't' }, gen: {}, attempts_log: [],
    guardrail: { rules: { pass: false, checks: [{ id: 'numbers', label: 'Every number appears in the source', pass: false, detail: 'not in source: 70' }] } } };
  const llmFail = { ok: true, data: { verdict: 'fail', summary: 's', issues: [{ type: 'invented_price', severity: 'high', excerpt: '$2,999', explanation: 'not in source' }] } };
  let [v] = await runCode('guardrail-verdict.js', { input: [llmFail], nodes: { 'Build Review Prompt': { ...base, attempt: 1 } }, mode: 'each' });
  assert.equal(v.json.route, 'retry');
  assert.equal(v.json.feedback.length, 2);
  [v] = await runCode('guardrail-verdict.js', { input: [llmFail], nodes: { 'Build Review Prompt': { ...base, attempt: 3 } }, mode: 'each' });
  assert.equal(v.json.route, 'done');
  assert.equal(v.json.status, 'needs_review');
});

test('verdict: reviewer outage fails closed to human review (no auto-publish)', async () => {
  const base = { ...run(), settings: { ...SETTINGS, publish_mode: 'auto' }, source: SOURCE, post: { text: 't' }, gen: {}, attempts_log: [], attempt: 1,
    guardrail: { rules: { pass: true, checks: [] } } };
  const [v] = await runCode('guardrail-verdict.js', { input: [{ error: { message: 'ECONNREFUSED' } }], nodes: { 'Build Review Prompt': base }, mode: 'each' });
  assert.equal(v.json.status, 'needs_review');
});

test('verdict: clean pass in auto mode is approved for publishing', async () => {
  const base = { ...run(), settings: { ...SETTINGS, publish_mode: 'auto' }, source: SOURCE, post: { text: 't' }, gen: {}, attempts_log: [], attempt: 1,
    guardrail: { rules: { pass: true, checks: [] } } };
  const [v] = await runCode('guardrail-verdict.js', { input: [{ ok: true, data: { verdict: 'pass', summary: 'ok', issues: [{ type: 'tone', severity: 'low', excerpt: 'x', explanation: 'y' }] } }], nodes: { 'Build Review Prompt': base }, mode: 'each' });
  assert.equal(v.json.status, 'approved');
});

test('approval: human edits are re-checked against hard rules', async () => {
  const row = { id: 7, status: 'pending_approval', post_text: 'x', source_url: SOURCE.url, source_excerpt: SOURCE.excerpt, claims: [] };
  const edited = 'Guaranteed results!\n\n• 82% of surgeons see GLP-1 consults\n• Tummy tuck is common\n\nRead more on PlacidWay.\n👉 ' + SOURCE.url + '\n\n#A1 #B2 #C3';
  const [r] = await runCode('api/check-approval.js', { input: [row], nodes: { 'Route Action': { post_text: edited, reviewer: 'qa' } }, mode: 'each' });
  assert.equal(r.json.ok, false);
  assert.equal(r.json.code, 422);
  const fixed = edited.replace('Guaranteed results!', 'Considering body contouring after GLP-1 weight loss?');
  const [ok] = await runCode('api/check-approval.js', { input: [row], nodes: { 'Route Action': { post_text: fixed, reviewer: 'qa' } }, mode: 'each' });
  assert.equal(ok.json.ok, true, JSON.stringify(ok.json.rules));
  assert.equal(ok.json.edited, true);
});

test('publish prepare: schedules HH:MM to the next valid slot', async () => {
  const [p] = await runCode('publish/prepare.js', {
    input: [{ id: 3, status: 'approved', post_text: 'hi 👉 https://www.placidway.com/a', source_url: 'https://www.placidway.com/a', media_path: 'media/post-3.jpg', settings: { dry_run: 'true', post_time: '09:30' } }],
    nodes: { 'When Called': { post_id: 3 } }, env: { TZ: 'Asia/Jakarta' }, mode: 'each',
  });
  const t = new Date(p.json.scheduled_for).getTime();
  assert.ok(t > Date.now() + 14 * 60 * 1000 && t < Date.now() + 25 * 3600 * 1000);
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(t)), '09:30');
  assert.equal(p.json.route, 'photo_upload');
});

test('publish prepare: refuses anything not approved', async () => {
  const [p] = await runCode('publish/prepare.js', { input: [{ id: 3, status: 'pending_approval', post_text: 'x', settings: {} }], nodes: { 'When Called': { post_id: 3 } }, mode: 'each' });
  assert.equal(p.json.skip, true);
});

test('classify FB error: expired token becomes an actionable alert', async () => {
  const [c] = await runCode('publish/classify-error.js', {
    input: [{ error: { message: '401 - {"error":{"message":"Error validating access token: Session has expired","type":"OAuthException","code":190}}', httpCode: '401' } }],
    nodes: { 'Prepare Publish': { post_id: 9, run_id: 'pub-1' } }, mode: 'each',
  });
  assert.equal(c.json.status, 'publish_failed');
  assert.match(c.json.alert.message, /token is invalid or expired/);
});
