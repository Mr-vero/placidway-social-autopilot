// Validate Settings: whitelist keys and values before writing.
const s = $('Route Action').item.json.settings;
const rules = {
  publish_mode: (v) => ['approval', 'auto'].includes(v),
  dry_run: (v) => ['true', 'false'].includes(v),
  post_time: (v) => v === 'now' || /^([01]?\d|2[0-3]):[0-5]\d$/.test(v),
  brand_images: (v) => ['true', 'false'].includes(v),
  crosspost_instagram: (v) => ['true', 'false'].includes(v),
  max_attempts: (v) => /^[1-5]$/.test(v),
  avoid_recent_categories: (v) => /^[0-9]$/.test(v),
  rotation: (v) => { try { const o = JSON.parse(v); return Object.keys(o).every((k) => /^[0-6]$/.test(k) && ['article', 'package', 'answer', 'news'].includes(o[k])); } catch (e) { return false; } },
};
const out = [];
const rejected = [];
for (const [k, raw] of Object.entries(s)) {
  const v = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
  if (rules[k] && rules[k](v)) out.push({ json: { key: k, value: v } });
  else rejected.push(k);
}
if (!out.length) return [{ json: { key: null, rejected } }];
return out;
