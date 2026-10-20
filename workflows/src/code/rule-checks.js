// Rule-Based Checks: fast, explainable, zero-cost guardrails that run before
// (and independently of) the LLM reviewer. A single failure blocks auto-publish.
// @include lib/guardrails.js
const ctx = $json;
const rules = runRuleChecks(ctx.post, ctx.source, ctx.gen.claims || []);
return { json: { ...ctx, guardrail: { rules } } };
