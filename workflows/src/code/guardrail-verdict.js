// Guardrail Verdict: combine both layers and decide.
//   pass                 -> continue (auto: publish, approval: queue for review)
//   fail, attempts left  -> loop back to the writer with the findings
//   fail, out of attempts-> escalate to a human as "needs_review" (never auto-publishes)
const { llm_request, ...ctx } = $('Build Review Prompt').item.json;
const res = $json;
const maxAttempts = Number(ctx.settings.max_attempts || 3);

let llm;
if (res.ok && res.data) {
  const issues = res.data.issues || [];
  const blocking = issues.filter((i) => i.severity === 'high' || i.severity === 'medium');
  llm = { verdict: blocking.length ? 'fail' : 'pass', model_verdict: res.data.verdict, summary: res.data.summary, issues, model: res.model };
} else {
  // Reviewer unavailable: fail closed. The draft can still go to a human.
  llm = { verdict: 'fail', summary: `Reviewer unavailable: ${res.error || 'no output'}`, issues: [], unavailable: true };
}

const rules = ctx.guardrail.rules;
const passed = rules.pass && llm.verdict === 'pass';

const feedback = [
  ...rules.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`),
  ...llm.issues.filter((i) => i.severity !== 'low').map((i) => `${i.type.replace('_', ' ')}: "${i.excerpt}": ${i.explanation}`),
];

const attempts_log = [...(ctx.attempts_log || []), {
  attempt: ctx.attempt,
  passed,
  post_text: ctx.post.text,
  failed_rules: rules.checks.filter((c) => !c.pass).map((c) => c.id),
  llm_verdict: llm.verdict,
  llm_issues: llm.issues.length,
}];

let route;
let status = null;
if (passed) {
  route = 'done';
  status = ctx.settings.publish_mode === 'auto' ? 'approved' : 'pending_approval';
} else if (ctx.attempt < maxAttempts && !llm.unavailable) {
  route = 'retry';
} else {
  route = 'done';
  status = 'needs_review';
}

return {
  json: {
    ...ctx,
    guardrail: { rules, llm, passed, attempts: ctx.attempt, checked_at: new Date().toISOString() },
    feedback,
    attempts_log,
    route,
    status,
  },
};
