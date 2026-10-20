// Add Permalink: attach the public URL when Graph returns it (scheduled posts have none yet).
const p = $('Normalize FB Response').item.json;
return { json: { ...p, fb_permalink: $json.permalink_url || null } };
