// Normalize Engagement: Graph fields -> one snapshot row per post.
const posts = $('Published Posts').all();
return $input.all().map((it, i) => {
  const r = it.json || {};
  const post = posts[i] ? posts[i].json : {};
  const clicks = (((r.insights || {}).data || []).find((d) => d.name === 'post_clicks') || {}).values;
  return {
    json: {
      post_id: post.id,
      ok: !r.error,
      reactions: r.reactions && r.reactions.summary ? r.reactions.summary.total_count : null,
      comments: r.comments && r.comments.summary ? r.comments.summary.total_count : null,
      shares: r.shares ? r.shares.count : 0,
      clicks: clicks && clicks[0] ? clicks[0].value : null,
      raw: JSON.stringify(r).slice(0, 4000),
    },
  };
}).filter((x) => x.json.post_id);
