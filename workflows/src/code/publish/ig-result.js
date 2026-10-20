// IG Result: record the Instagram cross-post (best effort, never blocks Facebook).
const p = $('Add Permalink').item.json;
const r = $json;
if (r.id && !r.error) return { json: { ...p, ig_media_id: r.id } };
return {
  json: {
    ...p,
    alert: { severity: 'warning', source: 'instagram', message: `Instagram cross-post failed for post #${p.post_id} (Facebook post is live)`, details: JSON.stringify(r.error || r).slice(0, 1500) },
  },
};
