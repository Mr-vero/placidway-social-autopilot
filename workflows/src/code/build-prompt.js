// Build Prompt: writer prompt + JSON schema. On a retry, the previous
// guardrail findings are fed back so the model fixes exactly what failed.
const ctx = $json;
const attempt = (ctx.attempt || 0) + 1;
const s = ctx.source;

const system = `You are the social media writer for PlacidWay, a medical tourism marketplace that helps patients compare treatments, clinics and packages abroad.

Voice: warm, clear, trustworthy, patient-first. Informative, never hype. Plain English at roughly an 8th-grade reading level.

Hard rules (a compliance checker will reject the post if any is broken):
1. Use ONLY facts that appear in the SOURCE. No outside knowledge, no statistics, prices, durations, success rates, names or credentials that are not in the SOURCE.
2. No medical claims or promises of outcomes. Never say or imply: cure, guaranteed, permanent results, risk-free, painless, no side effects, miracle, proven, reverses, eliminates, best/top/#1. Use hedged, patient-education language ("may", "patients often ask", "learn what to consider").
3. Never invent or estimate prices. Mention a price only if it appears verbatim in the SOURCE, written exactly as the SOURCE writes it, and frame it as "listed" or "starting" exactly as the source does.
4. Every value line must be backed by a short verbatim quote from the SOURCE, which you return in "claims".
5. Do not include the URL or hashtags inside hook/lines/cta. They are added separately.
6. At most one emoji in the hook and none elsewhere.`;

const feedback = (ctx.feedback || []).length
  ? `\n\nYOUR PREVIOUS DRAFT WAS REJECTED. Fix every issue below and do not repeat them:\n${ctx.feedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`
  : '';

const prompt = `Write one Facebook post promoting the PlacidWay page below.

Format requirements:
- hook: one scroll-stopping opening line (max 110 characters), a question or a curiosity gap grounded in the source.
- lines: 2 to 4 short value lines (max 90 characters each) a reader learns from the page.
- cta: one call to action inviting people to read the full guide / view the package / compare options on PlacidWay (max 80 characters).
- hashtags: 3 to 5 relevant hashtags, CamelCase, no spaces, without the URL. Include one treatment tag and one destination tag when the source names a destination.
- claims: for each value line, the verbatim SOURCE quote (8-30 words) that supports it.
- Total of hook + lines + cta must be under 430 characters.

CONTENT TYPE: ${s.type}
CATEGORY: ${s.category}
SOURCE URL: ${s.url}

SOURCE:
"""
${s.excerpt}
"""${feedback}`;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'lines', 'cta', 'hashtags', 'claims'],
  properties: {
    hook: { type: 'string' },
    lines: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    cta: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'source_quote'],
        properties: { line: { type: 'string' }, source_quote: { type: 'string' } },
      },
    },
  },
};

return {
  json: {
    ...ctx,
    attempt,
    llm_request: {
      model: $env.LLM_MODEL_WRITER || 'sonnet',
      system,
      prompt,
      schema,
      tag: `${ctx.run.run_id}:write:${attempt}`,
    },
  },
};
