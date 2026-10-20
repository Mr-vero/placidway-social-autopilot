// Shared: treatment-category classifier used for variety rules and hashtags.
// Inlined into Code nodes at build time (see tools/build-workflows.mjs).
const CATEGORY_RULES = [
  ['Stem Cell & Regenerative', /stem[- ]?cell|regenerative|prp|exosome|mesenchymal/i],
  ['Cancer Care', /cancer|oncolog|tumou?r|chemo|radiother|immunother|car[- ]?t\b|leukemia|lymphoma/i],
  ['Bariatric & Weight Loss', /bariatric|gastric|sleeve|bypass|obesity|weight[- ]loss|ozempic|mounjaro|glp[- ]?1|semaglutide|tirzepatide/i],
  ['Cosmetic & Plastic Surgery', /cosmetic|plastic|tummy|abdominoplast|liposuc|lipo\b|breast|rhinoplast|facelift|bbl|butt[- ]lift|body[- ]contour|mommy[- ]makeover|blepharo|eyelid/i],
  ['Dental Care', /dental|dentist|implant|veneer|crown|all[- ]on[- ]?\d|teeth|tooth|smile/i],
  ['Fertility & IVF', /ivf|fertility|surrogacy|egg[- ]donat|icsi|infertil/i],
  ['Orthopedics & Spine', /orthop|knee|hip|spine|spinal|shoulder|joint|arthro|disc\b|scoliosis/i],
  ['Cardiology', /cardi|heart|bypass[- ]surgery|valve|angioplast/i],
  ['Hair Restoration', /hair[- ]?(transplant|restoration|loss)|fue\b|dhi\b/i],
  ['Eye Care', /lasik|eye|cataract|ophthalm|vision/i],
  ['Neurology', /neuro|parkinson|alzheimer|autism|multiple[- ]sclerosis|\bms\b|stroke|cerebral[- ]palsy|huntington|als\b/i],
  ['Health Checkups', /check[- ]?up|screening|assessment|executive[- ]health|wellness/i],
  ['Anti-Aging & Wellness', /anti[- ]?aging|longevity|iv[- ]therapy|nad\+?|detox|spa\b/i],
  ['Urology', /urolog|prostate|erectile|kidney|ed\b/i],
  ['Diabetes', /diabet/i],
];

function classifyCategory(text) {
  const s = String(text || '').replace(/[-_]/g, ' ');
  for (const [name, re] of CATEGORY_RULES) if (re.test(s)) return name;
  return 'Medical Travel';
}

// Strip the directory and id from a PlacidWay URL to get a readable title guess.
function titleFromUrl(url) {
  const last = String(url).split('?')[0].replace(/\/$/, '').split('/').pop() || '';
  return decodeURIComponent(last).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = '';
    u.search = '';
    u.hostname = u.hostname.toLowerCase().replace(/^placidway\.com$/, 'www.placidway.com');
    u.protocol = 'https:';
    return u.toString().replace(/\/$/, '');
  } catch (e) {
    return String(url).trim();
  }
}
