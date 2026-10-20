// Draft Record: map the run context onto the posts row (parameterised SQL).
const ctx = $('Prepare Media').item.json;
const mediaPath = ctx.media.route === 'none' ? null : `media/${ctx.media.file}`;
const dryRun = String(ctx.settings.dry_run) !== 'false';
return {
  json: {
    ...ctx,
    media_path: mediaPath,
    params: [
      ctx.post_id,
      ctx.source.title,
      ctx.source.summary,
      ctx.source.category,
      ctx.source.image,
      mediaPath,
      ctx.source.excerpt,
      ctx.source.published_at,
      ctx.post.text,
      ctx.post.hook,
      JSON.stringify(ctx.post.hashtags),
      JSON.stringify(ctx.gen.claims || []),
      JSON.stringify({ ...ctx.guardrail, attempts_log: ctx.attempts_log, selection: ctx.selection, extracted_via: ctx.source.extracted_via, writer_model: ctx.gen.model }),
      ctx.attempt,
      ctx.status,
      dryRun,
      ctx.run.run_id,
    ],
  },
};
