// Assemble Post: deterministic formatting around the LLM's parts, so the
// structure (hook / value lines / CTA / link / hashtags) is guaranteed by code.
// @include lib/guardrails.js
const ctx = $('Build Prompt').item.json;
const res = $json;
if (!res.ok || !res.data) throw new Error(`Writer LLM returned no usable output: ${res.error || 'empty response'}`);

const gen = res.data;
const post = assemblePost(gen, ctx.source.url, $env.PW_UTM || '');
const { llm_request, ...rest } = ctx;
return {
  json: {
    ...rest,
    gen: { ...gen, model: res.model, duration_ms: res.duration_ms, cost_usd: res.cost_usd ?? null },
    post,
  },
};
