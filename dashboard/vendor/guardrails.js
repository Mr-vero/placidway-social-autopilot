// GENERATED from workflows/src/lib/guardrails.js by tools/build-workflows.mjs. Do not edit.
// Shared: post assembly + deterministic guardrails.
// Used by the pipeline (after generation) and by the dashboard API (when a
// reviewer edits a draft), so a human edit is held to the same rules.

const BODY_LIMIT = 500; // characters before the link, per the brief

function buildLink(url, utm) {
  if (!utm) return url;
  return url + (url.includes('?') ? '&' : '?') + utm;
}

function cleanTag(t) {
  const core = String(t || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
  return core ? `#${core}` : null;
}

function assemblePost(gen, sourceUrl, utm) {
  const hook = String(gen.hook || '').trim();
  const lines = (gen.lines || []).map((l) => String(l).trim().replace(/^[-•*✅▸]\s*/, '')).filter(Boolean);
  const cta = String(gen.cta || '').trim();
  const hashtags = [...new Set((gen.hashtags || []).map(cleanTag).filter(Boolean))];
  const link = buildLink(sourceUrl, utm);
  const body = [hook, '', ...lines.map((l) => `• ${l}`), '', cta].join('\n');
  const text = `${body}\n👉 ${link}\n\n${hashtags.join(' ')}`;
  return { hook, lines, cta, hashtags, link, body, text, body_chars: [...body].length };
}

// Split an edited full post back into parts so edits get the same checks.
function parsePostText(text, sourceUrl) {
  const t = String(text || '');
  const linkMatch = t.match(/https?:\/\/\S+/);
  const link = linkMatch ? linkMatch[0] : '';
  const idx = linkMatch ? t.indexOf(link) : t.length;
  const body = t.slice(0, idx).replace(/👉\s*$/u, '').trimEnd();
  const after = t.slice(idx + link.length);
  const hashtags = (after.match(/#[\p{L}\p{N}_]+/gu) || []);
  const parts = body.split('\n').map((s) => s.trim()).filter(Boolean);
  const hook = parts[0] || '';
  const bulletLines = parts.filter((p) => /^[•\-*✅▸]/.test(p)).map((p) => p.replace(/^[•\-*✅▸]\s*/, ''));
  const cta = parts.length > 1 ? parts[parts.length - 1] : '';
  return { hook, lines: bulletLines, cta, hashtags, link, body, text: t, body_chars: [...body].length, source_url: sourceUrl };
}

// Medical-claim language that must never appear, regardless of source wording.
const BANNED = [
  [/\bcur(e|es|ed|ing)\b/i, 'promises a cure'],
  [/\bguarantee(d|s)?\b/i, 'guarantees an outcome'],
  [/\b100\s?%/i, 'absolute (100%) claim'],
  [/\brisk[- ]?free\b|\bno risks?\b|\bzero risk\b/i, 'claims no risk'],
  [/\bno side[- ]effects?\b|\bwithout side[- ]effects?\b/i, 'claims no side effects'],
  [/\bpainless\b|\bpain[- ]free\b/i, 'claims painless treatment'],
  [/\bpermanent(ly)?\s+(results?|fix|solution|cure)\b/i, 'promises permanent results'],
  [/\bmiracle|\bmiraculous\b/i, 'miracle language'],
  [/\b(clinically\s+)?proven\b/i, '"proven" efficacy claim'],
  [/\brevers(e|es|ed|ing)\b/i, 'claims to reverse a condition'],
  [/\b(eliminate|eradicate)s?\b/i, 'claims to eliminate a condition'],
  [/\bheal(s|ed)?\s+(your|the|any)\b/i, 'claims to heal'],
  [/\b(completely|totally|perfectly|100%)\s+safe\b/i, 'absolute safety claim'],
  [/\bfda[- ]approved\b/i, 'regulatory approval claim'],
  [/\binstant(ly)?\s+results?\b/i, 'instant results claim'],
  [/\bwill\s+(fix|cure|restore|transform)\b/i, 'promises an outcome'],
];

const NEGATION = /\b(not|no|never|without|isn't|aren't|doesn't|don't|cannot|can't|nor)\b|n't\b/;

// Superlatives allowed only if the source itself uses them.
const SUPERLATIVES = /\b(best|#1|number one|top[- ]rated|world[- ]class|leading|cheapest|lowest price)\b/gi;

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\p{L}\p{N}%$.,'\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// Numbers as they appear in prose: 1,200 / 82% / 3.5 / 2025 -> canonical digits.
function numbersIn(text) {
  const found = String(text || '').match(/\d[\d,]*(\.\d+)?/g) || [];
  return found.map((n) => n.replace(/,/g, '').replace(/\.0+$/, '')).filter((n) => n.length > 0);
}

function quoteSupported(quote, sourceNorm) {
  const q = norm(quote);
  if (!q) return false;
  if (sourceNorm.includes(q)) return true;
  // Tolerate small edits (punctuation, a dropped word): 4-word shingle overlap.
  const w = q.split(' ');
  if (w.length < 4) return sourceNorm.includes(q);
  let hit = 0, total = 0;
  for (let i = 0; i + 4 <= w.length; i++) { total++; if (sourceNorm.includes(w.slice(i, i + 4).join(' '))) hit++; }
  return total > 0 && hit / total >= 0.6;
}

function runRuleChecks(post, source, claims) {
  const excerpt = source.excerpt || '';
  const sourceNorm = norm(excerpt);
  const sourceNums = new Set(numbersIn(excerpt));
  const checks = [];
  const add = (id, label, pass, detail) => checks.push({ id, label, pass: !!pass, detail: detail || '' });

  add('structure', 'Hook, 2–4 value lines and a CTA',
    post.hook && post.cta && post.lines.length >= 2 && post.lines.length <= 4,
    `hook=${post.hook ? 'yes' : 'no'}, lines=${post.lines.length}, cta=${post.cta ? 'yes' : 'no'}`);

  add('length', `Under ${BODY_LIMIT} characters before the link`, post.body_chars < BODY_LIMIT, `${post.body_chars} chars`);

  const badTags = post.hashtags.filter((h) => !/^#[\p{L}\p{N}]{2,40}$/u.test(h));
  add('hashtags', '3–5 well-formed hashtags',
    post.hashtags.length >= 3 && post.hashtags.length <= 5 && badTags.length === 0,
    `${post.hashtags.length} tags${badTags.length ? `; malformed: ${badTags.join(' ')}` : ''}`);

  const linkOk = post.link && post.link.split('?')[0].replace(/\/$/, '') === String(source.url).split('?')[0].replace(/\/$/, '');
  add('link', 'Links to the exact source page', linkOk, post.link || 'missing');

  const prose = `${post.hook}\n${post.lines.join('\n')}\n${post.cta}`;
  const bannedHits = [];
  for (const [re, why] of BANNED) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of prose.matchAll(g)) {
      // Cautionary phrasing ("is not proven", "no guarantee of results") is the compliant way
      // to talk about evidence, so a negation just before the term clears it.
      const before = prose.slice(Math.max(0, m.index - 28), m.index).toLowerCase();
      if (NEGATION.test(before)) continue;
      bannedHits.push(`${why} ("${m[0]}")`);
      break;
    }
  }
  add('medical_claims', 'No medical claims or outcome promises', bannedHits.length === 0, bannedHits.join('; ') || 'clean');

  const supers = [...new Set((prose.match(SUPERLATIVES) || []).map((s) => s.toLowerCase()))]
    .filter((s) => !sourceNorm.includes(s));
  add('superlatives', 'No unsupported superlatives', supers.length === 0, supers.join(', ') || 'clean');

  const unknownNums = [...new Set(numbersIn(prose))].filter((n) => !sourceNums.has(n));
  add('numbers', 'Every number appears in the source', unknownNums.length === 0,
    unknownNums.length ? `not in source: ${unknownNums.join(', ')}` : `${numbersIn(prose).length} numbers verified`);

  const priceRe = /(?:[$€£]|\b(?:usd|eur|gbp|mxn|cad|aud)\b)\s?\d[\d,.]*|\d[\d,.]*\s?(?:usd|eur|gbp|mxn|dollars|euros)\b/gi;
  const prices = prose.match(priceRe) || [];
  const badPrices = prices.filter((p) => numbersIn(p).some((n) => !sourceNums.has(n)));
  add('prices', 'No invented prices', badPrices.length === 0,
    prices.length ? (badPrices.length ? `not in source: ${badPrices.join(', ')}` : `${prices.join(', ')} found in source`) : 'no prices mentioned');

  if (claims) {
    const unsupported = (claims || []).filter((c) => !quoteSupported(c.source_quote, sourceNorm));
    const covered = claims.length >= post.lines.length;
    add('grounding', 'Each value line is backed by a verbatim source quote',
      covered && unsupported.length === 0,
      !covered ? `${claims.length} quotes for ${post.lines.length} lines`
        : unsupported.length ? `quote not found in source: "${unsupported[0].source_quote.slice(0, 80)}"` : `${claims.length}/${claims.length} quotes located in source`);
  }

  return { pass: checks.every((c) => c.pass), checks };
}
