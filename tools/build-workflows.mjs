#!/usr/bin/env node
// Builds the n8n workflow JSON files from source.
//
// Code-node logic lives in workflows/src/code/*.js as real, testable files
// (with `// @include lib/x.js` for shared helpers). This script stitches them
// into importable n8n workflows under workflows/*.json.
//
//   node tools/build-workflows.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'workflows', 'src');

export function loadCode(rel) {
  const raw = readFileSync(join(SRC, 'code', rel), 'utf8');
  return raw.replace(/^\/\/ @include (\S+)\s*$/gm, (_, lib) => `// ---- inlined from ${lib} ----\n${readFileSync(join(SRC, lib), 'utf8').trim()}\n// ---- end ${lib} ----`);
}

export const IDS = {
  pipeline: 'pwDailyPipeline1',
  publish: 'pwPublishPost001',
  api: 'pwDashboardApi01',
  engagement: 'pwEngagement0001',
  errors: 'pwErrorHandler01',
};
const PG = { postgres: { id: 'pwPostgresCred01', name: 'PlacidWay App DB' } };

// Deterministic ids keep diffs of the generated JSON readable.
const stableId = (...parts) => {
  const h = createHash('sha1').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ---------- node helpers ----------
function wf(key, name, build, settings = {}) {
  const nodes = [];
  const connections = {};
  const api = {
    node(name, type, typeVersion, position, parameters = {}, extra = {}) {
      nodes.push({ parameters, id: stableId(key, name), name, type, typeVersion, position, ...extra });
      return name;
    },
    link(from, to, out = 0, input = 0) {
      connections[from] ??= { main: [] };
      while (connections[from].main.length <= out) connections[from].main.push([]);
      connections[from].main[out].push({ node: to, type: 'main', index: input });
    },
    chain(...names) { for (let i = 0; i < names.length - 1; i++) api.link(names[i], names[i + 1]); },
    note(content, position, width, height, color = 7) {
      nodes.push({
        parameters: { content, height, width, color },
        id: stableId(key, 'note', content.slice(0, 40)),
        name: `Note ${nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote').length + 1}`,
        type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position,
      });
    },
  };
  build(api);
  return {
    id: IDS[key],
    name,
    active: false,
    isArchived: false,
    nodes,
    connections,
    settings: { executionOrder: 'v1', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner', ...(key === 'errors' ? {} : { errorWorkflow: IDS.errors }), ...settings },
    staticData: null,
    pinData: {},
    meta: { templateCredsSetupCompleted: true },
    tags: [],
    versionId: stableId(key, 'version', String(nodes.length)),
  };
}

const code = (file, mode = 'runOnceForAllItems') => ({ jsCode: loadCode(file), ...(mode === 'each' ? { mode: 'runOnceForEachItem' } : {}) });
const pg = (query, replacement) => ({ operation: 'executeQuery', query, options: replacement ? { queryReplacement: replacement } : {} });
const pgNode = (extra = {}) => ({ credentials: PG, ...extra });
const retry = (tries = 3, wait = 5000) => ({ retryOnFail: true, maxTries: tries, waitBetweenTries: wait });

const boolIf = (expr) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: randomUUID(), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  looseTypeValidation: true,
  options: {},
});
const switchExpr = (n, expr) => ({ mode: 'expression', numberOutputs: n, output: expr });

const bridgeHttp = (bodyExpr) => ({
  method: 'POST',
  url: '={{ $env.LLM_BRIDGE_URL }}/v1/generate',
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'x-bridge-token', value: '={{ $env.LLM_BRIDGE_TOKEN }}' }] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody: bodyExpr,
  options: { timeout: 240000 },
});
const getText = (urlExpr, batching) => ({
  url: urlExpr,
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'User-Agent', value: '={{ $env.PW_USER_AGENT }}' }, { name: 'Accept', value: 'text/html,application/xml;q=0.9,*/*;q=0.8' }] },
  options: {
    ...(batching ? { batching: { batch: { batchSize: 1, batchInterval: 1100 } } } : {}),
    response: { response: { responseFormat: 'text', outputPropertyName: 'data' } },
    timeout: 30000,
  },
});
const graphToken = { name: 'access_token', value: '={{ $env.FB_PAGE_ACCESS_TOKEN }}' };

const FONT = '/usr/share/fonts/truetype/msttcorefonts/';
const PM = "$('Prepare Media').item.json.media";

// =====================================================================
// 1. Daily Post Pipeline
// =====================================================================
const pipeline = wf('pipeline', 'PW · 1 · Daily Post Pipeline', (w) => {
  const Y = 300;
  w.note('## PlacidWay → Facebook daily autopilot\nOne post per day. Triggers: schedule (07:00), manual, or the dashboard **Run now** button.\nErrors route to **PW · 5 · Error Handler** (dashboard alert + optional Slack/Discord webhook).', [-80, -40], 560, 200, 4);
  w.note('### ① Select\nSitemaps → drop used URLs → weekday content-type rotation → avoid repeating recent categories. 4 requests, 1.1 s apart (robots.txt-friendly).', [640, 120], 1140, 400, 7);
  w.note('### ② Extract\nClaim the URL (UNIQUE constraint = never posts twice) → fetch one page → JSON-LD / OpenGraph / HTML fallback.', [1800, 120], 900, 400, 7);
  w.note('### ③ Generate + ④ Guardrails\nClaude writes structured parts (+ a source quote per line) → code assembles the post → deterministic rule checks → independent Claude reviewer → pass, retry with feedback, or escalate to a human.', [2720, 120], 1600, 560, 6);
  w.note('### ⑤ Image\nBrand the featured image, or render a branded card when none exists.', [4340, 60], 980, 640, 7);
  w.note('### ⑥ Save, publish, log\nAuto mode publishes via **PW · 2 · Publish Post**; approval mode waits for the dashboard.', [5340, 120], 1460, 400, 7);

  w.node('Daily 07:00', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 200], { rule: { interval: [{ field: 'days', triggerAtHour: 7 }] } });
  w.node('Manual Run', 'n8n-nodes-base.manualTrigger', 1, [0, 380]);
  w.node('From Dashboard', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, [0, 560], { inputSource: 'passthrough' });
  w.node('Start Run', 'n8n-nodes-base.code', 2, [240, 380], code('start-run.js'));
  w.node('Load Settings', 'n8n-nodes-base.postgres', 2.6, [460, 380], pg(
    `SELECT (SELECT json_object_agg(key, value) FROM settings) AS settings,
       (SELECT coalesce(json_agg(source_url), '[]'::json) FROM posts WHERE status <> 'failed') AS used_urls,
       (SELECT coalesce(json_agg(json_build_object('category', category, 'content_type', content_type)), '[]'::json)
          FROM (SELECT category, content_type FROM posts WHERE status NOT IN ('failed','rejected','drafting')
                ORDER BY created_at DESC LIMIT 10) r) AS recent`), pgNode());
  w.node('Log Run Start', 'n8n-nodes-base.postgres', 2.6, [680, Y], pg(
    `INSERT INTO runs (run_id, workflow, trigger, mode, dry_run, status)
     VALUES ($1, 'pipeline', $2, $3, $4::boolean, 'running') RETURNING id`,
    "={{ [ $('Start Run').first().json.run.run_id, $('Start Run').first().json.run.trigger, $json.settings.publish_mode, $json.settings.dry_run ] }}"), pgNode());
  w.node('Sitemap Targets', 'n8n-nodes-base.code', 2, [900, Y], code('sitemap-targets.js'));
  w.node('Fetch Sitemaps', 'n8n-nodes-base.httpRequest', 4.2, [1120, Y], getText('={{ $json.target.url }}', true), retry(3, 5000));
  w.node('Pick Candidate', 'n8n-nodes-base.code', 2, [1340, Y], code('pick-candidate.js'));
  w.node('Found Item?', 'n8n-nodes-base.if', 2.2, [1560, Y], boolIf('={{ $json.found }}'));
  w.node('Nothing To Post', 'n8n-nodes-base.postgres', 2.6, [1780, Y + 300], pg(
    `UPDATE runs SET status = 'skipped', finished_at = now(), details = $2::jsonb WHERE run_id = $1`,
    "={{ [ $('Pick Candidate').first().json.run.run_id, JSON.stringify({ ...$('Pick Candidate').first().json.selection, note: $('Pick Candidate').first().json.found ? 'URL was claimed by a concurrent run' : 'nothing fresh to post' }) ] }}"), pgNode());
  w.node('Claim URL', 'n8n-nodes-base.postgres', 2.6, [1840, Y], pg(
    `INSERT INTO posts (source_url, content_type, category, title, image_url, status, run_id)
     VALUES ($1, $2, $3, $4, $5, 'drafting', $6)
     ON CONFLICT (source_url) DO UPDATE SET status = 'drafting', run_id = EXCLUDED.run_id, updated_at = now()
       WHERE posts.status = 'failed'
     RETURNING id`,
    '={{ [ $json.item.url, $json.item.type, $json.item.category, $json.item.title_guess, $json.item.image, $json.run.run_id ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Claimed?', 'n8n-nodes-base.if', 2.2, [1840, Y + 200], boolIf('={{ !!$json.id }}'));
  w.node('Polite Delay', 'n8n-nodes-base.wait', 1.1, [2060, Y], { amount: 1.2 });
  w.node('Fetch Page', 'n8n-nodes-base.httpRequest', 4.2, [2280, Y], getText("={{ $('Pick Candidate').first().json.item.url }}"), retry(3, 5000));
  w.node('Extract Content', 'n8n-nodes-base.code', 2, [2500, Y], code('extract-content.js'));

  w.node('Build Prompt', 'n8n-nodes-base.code', 2, [2780, Y], code('build-prompt.js', 'each'));
  w.node('Write Post (Claude)', 'n8n-nodes-base.httpRequest', 4.2, [3000, Y], bridgeHttp('={{ JSON.stringify($json.llm_request) }}'), retry(2, 8000));
  w.node('Assemble Post', 'n8n-nodes-base.code', 2, [3220, Y], code('assemble-post.js', 'each'));
  w.node('Rule-Based Checks', 'n8n-nodes-base.code', 2, [3440, Y], code('rule-checks.js', 'each'));
  w.node('Build Review Prompt', 'n8n-nodes-base.code', 2, [3660, Y], code('build-review.js', 'each'));
  w.node('Fact-Check (Claude)', 'n8n-nodes-base.httpRequest', 4.2, [3880, Y], bridgeHttp('={{ JSON.stringify($json.llm_request) }}'), { ...retry(2, 8000), onError: 'continueRegularOutput' });
  w.node('Guardrail Verdict', 'n8n-nodes-base.code', 2, [4100, Y], code('guardrail-verdict.js', 'each'));
  w.node('Retry?', 'n8n-nodes-base.if', 2.2, [4100, Y + 260], boolIf("={{ $json.route === 'retry' }}"));

  w.node('Prepare Media', 'n8n-nodes-base.code', 2, [4400, Y], code('prepare-media.js', 'each'));
  w.node('Media Route', 'n8n-nodes-base.switch', 3.2, [4620, Y], switchExpr(3, "={{ ['brand', 'card', 'none'].indexOf($json.media.route) }}"));
  w.node('Download Image', 'n8n-nodes-base.httpRequest', 4.2, [4840, Y - 160], {
    url: '={{ $json.media.download_url }}',
    options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } }, timeout: 30000 },
  }, { ...retry(2, 3000), onError: 'continueErrorOutput' });
  // Text needs explicit alignment in multiStep mode (without it nothing renders).
  // With north gravity, y lands on the text baseline; 'east' measures x from the right edge.
  const T = (text, x, y, size, color, font = 'Arial.ttf', lineLength = 80, align = 'west') => ({
    operation: 'text', text, fontSize: size, fontColor: color, positionX: x, positionY: y, lineLength,
    font: `${FONT}${font}`, horizontalAlignment: align, verticalAlignment: 'north',
  });
  const R = (color, x1, y1, x2, y2) => ({ operation: 'draw', primitive: 'rectangle', color, startPositionX: x1, startPositionY: y1, endPositionX: x2, endPositionY: y2 });
  const brandBar = (x0) => [
    R('#222222', 0, 560, 1200, 630),
    R('#E85A4F', 0, 554, 1200, 560),
    R('#E85A4F', x0, 579, x0 + 10, 611),
    T('PlacidWay', x0 + 24, 606, 30, '#FFFFFF', 'Arial_Bold.ttf', 40),
  ];
  w.node('Brand Image', 'n8n-nodes-base.editImage', 1.1, [5060, Y - 160], {
    operation: 'multiStep',
    operations: { operations: [
      { operation: 'resize', width: 1200, height: 630, resizeOption: 'minimumArea' },
      { operation: 'crop', width: 1200, height: 630, positionX: 0, positionY: 0 },
      ...brandBar(40),
      T(`={{ ${PM}.label + '   ·   ' + ${PM}.category }}`, 232, 603, 19, '#F2C79C'),
      T('placidway.com', 40, 603, 19, '#BDB6AE', 'Arial.ttf', 40, 'east'),
    ] },
    options: { format: 'jpeg', quality: 88 },
  });
  w.node('Render Card', 'n8n-nodes-base.editImage', 1.1, [5060, Y + 60], {
    operation: 'multiStep',
    operations: { operations: [
      { operation: 'create', backgroundColor: '#F3F0EB', width: 1200, height: 630 },
      R('#E85A4F', 0, 0, 16, 554),
      R('#F2C79C', 80, 128, 160, 132),
      T(`={{ ${PM}.label }}`, 80, 110, 22, '#A9362D', 'Arial_Bold.ttf', 60),
      T(`={{ ${PM}.title }}`, 80, 210, 54, '#222222', 'Georgia_Bold.ttf', 32),
      T(`={{ ${PM}.category }}`, 80, 522, 19, '#6B6560', 'Arial.ttf', 80),
      ...brandBar(80),
      T('placidway.com', 40, 603, 19, '#BDB6AE', 'Arial.ttf', 40, 'east'),
    ] },
    options: { format: 'jpeg', quality: 90 },
  });
  w.node('Save Media', 'n8n-nodes-base.readWriteFile', 1, [5200, Y - 40], {
    operation: 'write',
    fileName: `=/files/media/{{ ${PM}.file }}`,
    dataPropertyName: 'data',
    options: {},
  });
  w.node('Draft Record', 'n8n-nodes-base.code', 2, [5420, Y], code('draft-record.js', 'each'));
  w.node('Save Draft', 'n8n-nodes-base.postgres', 2.6, [5720, Y], pg(
    `UPDATE posts SET title = $2, summary = $3, category = $4, image_url = $5, media_path = $6, source_excerpt = $7,
       source_published_at = $8::timestamptz, post_text = $9, hook = $10,
       hashtags = ARRAY(SELECT jsonb_array_elements_text($11::jsonb)), claims = $12::jsonb, guardrail = $13::jsonb,
       attempts = $14, status = $15, dry_run = $16::boolean, run_id = $17, updated_at = now()
     WHERE id = $1 RETURNING id, status`,
    '={{ $json.params }}'), pgNode());
  w.node('Auto-Publish?', 'n8n-nodes-base.if', 2.2, [5940, Y], boolIf("={{ $json.status === 'approved' }}"));
  w.node('Publish Post', 'n8n-nodes-base.executeWorkflow', 1.2, [6160, Y - 100], {
    workflowId: { __rl: true, value: IDS.publish, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: true },
  });
  w.node('Finish Run', 'n8n-nodes-base.code', 2, [6380, Y], code('finish-run.js'));
  w.node('Close Run', 'n8n-nodes-base.postgres', 2.6, [6600, Y], pg(
    `UPDATE runs SET status = $2, post_id = $3, fb_post_id = $4, error = $5, details = $6::jsonb,
       item_url = (SELECT source_url FROM posts WHERE id = $3), finished_at = now()
     WHERE run_id = $1`,
    '={{ [ $json.run_id, $json.status, $json.post_id, $json.fb_post_id, $json.error, $json.details ] }}'), pgNode());

  ['Daily 07:00', 'Manual Run', 'From Dashboard'].forEach((t) => w.link(t, 'Start Run'));
  w.chain('Start Run', 'Load Settings', 'Log Run Start', 'Sitemap Targets', 'Fetch Sitemaps', 'Pick Candidate', 'Found Item?');
  w.link('Found Item?', 'Claim URL', 0);
  w.link('Found Item?', 'Nothing To Post', 1);
  w.link('Claim URL', 'Claimed?');
  w.link('Claimed?', 'Polite Delay', 0);
  w.link('Claimed?', 'Nothing To Post', 1);
  w.chain('Polite Delay', 'Fetch Page', 'Extract Content', 'Build Prompt', 'Write Post (Claude)', 'Assemble Post',
    'Rule-Based Checks', 'Build Review Prompt', 'Fact-Check (Claude)', 'Guardrail Verdict', 'Retry?');
  w.link('Retry?', 'Build Prompt', 0);
  w.link('Retry?', 'Prepare Media', 1);
  w.link('Prepare Media', 'Media Route');
  w.link('Media Route', 'Download Image', 0);
  w.link('Media Route', 'Render Card', 1);
  w.link('Media Route', 'Draft Record', 2);
  w.link('Download Image', 'Brand Image', 0);
  w.link('Download Image', 'Render Card', 1);
  w.link('Brand Image', 'Save Media');
  w.link('Render Card', 'Save Media');
  w.chain('Save Media', 'Draft Record', 'Save Draft', 'Auto-Publish?');
  w.link('Auto-Publish?', 'Publish Post', 0);
  w.link('Auto-Publish?', 'Finish Run', 1);
  w.link('Publish Post', 'Finish Run');
  w.link('Finish Run', 'Close Run');
});

// =====================================================================
// 2. Publish Post (sub-workflow; used by auto mode and dashboard approval)
// =====================================================================
const publish = wf('publish', 'PW · 2 · Publish Post', (w) => {
  const Y = 300;
  w.note('## Publish one approved post\nCalled by the pipeline (auto mode) and the dashboard (approve / retry).\n**dry_run** simulates the Graph calls; otherwise: upload photo unpublished → create feed post (immediate or natively scheduled).\nFacebook errors are classified (expired token, rate limit, permissions, network) and raised as alerts.', [-60, -60], 700, 220, 4);
  w.node('When Called', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, [0, Y], { inputSource: 'passthrough' });
  w.node('Load Post', 'n8n-nodes-base.postgres', 2.6, [220, Y], pg(
    `SELECT p.*, (SELECT json_object_agg(key, value) FROM settings) AS settings FROM posts p WHERE p.id = $1`,
    '={{ [ $json.post_id ?? $json.id ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Prepare Publish', 'n8n-nodes-base.code', 2, [440, Y], code('publish/prepare.js', 'each'));
  w.node('Skip?', 'n8n-nodes-base.if', 2.2, [660, Y], boolIf('={{ !!$json.skip }}'));
  w.node('Skipped', 'n8n-nodes-base.code', 2, [880, Y - 200], { jsCode: "return $input.all().map((i) => ({ json: { post_id: i.json.post_id, status: i.json.status, skipped: true, error: i.json.reason } }));" });
  w.node('Log Publish Start', 'n8n-nodes-base.postgres', 2.6, [880, Y], pg(
    `INSERT INTO runs (run_id, workflow, trigger, dry_run, status, post_id, item_url)
     VALUES ($1, 'publish', $2, $3::boolean, 'running', $4, (SELECT source_url FROM posts WHERE id = $4)) RETURNING id`,
    '={{ [ $json.run_id, $json.trigger, $json.dry_run, $json.post_id ] }}'), pgNode());
  w.node('Dry Run?', 'n8n-nodes-base.if', 2.2, [1100, Y], boolIf("={{ $('Prepare Publish').item.json.dry_run }}"));
  w.node('Simulate Publish', 'n8n-nodes-base.code', 2, [1320, Y - 220], code('publish/simulate.js', 'each'));
  w.node('Publish Route', 'n8n-nodes-base.switch', 3.2, [1320, Y + 100], switchExpr(3, "={{ ['photo_upload', 'photo_url', 'feed'].indexOf($('Prepare Publish').item.json.route) }}"));
  w.node('Read Image File', 'n8n-nodes-base.readWriteFile', 1, [1540, Y], { operation: 'read', fileSelector: "={{ $('Prepare Publish').item.json.media_file }}", options: { dataPropertyName: 'data' } });
  w.node('FB Upload Photo', 'n8n-nodes-base.httpRequest', 4.2, [1760, Y], {
    method: 'POST',
    url: "={{ $('Prepare Publish').item.json.graph }}/{{ $('Prepare Publish').item.json.page_id }}/photos",
    sendQuery: true, queryParameters: { parameters: [graphToken] },
    sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: [
      { parameterType: 'formBinaryData', name: 'source', inputDataFieldName: 'data' },
      { name: 'published', value: 'false' },
      { name: 'temporary', value: "={{ $('Prepare Publish').item.json.scheduled ? 'true' : 'false' }}" },
    ] },
    options: { timeout: 60000 },
  }, { ...retry(3, 10000), onError: 'continueErrorOutput' });
  w.node('FB Photo From URL', 'n8n-nodes-base.httpRequest', 4.2, [1760, Y + 200], {
    method: 'POST',
    url: "={{ $('Prepare Publish').item.json.graph }}/{{ $('Prepare Publish').item.json.page_id }}/photos",
    sendQuery: true, queryParameters: { parameters: [graphToken] },
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ url: $('Prepare Publish').item.json.image_url, published: false, temporary: $('Prepare Publish').item.json.scheduled }) }}",
    options: { timeout: 60000 },
  }, { ...retry(3, 10000), onError: 'continueErrorOutput' });
  w.node('Attach Media', 'n8n-nodes-base.code', 2, [1980, Y + 100], code('publish/attach-media.js', 'each'));
  w.node('FB Create Post', 'n8n-nodes-base.httpRequest', 4.2, [2200, Y + 100], {
    method: 'POST',
    url: '={{ $json.graph }}/{{ $json.page_id }}/feed',
    sendQuery: true, queryParameters: { parameters: [graphToken] },
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.fb_body) }}',
    options: { timeout: 60000 },
  }, { ...retry(3, 10000), onError: 'continueErrorOutput' });
  w.node('Normalize FB Response', 'n8n-nodes-base.code', 2, [2420, Y + 20], code('publish/normalize.js', 'each'));
  w.node('Get Permalink', 'n8n-nodes-base.httpRequest', 4.2, [2640, Y + 20], {
    url: '={{ $json.graph }}/{{ $json.fb_post_id }}',
    sendQuery: true, queryParameters: { parameters: [{ name: 'fields', value: 'permalink_url' }, graphToken] },
    options: { timeout: 20000 },
  }, { onError: 'continueRegularOutput' });
  w.node('Add Permalink', 'n8n-nodes-base.code', 2, [2860, Y + 20], code('publish/add-permalink.js', 'each'));
  w.node('Instagram?', 'n8n-nodes-base.if', 2.2, [3080, Y + 20], boolIf('={{ $json.crosspost_ig && !$json.scheduled && !!$json.fb_photo_id && !!$env.IG_USER_ID }}'));
  w.node('IG Photo URL', 'n8n-nodes-base.httpRequest', 4.2, [3300, Y + 200], {
    url: '={{ $json.graph }}/{{ $json.fb_photo_id }}',
    sendQuery: true, queryParameters: { parameters: [{ name: 'fields', value: 'images' }, graphToken] },
  }, { onError: 'continueRegularOutput' });
  w.node('IG Create Container', 'n8n-nodes-base.httpRequest', 4.2, [3520, Y + 200], {
    method: 'POST',
    url: "={{ $('Add Permalink').item.json.graph }}/{{ $env.IG_USER_ID }}/media",
    sendQuery: true, queryParameters: { parameters: [graphToken] },
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ image_url: ($json.images || [{}])[0].source, caption: $('Add Permalink').item.json.message.replace(/👉\\s*https?:\\/\\/\\S+/u, 'Read more on placidway.com') }) }}",
  }, { onError: 'continueRegularOutput' });
  w.node('IG Publish', 'n8n-nodes-base.httpRequest', 4.2, [3740, Y + 200], {
    method: 'POST',
    url: "={{ $('Add Permalink').item.json.graph }}/{{ $env.IG_USER_ID }}/media_publish",
    sendQuery: true, queryParameters: { parameters: [graphToken, { name: 'creation_id', value: '={{ $json.id }}' }] },
  }, { onError: 'continueRegularOutput' });
  w.node('IG Result', 'n8n-nodes-base.code', 2, [3960, Y + 200], code('publish/ig-result.js', 'each'));
  w.node('Classify FB Error', 'n8n-nodes-base.code', 2, [2420, Y + 360], code('publish/classify-error.js', 'each'));

  w.node('Outcome', 'n8n-nodes-base.noOp', 1, [4180, Y]);
  w.node('Save Outcome', 'n8n-nodes-base.postgres', 2.6, [4400, Y], pg(
    `UPDATE posts SET status = $2, fb_post_id = $3, fb_permalink = $4, ig_media_id = $5, scheduled_for = $6::timestamptz,
       published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
       error = $7, dry_run = $8::boolean, updated_at = now()
     WHERE id = $1 RETURNING id`,
    '={{ [ $json.post_id, $json.status, $json.fb_post_id || null, $json.fb_permalink || null, $json.ig_media_id || null, $json.scheduled_for || null, $json.error || null, $json.dry_run ] }}'), pgNode());
  w.node('Close Publish Run', 'n8n-nodes-base.postgres', 2.6, [4620, Y], pg(
    `UPDATE runs SET status = CASE WHEN $2 = 'publish_failed' THEN 'error' ELSE 'success' END,
       fb_post_id = $3, error = $4, details = $5::jsonb, finished_at = now()
     WHERE run_id = $1`,
    "={{ [ $('Outcome').item.json.run_id, $('Outcome').item.json.status, $('Outcome').item.json.fb_post_id || null, $('Outcome').item.json.error || null, JSON.stringify({ status: $('Outcome').item.json.status, scheduled_for: $('Outcome').item.json.scheduled_for, route: $('Outcome').item.json.route, simulated_request: $('Outcome').item.json.simulated_request || null }) ] }}"), pgNode());
  w.node('Has Alert?', 'n8n-nodes-base.if', 2.2, [4840, Y], boolIf("={{ !!$('Outcome').item.json.alert }}"));
  w.node('Insert Alert', 'n8n-nodes-base.postgres', 2.6, [5060, Y - 160], pg(
    `INSERT INTO alerts (severity, source, message, details) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    "={{ [ $('Outcome').item.json.alert.severity, $('Outcome').item.json.alert.source, $('Outcome').item.json.alert.message, $('Outcome').item.json.alert.details ] }}"), pgNode());
  w.node('Alert Webhook?', 'n8n-nodes-base.if', 2.2, [5280, Y - 160], boolIf('={{ !!$env.ALERT_WEBHOOK_URL }}'));
  w.node('Send Alert', 'n8n-nodes-base.httpRequest', 4.2, [5500, Y - 260], {
    method: 'POST', url: '={{ $env.ALERT_WEBHOOK_URL }}', sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ text: ':rotating_light: PlacidWay Autopilot: ' + $('Outcome').item.json.alert.message, content: 'PlacidWay Autopilot: ' + $('Outcome').item.json.alert.message }) }}",
  }, { ...retry(2, 3000), onError: 'continueRegularOutput' });
  w.node('Result', 'n8n-nodes-base.code', 2, [5720, Y], code('publish/result.js', 'each'));

  w.chain('When Called', 'Load Post', 'Prepare Publish', 'Skip?');
  w.link('Skip?', 'Skipped', 0);
  w.link('Skip?', 'Log Publish Start', 1);
  w.link('Log Publish Start', 'Dry Run?');
  w.link('Dry Run?', 'Simulate Publish', 0);
  w.link('Dry Run?', 'Publish Route', 1);
  w.link('Simulate Publish', 'Outcome');
  w.link('Publish Route', 'Read Image File', 0);
  w.link('Publish Route', 'FB Photo From URL', 1);
  w.link('Publish Route', 'Attach Media', 2);
  w.link('Read Image File', 'FB Upload Photo');
  w.link('FB Upload Photo', 'Attach Media', 0);
  w.link('FB Upload Photo', 'Classify FB Error', 1);
  w.link('FB Photo From URL', 'Attach Media', 0);
  w.link('FB Photo From URL', 'Classify FB Error', 1);
  w.link('Attach Media', 'FB Create Post');
  w.link('FB Create Post', 'Normalize FB Response', 0);
  w.link('FB Create Post', 'Classify FB Error', 1);
  w.chain('Normalize FB Response', 'Get Permalink', 'Add Permalink', 'Instagram?');
  w.link('Instagram?', 'IG Photo URL', 0);
  w.link('Instagram?', 'Outcome', 1);
  w.chain('IG Photo URL', 'IG Create Container', 'IG Publish', 'IG Result', 'Outcome');
  w.link('Classify FB Error', 'Outcome');
  w.chain('Outcome', 'Save Outcome', 'Close Publish Run', 'Has Alert?');
  w.link('Has Alert?', 'Insert Alert', 0);
  w.link('Has Alert?', 'Result', 1);
  w.link('Insert Alert', 'Alert Webhook?');
  w.link('Alert Webhook?', 'Send Alert', 0);
  w.link('Alert Webhook?', 'Result', 1);
  w.link('Send Alert', 'Result');
});

// =====================================================================
// 3. Dashboard API (webhooks behind the nginx dashboard)
// =====================================================================
const authIf = boolIf("={{ $json.headers['x-pw-token'] === $env.PW_API_TOKEN && !!$env.PW_API_TOKEN }}");
const respond = (body, code = 200) => ({ respondWith: 'json', responseBody: body, options: { responseCode: code } });

const api = wf('api', 'PW · 3 · Dashboard API', (w) => {
  w.note('## Dashboard API\nServed at **/api/** by the nginx dashboard container, which injects the shared `x-pw-token` header.\n`GET /api/state` → everything the dashboard renders.\n`POST /api/action` → approve · retry · reject · settings · run · ack · engagement.\nHuman approvals are re-checked against the hard guardrail rules (an edit cannot sneak in a medical claim).', [-60, -80], 760, 240, 4);
  w.node('GET /state', 'n8n-nodes-base.webhook', 2, [0, 260], { httpMethod: 'GET', path: 'pw/state', responseMode: 'responseNode', options: {} }, { webhookId: stableId('api', 'state-hook') });
  w.node('Authorized?', 'n8n-nodes-base.if', 2.2, [220, 260], authIf);
  w.node('Load Dashboard', 'n8n-nodes-base.postgres', 2.6, [440, 180], pg(
    `SELECT json_build_object(
      'settings', (SELECT json_object_agg(key, json_build_object('value', value, 'description', description, 'updated_at', updated_at)) FROM settings),
      'counts', (SELECT coalesce(json_object_agg(status, n), '{}'::json) FROM (SELECT status, count(*) n FROM posts GROUP BY status) c),
      'posts', (SELECT coalesce(json_agg(x ORDER BY x.created_at DESC), '[]'::json) FROM (
          SELECT p.id, p.source_url, p.content_type, p.category, p.title, p.summary, p.image_url, p.media_path, p.source_excerpt,
                 p.post_text, p.hashtags, p.claims, p.guardrail, p.attempts, p.status, p.dry_run, p.scheduled_for,
                 p.fb_post_id, p.fb_permalink, p.ig_media_id, p.edited, p.reviewed_by, p.review_note, p.error,
                 p.created_at, p.updated_at, p.published_at, p.source_published_at,
                 e.reactions, e.comments, e.shares, e.clicks, e.fetched_at AS engagement_at
          FROM posts p LEFT JOIN post_latest_engagement e ON e.post_id = p.id
          ORDER BY p.created_at DESC LIMIT 60) x),
      'runs', (SELECT coalesce(json_agg(r ORDER BY r.started_at DESC), '[]'::json) FROM (SELECT * FROM runs ORDER BY started_at DESC LIMIT 40) r),
      'alerts', (SELECT coalesce(json_agg(a ORDER BY a.created_at DESC), '[]'::json) FROM (SELECT * FROM alerts WHERE NOT acknowledged ORDER BY created_at DESC LIMIT 20) a),
      'server_time', now(),
      'env', json_build_object('fb_configured', $1::boolean, 'ig_configured', $2::boolean, 'tz', $3::text, 'llm_backend', $4::text,
                               'writer_model', $5::text, 'reviewer_model', $6::text)
    ) AS state`,
    "={{ [ !!($env.FB_PAGE_ID && $env.FB_PAGE_ACCESS_TOKEN), !!$env.IG_USER_ID, $env.GENERIC_TIMEZONE || 'UTC', $env.LLM_BACKEND || 'cli', $env.LLM_MODEL_WRITER || 'sonnet', $env.LLM_MODEL_REVIEWER || 'haiku' ] }}"), pgNode());
  w.node('Respond State', 'n8n-nodes-base.respondToWebhook', 1.1, [660, 180], respond('={{ JSON.stringify($json.state) }}'));
  w.node('Respond 401', 'n8n-nodes-base.respondToWebhook', 1.1, [440, 360], respond('{"ok":false,"error":"unauthorized"}', 401));
  w.link('GET /state', 'Authorized?');
  w.link('Authorized?', 'Load Dashboard', 0);
  w.link('Authorized?', 'Respond 401', 1);
  w.link('Load Dashboard', 'Respond State');

  const Y = 700;
  w.node('POST /action', 'n8n-nodes-base.webhook', 2, [0, Y], { httpMethod: 'POST', path: 'pw/action', responseMode: 'responseNode', options: {} }, { webhookId: stableId('api', 'action-hook') });
  w.node('Authorized? ', 'n8n-nodes-base.if', 2.2, [220, Y], authIf);
  w.node('Respond 401 ', 'n8n-nodes-base.respondToWebhook', 1.1, [440, Y + 160], respond('{"ok":false,"error":"unauthorized"}', 401));
  w.node('Route Action', 'n8n-nodes-base.code', 2, [440, Y], code('api/route.js', 'each'));
  w.node('Action', 'n8n-nodes-base.switch', 3.2, [660, Y], switchExpr(7,
    "={{ ({ approve: 0, retry: 0, reject: 1, settings: 2, run: 3, ack: 4, engagement: 5 })[$json.action] ?? 6 }}"));

  // approve / retry
  w.node('Load For Approval', 'n8n-nodes-base.postgres', 2.6, [900, Y - 300], pg(
    `SELECT id, status, post_text, source_url, source_excerpt, claims FROM posts WHERE id = $1`, '={{ [ $json.id ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Check Approval', 'n8n-nodes-base.code', 2, [1120, Y - 300], code('api/check-approval.js', 'each'));
  w.node('Approval OK?', 'n8n-nodes-base.if', 2.2, [1340, Y - 300], boolIf('={{ $json.ok }}'));
  w.node('Mark Approved', 'n8n-nodes-base.postgres', 2.6, [1560, Y - 380], pg(
    `UPDATE posts SET status = 'approved', post_text = $2, edited = edited OR $3::boolean, reviewed_by = $4, updated_at = now()
     WHERE id = $1 RETURNING id AS post_id, 'approval' AS trigger`,
    '={{ [ $json.id, $json.post_text, $json.edited, $json.reviewer ] }}'), pgNode());
  w.node('Publish Approved', 'n8n-nodes-base.executeWorkflow', 1.2, [1780, Y - 380], {
    workflowId: { __rl: true, value: IDS.publish, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: true },
  });
  w.node('Respond Published', 'n8n-nodes-base.respondToWebhook', 1.1, [2000, Y - 380], respond("={{ JSON.stringify({ ok: $json.status !== 'publish_failed', result: $json }) }}"));
  w.node('Respond Blocked', 'n8n-nodes-base.respondToWebhook', 1.1, [1560, Y - 200], respond('={{ JSON.stringify($json) }}', '={{ $json.code || 400 }}'));

  // reject
  w.node('Mark Rejected', 'n8n-nodes-base.postgres', 2.6, [900, Y - 100], pg(
    `UPDATE posts SET status = 'rejected', review_note = $2, reviewed_by = $3, updated_at = now()
     WHERE id = $1 AND status IN ('pending_approval', 'needs_review', 'publish_failed') RETURNING id, status`,
    '={{ [ $json.id, $json.note, $json.reviewer ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Respond Rejected', 'n8n-nodes-base.respondToWebhook', 1.1, [1120, Y - 100], respond("={{ JSON.stringify({ ok: !!$json.id, result: $json }) }}"));

  // settings
  w.node('Validate Settings', 'n8n-nodes-base.code', 2, [900, Y + 60], code('api/settings.js'));
  w.node('Save Settings', 'n8n-nodes-base.postgres', 2.6, [1120, Y + 60], pg(
    `UPDATE settings SET value = $2, updated_at = now() WHERE key = $1 RETURNING key, value`, '={{ [ $json.key, $json.value ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Respond Settings', 'n8n-nodes-base.respondToWebhook', 1.1, [1340, Y + 60], respond("={{ JSON.stringify({ ok: true, saved: $input.all().map(i => i.json.key).filter(Boolean) }) }}"));

  // run now
  w.node('Start Pipeline', 'n8n-nodes-base.executeWorkflow', 1.2, [900, Y + 220], {
    workflowId: { __rl: true, value: IDS.pipeline, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: false },
  });
  w.node('Respond Started', 'n8n-nodes-base.respondToWebhook', 1.1, [1120, Y + 220], respond('{"ok":true,"started":true}'));

  // ack alerts
  w.node('Ack Alerts', 'n8n-nodes-base.postgres', 2.6, [900, Y + 380], pg(
    `UPDATE alerts SET acknowledged = true WHERE ($1::int IS NULL OR id = $1::int) AND NOT acknowledged RETURNING id`, '={{ [ $json.id ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Respond Acked', 'n8n-nodes-base.respondToWebhook', 1.1, [1120, Y + 380], respond('{"ok":true}'));

  // engagement refresh
  w.node('Refresh Engagement', 'n8n-nodes-base.executeWorkflow', 1.2, [900, Y + 540], {
    workflowId: { __rl: true, value: IDS.engagement, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: true },
  }, { alwaysOutputData: true });
  w.node('Respond Refreshed', 'n8n-nodes-base.respondToWebhook', 1.1, [1120, Y + 540], respond('{"ok":true}'));

  w.node('Respond 400', 'n8n-nodes-base.respondToWebhook', 1.1, [900, Y + 700], respond("={{ JSON.stringify({ ok: false, error: $json.error || 'bad request' }) }}", 400));

  w.link('POST /action', 'Authorized? ');
  w.link('Authorized? ', 'Route Action', 0);
  w.link('Authorized? ', 'Respond 401 ', 1);
  w.link('Route Action', 'Action');
  w.link('Action', 'Load For Approval', 0);
  w.link('Action', 'Mark Rejected', 1);
  w.link('Action', 'Validate Settings', 2);
  w.link('Action', 'Start Pipeline', 3);
  w.link('Action', 'Ack Alerts', 4);
  w.link('Action', 'Refresh Engagement', 5);
  w.link('Action', 'Respond 400', 6);
  w.chain('Load For Approval', 'Check Approval', 'Approval OK?');
  w.link('Approval OK?', 'Mark Approved', 0);
  w.link('Approval OK?', 'Respond Blocked', 1);
  w.chain('Mark Approved', 'Publish Approved', 'Respond Published');
  w.link('Mark Rejected', 'Respond Rejected');
  w.chain('Validate Settings', 'Save Settings', 'Respond Settings');
  w.link('Start Pipeline', 'Respond Started');
  w.link('Ack Alerts', 'Respond Acked');
  w.link('Refresh Engagement', 'Respond Refreshed');
});

// =====================================================================
// 4. Engagement read-back
// =====================================================================
const engagement = wf('engagement', 'PW · 4 · Engagement Read-back', (w) => {
  w.note('## Engagement read-back (every 6 h)\nSettles natively-scheduled posts whose time has passed, then stores a reactions / comments / shares / clicks snapshot next to each live post (last 30 days). Dry-run posts are skipped: there is nothing real to read.', [-60, -60], 640, 200, 4);
  w.node('Every 6 Hours', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 200], { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } });
  w.node('Manual Refresh', 'n8n-nodes-base.manualTrigger', 1, [0, 380]);
  w.node('From Dashboard', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, [0, 560], { inputSource: 'passthrough' });
  w.node('Settle Scheduled', 'n8n-nodes-base.postgres', 2.6, [240, 380], pg(
    `UPDATE posts SET status = 'published', published_at = scheduled_for, updated_at = now()
     WHERE status = 'scheduled' AND scheduled_for <= now() RETURNING id`), pgNode({ alwaysOutputData: true, executeOnce: true }));
  w.node('Published Posts', 'n8n-nodes-base.postgres', 2.6, [460, 380], pg(
    `SELECT id, fb_post_id FROM posts
     WHERE status = 'published' AND dry_run = false AND fb_post_id IS NOT NULL AND published_at > now() - interval '30 days'
     ORDER BY published_at DESC`), pgNode({ executeOnce: true }));
  w.node('Read Engagement', 'n8n-nodes-base.httpRequest', 4.2, [680, 380], {
    url: "={{ 'https://graph.facebook.com/' + ($env.FB_GRAPH_VERSION || 'v24.0') + '/' + $json.fb_post_id }}",
    sendQuery: true,
    queryParameters: { parameters: [{ name: 'fields', value: 'reactions.summary(total_count),comments.summary(total_count),shares,insights.metric(post_clicks)' }, graphToken] },
    options: { batching: { batch: { batchSize: 5, batchInterval: 1000 } }, timeout: 20000 },
  }, { ...retry(2, 5000), onError: 'continueRegularOutput' });
  w.node('Normalize Engagement', 'n8n-nodes-base.code', 2, [900, 380], code('ops/engagement-normalize.js'));
  w.node('Store Snapshot', 'n8n-nodes-base.postgres', 2.6, [1120, 380], pg(
    `INSERT INTO engagement (post_id, reactions, comments, shares, clicks, raw) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    '={{ [ $json.post_id, $json.reactions, $json.comments, $json.shares, $json.clicks, $json.raw ] }}'), pgNode());
  ['Every 6 Hours', 'Manual Refresh', 'From Dashboard'].forEach((t) => w.link(t, 'Settle Scheduled'));
  w.chain('Settle Scheduled', 'Published Posts', 'Read Engagement', 'Normalize Engagement', 'Store Snapshot');
});

// =====================================================================
// 5. Error handler
// =====================================================================
const errors = wf('errors', 'PW · 5 · Error Handler', (w) => {
  w.note('## Never fail silently\nSet as the error workflow of every PW workflow. Records an alert (shown as a banner on the dashboard), closes the run as `error`, releases any half-drafted post so tomorrow can retry it, and pings an optional Slack/Discord webhook.', [-60, -60], 640, 200, 4);
  w.node('On Workflow Error', 'n8n-nodes-base.errorTrigger', 1, [0, 300]);
  w.node('Format Alert', 'n8n-nodes-base.code', 2, [220, 300], code('ops/error-format.js', 'each'));
  w.node('Record Alert', 'n8n-nodes-base.postgres', 2.6, [440, 300], pg(
    `WITH a AS (INSERT INTO alerts (severity, source, message, details) VALUES ($1, $2, $3, $4::jsonb) RETURNING id),
          r AS (UPDATE runs SET status = 'error', error = $3, finished_at = now() WHERE run_id = $5 AND status = 'running' RETURNING id)
     UPDATE posts SET status = 'failed', error = $3, updated_at = now()
     WHERE run_id = $5 AND status = 'drafting' RETURNING id`,
    '={{ [ $json.severity, $json.source, $json.message, $json.details, $json.run_id ] }}'), pgNode({ alwaysOutputData: true }));
  w.node('Webhook Configured?', 'n8n-nodes-base.if', 2.2, [660, 300], boolIf('={{ !!$env.ALERT_WEBHOOK_URL }}'));
  w.node('Send Alert', 'n8n-nodes-base.httpRequest', 4.2, [880, 220], {
    method: 'POST', url: '={{ $env.ALERT_WEBHOOK_URL }}', sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ text: $('Format Alert').item.json.text, content: $('Format Alert').item.json.text }) }}",
  }, { ...retry(3, 5000), onError: 'continueRegularOutput' });
  w.chain('On Workflow Error', 'Format Alert', 'Record Alert', 'Webhook Configured?');
  w.link('Webhook Configured?', 'Send Alert', 0);
});

const all = { pipeline, publish, api, engagement, errors };
const files = {
  pipeline: '1-daily-post-pipeline.json',
  publish: '2-publish-post.json',
  api: '3-dashboard-api.json',
  engagement: '4-engagement-readback.json',
  errors: '5-error-handler.json',
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The dashboard runs the exact same rule engine in the browser for live edit checks.
  mkdirSync(join(ROOT, 'dashboard', 'vendor'), { recursive: true });
  writeFileSync(join(ROOT, 'dashboard', 'vendor', 'guardrails.js'),
    `// GENERATED from workflows/src/lib/guardrails.js by tools/build-workflows.mjs. Do not edit.\n${readFileSync(join(SRC, 'lib', 'guardrails.js'), 'utf8')}`);
  for (const [k, w] of Object.entries(all)) {
    writeFileSync(join(ROOT, 'workflows', files[k]), JSON.stringify(w, null, 2) + '\n');
    console.log(`built workflows/${files[k]}  (${w.nodes.length} nodes)`);
  }
}
