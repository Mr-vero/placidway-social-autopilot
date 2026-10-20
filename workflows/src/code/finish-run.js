// Finish Run: summarise the run for the runs table.
const ctx = $('Draft Record').item.json;
const pub = $input.first().json || {};
const published = pub.status === 'published' || pub.status === 'scheduled';
const status = ctx.status === 'needs_review' ? 'needs_review'
  : pub.status === 'failed' ? 'error'
  : 'success';
return {
  json: {
    run_id: ctx.run.run_id,
    status,
    post_id: ctx.post_id,
    fb_post_id: pub.fb_post_id || null,
    error: pub.error || null,
    details: JSON.stringify({
      final_status: pub.status || ctx.status,
      attempts: ctx.attempt,
      guardrail_passed: ctx.guardrail.passed,
      selection: ctx.selection,
      title: ctx.source.title,
      published,
    }),
  },
};
