// Classify FB Error: turn Graph API failures into actionable alerts.
const p = $('Prepare Publish').item.json;
const e = $json.error || $json;
const raw = JSON.stringify(e);
const code = Number((raw.match(/\\?"code\\?"\s*:\s*(\d+)/) || [])[1] || 0);
const http = Number(e.httpCode || e.status || (raw.match(/\b(4\d\d|5\d\d)\b/) || [])[1] || 0);

let kind = 'api_error';
let message = `Facebook publish failed for post #${p.post_id}`;
if (code === 190 || /OAuthException|access token|session has expired/i.test(raw)) {
  kind = 'token_expired';
  message = 'Facebook Page token is invalid or expired: generate a new long-lived Page token (docs/facebook-setup.md) and update FB_PAGE_ACCESS_TOKEN';
} else if ([4, 17, 32, 613].includes(code) || http === 429) {
  kind = 'rate_limited';
  message = 'Facebook rate limit hit: the post was not published; retry from the dashboard later';
} else if (code === 200 || code === 10 || /permission/i.test(raw)) {
  kind = 'permission';
  message = 'Facebook permission error: the token needs pages_manage_posts + pages_read_engagement for this Page';
} else if (http >= 500 || /ECONN|ETIMEDOUT|socket hang up|timeout/i.test(raw)) {
  kind = 'network';
  message = 'Facebook API unreachable after retries';
}
return {
  json: {
    ...p,
    status: 'publish_failed',
    error: `${kind}: ${(e.message || '').slice(0, 300)}`,
    alert: { severity: 'error', source: 'publish', message, details: JSON.stringify({ kind, code, http, post_id: p.post_id, raw: raw.slice(0, 1500) }) },
  },
};
