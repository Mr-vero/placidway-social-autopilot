// Extract Content: turn the fetched page into a clean, bounded source record.
// Strategy: JSON-LD first (PlacidWay publishes Article / Product / BlogPosting /
// FAQPage / BreadcrumbList on every page), Open Graph second, stripped HTML last.
// @include lib/categories.js

const ctx = $('Pick Candidate').first().json;
const claimed = $('Claim URL').first().json;
const html = String($input.first().json.data || '');

const MAX_BODY = 6000;

function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;/g, '-').replace(/&mdash;/g, '-').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function strip(s) {
  return decode(String(s || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|div|tr|br)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
function meta(prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? decode(m[1]).trim() : null;
}

// ---- JSON-LD ----
const ld = [];
const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = ldRe.exec(html))) {
  try {
    const parsed = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, ' '));
    const flat = [].concat(parsed).flatMap((d) => (d && d['@graph'] ? d['@graph'] : [d]));
    ld.push(...flat.filter(Boolean));
  } catch (e) { /* malformed block: skip, fall back to OG/HTML */ }
}
const byType = (t) => ld.find((d) => [].concat(d['@type']).includes(t));

const article = byType('Article') || byType('NewsArticle') || byType('BlogPosting') || byType('MedicalWebPage');
const product = byType('Product');
const webpage = byType('WebPage');
const faqPage = byType('FAQPage');
const crumbs = byType('BreadcrumbList');

const title = decode(
  (article && (article.headline || article.name)) || (product && product.name) ||
  meta('og:title') || (html.match(/<title>([^<]*)/i) || [])[1] || ctx.item.title_guess
).trim();

const summary = decode(
  (webpage && webpage.description) || (article && article.description) || (product && product.description) ||
  meta('og:description') || meta('description') || ''
).trim();

// Body text: structured first, then the main content region.
let body = '';
if (article && article.articleBody) body = decode(article.articleBody);
if (!body || body.length < 300) {
  const region = html.match(/class="[^"]*(pack-inner-content|article-dt-desc|answer-detail|news-detail|ctm-dt-pages)[^"]*"[\s\S]{0,120000}/i);
  if (region) body = strip(region[0]).slice(0, MAX_BODY * 2);
}
if (!body) body = summary;
body = body.replace(/\s+\n/g, '\n').trim();

// Price facts are only ever copied from structured offers or the page itself.
const priceFacts = [];
if (product && product.offers) {
  for (const o of [].concat(product.offers)) {
    const price = o.price || o.lowPrice;
    if (price) priceFacts.push(`${o.priceCurrency || ''} ${price}${o.highPrice ? ' - ' + o.highPrice : ''}`.trim());
  }
}

const faqs = faqPage && Array.isArray(faqPage.mainEntity)
  ? faqPage.mainEntity.slice(0, 5).map((q) => ({
      q: decode(q.name),
      a: decode(strip(q.acceptedAnswer && q.acceptedAnswer.text)).slice(0, 400),
    }))
  : [];

let category = null;
if (crumbs && Array.isArray(crumbs.itemListElement)) {
  const names = crumbs.itemListElement.map((c) => decode(c.name || (c.item && c.item.name) || '')).filter(Boolean);
  // Home > Medical Articles > <Category> > Title
  const cand = names.slice(2, -1).find((n) => n && !/^all$/i.test(n));
  if (cand && cand.length < 60) category = cand;
}
const categoryGroup = classifyCategory(`${category || ''} ${title} ${ctx.item.url}`);

const ogImage = meta('og:image');
let image = ogImage || (article && article.image && (article.image.url || article.image)) ||
  (product && [].concat(product.image || [])[0]) || ctx.item.image || null;
if (image && typeof image !== 'string') image = image.url || null;
if (image && /logo|placeholder|no[-_]?image/i.test(image)) image = null;

const published = (article && (article.datePublished || article.dateCreated)) || (webpage && webpage.datePublished) || null;

// The exact text the LLM is allowed to use: also stored for audit and for the number check.
const truncated = body.length > MAX_BODY ? body.slice(0, MAX_BODY).replace(/\s+\S*$/, '') + ' ...' : body;
const excerpt = [
  `TITLE: ${title}`,
  summary && `SUMMARY: ${summary}`,
  priceFacts.length && `LISTED PRICE: ${priceFacts.join('; ')}`,
  `BODY:\n${truncated}`,
  faqs.length && `FAQ:\n${faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n')}`,
].filter(Boolean).join('\n\n');

if (body.length < 120 && summary.length < 60) {
  throw new Error(`Extraction too thin for ${ctx.item.url}: page markup may have changed`);
}

return [{
  json: {
    ...ctx,
    post_id: claimed.id,
    source: {
      url: ctx.item.url,
      type: ctx.item.type,
      title,
      summary,
      category: category || categoryGroup,
      category_group: categoryGroup,
      image,
      published_at: published,
      price_facts: priceFacts,
      faqs,
      body_chars: body.length,
      excerpt,
      extracted_via: article ? 'json-ld:article' : product ? 'json-ld:product' : 'html',
    },
    attempt: 0,
    attempts_log: [],
    feedback: [],
  },
}];
