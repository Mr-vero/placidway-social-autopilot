// Normalize Engagement: Graph insights (+ optional counts) -> one snapshot row per post.
// Insights work with pages_read_engagement. The comments/shares fields need
// pages_read_user_content; without it that call fails and those stay null.
const posts = $('Published Posts').all();
const insights = $('Read Insights').all();
const out = [];
$input.all().forEach((countsItem, i) => {
  const post = posts[i] ? posts[i].json : null;
  if (!post) return;
  const ins = (insights[i] && insights[i].json) || {};
  const counts = countsItem.json || {};
  const metric = (name) => ((ins.data || []).find((d) => d.name === name) || {}).values?.[0]?.value;

  const byType = metric('post_reactions_by_type_total');
  const reactionsFromInsights = byType && typeof byType === 'object' ? Object.values(byType).reduce((s, n) => s + Number(n || 0), 0) : null;
  const reactions = counts.reactions?.summary?.total_count ?? reactionsFromInsights ?? (ins.data ? 0 : null);
  const row = {
    post_id: post.id,
    reactions,
    comments: counts.comments?.summary?.total_count ?? null,
    shares: counts.error ? null : (counts.shares?.count ?? 0),
    clicks: metric('post_clicks') ?? (ins.data ? 0 : null),
    views: metric('post_media_view') ?? null,
  };
  // Nothing readable at all (both calls failed): skip rather than store a fake zero.
  if (ins.error && counts.error) return;
  out.push({ json: { ...row, raw: JSON.stringify({ insights: ins.data || ins.error || null, counts: counts.error ? { error: String(counts.error.message || counts.error).slice(0, 300) } : counts }).slice(0, 4000) } });
});
return out;
