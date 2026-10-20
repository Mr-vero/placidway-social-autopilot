// Pick Candidate: parse sitemaps, drop anything already used, apply variety
// rules, and choose exactly one URL for today.
// @include lib/categories.js

const ctx = $('Start Run').first().json;
const state = $('Load Settings').first().json;
const settings = state.settings || {};
const used = new Set((state.used_urls || []).map(normalizeUrl));
const recent = state.recent || [];
const targets = $('Sitemap Targets').all().map((i) => i.json.target);
const responses = $input.all();

const POOL_PER_TYPE = 60;
const avoidN = Number(settings.avoid_recent_categories || 3);
const recentCategories = recent.slice(0, avoidN).map((r) => r.category).filter(Boolean);
const lastType = recent[0] && recent[0].content_type;

let rotation = {};
try { rotation = JSON.parse(settings.rotation || '{}'); } catch (e) { rotation = {}; }
const todaysType = ctx.run.force_type || rotation[String(ctx.run.dow)] || 'article';

function parseSitemap(xml, type) {
  const out = [];
  const re = /<url>([\s\S]*?)<\/url>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const loc = (block.match(/<loc>\s*([^<]+?)\s*<\/loc>/) || [])[1];
    if (!loc) continue;
    const lastmod = (block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/) || [])[1] || '';
    const image = (block.match(/<image:loc>\s*([^<]+?)\s*<\/image:loc>/) || [])[1] || null;
    const newsTitle = (block.match(/<news:title>\s*([^<]+?)\s*<\/news:title>/) || [])[1] || null;
    const id = Number((loc.match(/\/(\d+)\//) || [])[1] || 0);
    out.push({ url: normalizeUrl(loc), type, lastmod, image, id, title_guess: newsTitle || titleFromUrl(loc) });
  }
  return out;
}

const pools = {};
const poolSizes = {};
responses.forEach((r, i) => {
  const type = targets[i] && targets[i].type;
  if (!type) return;
  const xml = typeof r.json.data === 'string' ? r.json.data : '';
  const all = parseSitemap(xml, type);
  // Freshest first: lastmod, then id (PlacidWay ids are monotonic, and lastmod alone is noisy
  // because old pages get touched).
  all.sort((a, b) => (b.lastmod.localeCompare(a.lastmod)) || (b.id - a.id));
  const fresh = all.slice(0, POOL_PER_TYPE).filter((c) => !used.has(c.url));
  fresh.forEach((c) => { c.category = classifyCategory(c.title_guess + ' ' + c.url); });
  pools[type] = fresh;
  poolSizes[type] = { in_sitemap: all.length, fresh_unused: fresh.length };
});

if (!Object.values(poolSizes).some((p) => p.in_sitemap > 0)) {
  throw new Error('All PlacidWay sitemaps came back empty or unparseable: site may be down or markup changed');
}

function score(c, rank) {
  let s = 100 - rank;                                    // freshness
  if (recentCategories.includes(c.category)) s -= 60;   // category variety
  if (c.image) s += 5;                                  // prefer items with a featured image
  if (c.title_guess.length < 20) s -= 10;               // thin slugs tend to be thin pages
  return s;
}

function best(list) {
  return list
    .map((c, rank) => ({ c, s: score(c, rank) }))
    .sort((a, b) => b.s - a.s)[0];
}

let chosen = null;
let reason = '';
const primary = pools[todaysType] && pools[todaysType].length ? best(pools[todaysType]) : null;
if (primary) {
  chosen = primary.c;
  reason = ctx.run.force_type
    ? `Dashboard requested "${todaysType}"`
    : `Rotation picks "${todaysType}" for ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][ctx.run.dow]}`;
} else {
  // Fallback: any other type, avoiding yesterday's type when possible.
  const fallbacks = Object.keys(pools).filter((t) => t !== todaysType && pools[t].length);
  fallbacks.sort((a, b) => (a === lastType) - (b === lastType));
  for (const t of fallbacks) { const b = best(pools[t]); if (b) { chosen = b.c; break; } }
  reason = chosen ? `No fresh "${todaysType}" item; fell back to "${chosen.type}"` : 'Nothing fresh to post';
}
if (chosen && recentCategories.includes(chosen.category)) reason += ` (category "${chosen.category}" repeats: no alternative)`;
else if (chosen) reason += `; category "${chosen.category}" not used in last ${avoidN} posts`;

return [{
  json: {
    ...ctx,
    settings,
    found: !!chosen,
    item: chosen,
    selection: { reason, todays_type: todaysType, recent_categories: recentCategories, pools: poolSizes },
  },
}];
