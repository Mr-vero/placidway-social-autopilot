// Normalize FB Response: /feed returns {id: "<page>_<post>"}.
const p = $('Attach Media').item.json;
const r = $json;
if (!r.id) throw new Error(`Facebook returned no post id: ${JSON.stringify(r).slice(0, 300)}`);
return { json: { ...p, fb_post_id: r.id, status: p.scheduled ? 'scheduled' : 'published' } };
