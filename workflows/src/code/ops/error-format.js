// Format Alert: n8n Error Trigger payload -> alert row + chat message.
const e = $json;
const wf = (e.workflow && e.workflow.name) || 'unknown workflow';
const exec = e.execution || {};
const err = exec.error || {};
const node = exec.lastNodeExecuted || (err.node && err.node.name) || 'unknown node';
const msg = String(err.message || 'Unknown error').slice(0, 500);

let hint = '';
if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|cannot be established|5\d\d|timeout/i.test(msg) && /sitemap|page/i.test(node)) hint = 'PlacidWay looks unreachable: will retry on the next schedule.';
else if (/Claude|bridge|8787/i.test(node + msg)) hint = 'LLM bridge unreachable: is `npm run bridge` running on the host?';
else if (/thin|markup/i.test(msg)) hint = 'Page structure changed: review the extractor.';

const prefix = /publish/i.test(wf) ? 'pub' : /engagement/i.test(wf) ? 'eng' : 'pipe';
return {
  json: {
    run_id: `${prefix}-${exec.id}`,
    severity: 'error',
    source: wf,
    message: `${wf} failed at "${node}": ${msg}${hint ? `: ${hint}` : ''}`,
    details: JSON.stringify({ workflow: wf, node, execution_id: exec.id, url: exec.url || null, mode: exec.mode, stack: String(err.stack || '').slice(0, 1200) }),
    text: `:rotating_light: *PlacidWay Autopilot*: ${wf} failed at "${node}"\n${msg}${hint ? `\n_${hint}_` : ''}${exec.url ? `\n${exec.url}` : ''}`,
  },
};
