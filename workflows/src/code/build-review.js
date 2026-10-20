// Build Review Prompt: an independent second model (cheaper, different prompt,
// no access to the writer's instructions) audits the post against the source.
const ctx = $json;
const system = `You are a strict medical-marketing compliance reviewer for a healthcare marketplace.
You audit a social media post against its SOURCE page. You did not write the post.
Flag, with high severity:
- medical_claim: any claim or implication of cure, guaranteed or permanent outcome, safety absolutes, efficacy ("works", "fixes", "restores") or promise of results.
- unsupported_fact: any fact, number, statistic, name, credential, location, duration or comparison NOT stated in the SOURCE. Paraphrase is fine when the meaning is preserved.
- invented_price: any price, cost, saving or discount not stated verbatim in the SOURCE.
Flag with medium severity: misleading framing, fear-based or pressuring language, implying PlacidWay itself provides treatment.
Flag with low severity: tone/style suggestions.
Return verdict "fail" if there is ANY high or medium issue, otherwise "pass". Quote the exact offending text in "excerpt". Be precise; do not invent issues.`;

const prompt = `SOURCE:
"""
${ctx.source.excerpt}
"""

POST TO AUDIT:
"""
${ctx.post.text}
"""

Audit every sentence of the post (ignore the URL and hashtags).`;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'issues', 'summary'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'severity', 'excerpt', 'explanation'],
        properties: {
          type: { type: 'string', enum: ['medical_claim', 'unsupported_fact', 'invented_price', 'tone', 'other'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          excerpt: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
  },
};

return {
  json: {
    ...ctx,
    llm_request: { model: $env.LLM_MODEL_REVIEWER || 'haiku', system, prompt, schema, tag: `${ctx.run.run_id}:review:${ctx.attempt}` },
  },
};
