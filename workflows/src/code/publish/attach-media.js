// Attach Media: build the /feed request. Photos are uploaded unpublished first
// (temporary when scheduling, per Graph docs) and attached by id, so one call
// handles immediate and scheduled posts with or without an image.
const p = $('Prepare Publish').item.json;
const mediaId = p.route === 'feed' ? null : ($json.id || null);
if (p.route !== 'feed' && !mediaId) throw new Error(`Photo upload returned no id: ${JSON.stringify($json).slice(0, 300)}`);
const body = { message: p.message, published: !p.scheduled };
if (mediaId) body.attached_media = [{ media_fbid: mediaId }];
else body.link = p.link;
if (p.scheduled) body.scheduled_publish_time = p.scheduled_unix;
return { json: { ...p, fb_photo_id: mediaId, fb_body: body } };
