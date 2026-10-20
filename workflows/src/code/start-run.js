// Start Run: normalise whichever trigger fired into one run context.
const input = $input.first().json || {};
let trigger = 'manual';
if (input.trigger) trigger = String(input.trigger);          // called by the dashboard
else if (input.timestamp || input['Readable date']) trigger = 'schedule';

const tz = $env.GENERIC_TIMEZONE || $env.TZ || 'UTC';
const now = new Date();
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(now);
const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);

return [{
  json: {
    run: {
      run_id: `pipe-${$execution.id}`,
      execution_id: $execution.id,
      trigger,
      started_at: now.toISOString(),
      tz,
      dow,
      force_type: input.force_type || null,   // optional override from the dashboard ("article", "package"...)
    },
  },
}];
