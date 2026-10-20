// Prepare Publish: validate the post and build the Graph API request.
const row = $json;
const trigger = $('When Called').first().json;
if (!row || !row.id) throw new Error(`Post ${trigger.post_id} not found`);
if (row.status !== 'approved') {
  return { json: { skip: true, post_id: row.id, status: row.status, reason: `Post is "${row.status}", only "approved" posts are published` } };
}

const s = row.settings || {};
const tz = $env.GENERIC_TIMEZONE || $env.TZ || 'UTC';
const dryRun = String(s.dry_run) !== 'false';

// "HH:MM" -> next occurrence in local time. Facebook requires 10 min .. 30 days ahead.
let scheduledFor = null;
const pt = String(s.post_time || 'now').trim();
if (/^\d{1,2}:\d{2}$/.test(pt)) {
  const [h, m] = pt.split(':').map(Number);
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(now).map((p) => [p.type, p.value]));
  const offsetMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - Math.floor(now.getTime() / 60000) * 60000;
  let target = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, m) - offsetMs;
  if (target < now.getTime() + 15 * 60 * 1000) target += 24 * 3600 * 1000;
  scheduledFor = new Date(target);
}

const route = row.media_path ? 'photo_upload' : row.image_url ? 'photo_url' : 'feed';
return {
  json: {
    post_id: row.id,
    run_id: `pub-${$execution.id}`,
    trigger: trigger.trigger || 'auto',
    dry_run: dryRun,
    route,
    message: row.post_text,
    link: (row.post_text.match(/https?:\/\/\S+/) || [row.source_url])[0],
    image_url: row.image_url,
    media_file: row.media_path ? `/files/${row.media_path}` : null,
    scheduled: !!scheduledFor,
    scheduled_for: scheduledFor ? scheduledFor.toISOString() : null,
    scheduled_unix: scheduledFor ? Math.floor(scheduledFor.getTime() / 1000) : null,
    crosspost_ig: String(s.crosspost_instagram) === 'true',
    graph: `https://graph.facebook.com/${$env.FB_GRAPH_VERSION || 'v24.0'}`,
    page_id: $env.FB_PAGE_ID || '',
  },
};
