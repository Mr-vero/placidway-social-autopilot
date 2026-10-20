// Simulate Publish (dry run): everything except the network write.
// Records the exact Graph API calls that would be made, so the demo is auditable.
const p = $('Prepare Publish').item.json;
const page = p.page_id || '{PAGE_ID}';
const steps = [];
if (p.route !== 'feed') {
  steps.push({
    method: 'POST',
    url: `${p.graph}/${page}/photos`,
    body: {
      ...(p.route === 'photo_upload' ? { source: `@${p.media_file} (multipart)` } : { url: p.image_url }),
      published: false,
      temporary: p.scheduled,
    },
  });
}
steps.push({
  method: 'POST',
  url: `${p.graph}/${page}/feed`,
  body: {
    message: p.message,
    published: !p.scheduled,
    ...(p.route !== 'feed' ? { attached_media: [{ media_fbid: '<id from step 1>' }] } : { link: p.link }),
    ...(p.scheduled ? { scheduled_publish_time: p.scheduled_unix } : {}),
  },
});
if (p.crosspost_ig && !p.scheduled && p.route !== 'feed') {
  steps.push({ method: 'POST', url: `${p.graph}/{IG_USER_ID}/media`, body: { image_url: '<FB-hosted photo url>', caption: '<post text without link>' } });
  steps.push({ method: 'POST', url: `${p.graph}/{IG_USER_ID}/media_publish`, body: { creation_id: '<container id>' } });
}
return {
  json: {
    ...p,
    fb_post_id: `dryrun_${Date.now()}`,
    fb_permalink: null,
    status: p.scheduled ? 'scheduled' : 'published',
    simulated_request: steps,
  },
};
