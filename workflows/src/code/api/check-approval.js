// Check Approval: a human approval still has to pass the hard rules.
// If the reviewer edited the text, the edit is re-checked; the LLM review stays advisory.
// @include lib/guardrails.js
const req = $('Route Action').item.json;
const row = $json;
if (!row || !row.id) return { json: { ok: false, code: 404, error: 'Post not found' } };
if (!['pending_approval', 'needs_review', 'publish_failed', 'approved'].includes(row.status)) {
  return { json: { ok: false, code: 409, error: `Post is already "${row.status}"` } };
}
const text = req.post_text != null ? req.post_text.trim() : row.post_text;
const edited = req.post_text != null && text !== row.post_text;
const parsed = parsePostText(text, row.source_url);
const rules = runRuleChecks(parsed, { excerpt: row.source_excerpt, url: row.source_url }, edited ? null : row.claims);
if (!rules.pass) {
  return { json: { ok: false, code: 422, error: 'Post fails guardrails: edit the text to fix the flagged items', rules } };
}
return { json: { ok: true, id: row.id, post_text: text, edited, reviewer: req.reviewer, rules } };
