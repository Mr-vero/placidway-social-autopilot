// Route Action: normalise the dashboard request.
const req = $('POST /action').first().json;
const body = req.body || {};
const ALLOWED = ['approve', 'reject', 'settings', 'run', 'ack', 'retry', 'engagement'];
const action = String(body.action || '');
if (!ALLOWED.includes(action)) return { json: { action: 'invalid', error: `Unknown action "${action}"` } };
return {
  json: {
    action,
    trigger: 'dashboard',
    id: body.id != null ? Number(body.id) : null,
    post_text: typeof body.post_text === 'string' ? body.post_text : null,
    note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
    reviewer: String(body.reviewer || 'dashboard').slice(0, 60),
    settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
    force_type: body.force_type || null,
  },
};
