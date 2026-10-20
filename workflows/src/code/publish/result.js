// Result: the sub-workflow's return value to whoever called it.
const r = $('Outcome').item.json;
return {
  json: {
    post_id: r.post_id,
    status: r.status,
    fb_post_id: r.fb_post_id || null,
    fb_permalink: r.fb_permalink || null,
    scheduled_for: r.scheduled_for || null,
    dry_run: r.dry_run,
    error: r.error || null,
    simulated_request: r.simulated_request || null,
  },
};
