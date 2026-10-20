// Sitemap Targets: which PlacidWay sitemaps feed the candidate pool.
// Sitemaps are the politest source available: one request per content type,
// already sorted by lastmod, explicitly published for crawlers in robots.txt.
const base = ($env.PW_BASE_URL || 'https://www.placidway.com').replace(/\/$/, '');
const ctx = $('Start Run').first().json;
const targets = [
  { type: 'article', url: `${base}/1/sitemap_articles.xml` },
  { type: 'package', url: `${base}/1/sitemap_packages.xml` },
  { type: 'answer',  url: `${base}/sitemap/1/sitemap_answers.xml` },
  { type: 'news',    url: `${base}/1/sitemap_news.xml` },
];
return targets.map((t) => ({ json: { ...ctx, target: t } }));
