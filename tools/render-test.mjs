// Dev helper: renders the pipeline's real "Brand Image" and "Render Card" node
// configs against sample data, so image layout can be checked without an LLM run.
//   node tools/render-test.mjs && (import + execute inside the n8n container)
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const wf = JSON.parse(execSync('node tools/build-workflows.mjs >/dev/null && cat workflows/1-daily-post-pipeline.json').toString());
const pick = (n) => JSON.parse(JSON.stringify(wf.nodes.find((x) => x.name === n)));
const media = {
  file: 'x', label: 'PATIENT GUIDE', category: 'BARIATRIC & WEIGHT LOSS',
  title: 'Lost Weight With Ozempic or Mounjaro? Why Patients Are Considering Body Contouring in Mexico',
  download_url: 'https://www.placidway.com/cdn-cgi/image/quality=85,fit=cover,gravity=auto,width=1200,height=630/https://placidwaycdn.s3.amazonaws.com/images/article_thumb/1792406582Images-(PS)-(5).png',
};
const fix = (node) => { const s = JSON.stringify(node).replaceAll("$('Prepare Media').item.json.media", '$json.media'); return JSON.parse(s); };
const brand = { ...fix(pick('Brand Image')), position: [600, 0] };
const card = { ...fix(pick('Render Card')), position: [600, 200] };
brand.parameters.operations.operations.forEach((o) => { if (typeof o.text === 'string') o.text = o.text.replaceAll('$json.media', "$('Sample').item.json.media"); });
const nodes = [
  { parameters: {}, id: 't1', name: 'Go', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0] },
  { parameters: { jsCode: `return [{ json: { media: ${JSON.stringify(media)} } }];` }, id: 't2', name: 'Sample', type: 'n8n-nodes-base.code', typeVersion: 2, position: [200, 0] },
  { parameters: { url: '={{ $json.media.download_url }}', options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } } }, id: 't3', name: 'Dl', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [400, 0] },
  brand, card,
  { parameters: { operation: 'write', fileName: '/files/media/test-brand.jpg', dataPropertyName: 'data', options: {} }, id: 't4', name: 'W1', type: 'n8n-nodes-base.readWriteFile', typeVersion: 1, position: [800, 0] },
  { parameters: { operation: 'write', fileName: '/files/media/test-card.jpg', dataPropertyName: 'data', options: {} }, id: 't5', name: 'W2', type: 'n8n-nodes-base.readWriteFile', typeVersion: 1, position: [800, 200] },
];
const connections = {
  Go: { main: [[{ node: 'Sample', type: 'main', index: 0 }]] },
  Sample: { main: [[{ node: 'Dl', type: 'main', index: 0 }, { node: 'Render Card', type: 'main', index: 0 }]] },
  Dl: { main: [[{ node: 'Brand Image', type: 'main', index: 0 }]] },
  'Brand Image': { main: [[{ node: 'W1', type: 'main', index: 0 }]] },
  'Render Card': { main: [[{ node: 'W2', type: 'main', index: 0 }]] },
};
writeFileSync('media/.render-test.json', JSON.stringify({ id: 'pwRenderTest0001', name: 'zz render test', nodes, connections, settings: { executionOrder: 'v1' }, active: false }));
console.log('wrote media/.render-test.json');
