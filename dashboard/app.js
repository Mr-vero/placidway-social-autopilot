/* PlacidWay Autopilot: dashboard app (vanilla JS, no build step).
   Talks to the n8n "PW · 3 · Dashboard API" workflow via /api (nginx adds the auth header).
   vendor/guardrails.js is the exact rule engine the pipeline runs, so edits are checked live. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ui = {
  state: null,
  tab: 'review',
  selected: null,
  editing: false,
  draft: '',
  postFilter: 'all',
  expandedRun: null,
  busy: new Set(),
  settingsDirty: {},
};

try { ui.tab = localStorage.getItem('pw.tab') || 'review'; } catch (e) { /* storage unavailable */ }
try { const t = localStorage.getItem('pw.theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }

// ---------- icons ----------
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.7 4H7.3a2 2 0 00-1.8 1.1z"/></svg>',
  like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.9L14 10h5.8a2 2 0 012 2.3l-1.4 8A2 2 0 0118.4 22H7V10l4-8a3 3 0 013 3.9z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.5 8.5 0 1121 11.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>',
  click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9l5 12 1.8-5.2L21 14 9 9z"/><path d="M7.2 2.2L8 5M5 8l-2.8-.8M14 4.1L12 6M6 12l-1.9 2"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10.7l-5 3.6 1.9 5.8L12 16.5l-4.9 3.6L9 14.3l-5-3.6 6.1-1.9z"/></svg>',
  retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.5 9A9 9 0 005.6 5.6L1 10m22 4l-4.6 4.4A9 9 0 013.5 15"/></svg>',
};

const TYPE_LABEL = { article: 'Patient guide', package: 'Treatment package', answer: 'Patient Q&A', news: 'News' };
const STATUS_LABEL = {
  pending_approval: 'Awaiting approval', needs_review: 'Needs review', approved: 'Approved', scheduled: 'Scheduled',
  published: 'Published', rejected: 'Rejected', failed: 'Failed', publish_failed: 'Publish failed', drafting: 'Drafting',
  running: 'Running', success: 'Success', error: 'Error', skipped: 'Skipped',
};
const pill = (status, label) => `<span class="pill s-${esc(status)}"><span class="dot"></span>${esc(label || STATUS_LABEL[status] || status)}</span>`;

// ---------- time ----------
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function ago(iso) {
  if (!iso) return '—';
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 45) return s < 0 ? 'just now' : 'in a moment';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
const tz = () => ui.state?.env?.tz || 'UTC';
const fmt = (iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: tz(), ...opts }).format(new Date(iso)) : '—';
const dur = (a, b) => { if (!a || !b) return '—'; const s = Math.round((new Date(b) - new Date(a)) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

// ---------- API ----------
async function api(path, body) {
  const res = await fetch(`/api/${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, error: text.slice(0, 200) || `HTTP ${res.status}` }; }
  if (!res.ok && json.ok !== false) json = { ok: false, error: json.error || `HTTP ${res.status}`, ...json };
  return json;
}

let pollTimer;
async function refresh() {
  clearTimeout(pollTimer);
  try {
    const s = await api('state');
    if (s && s.settings) {
      // Only re-render the views when data changed; the live status line ticks every poll.
      const key = JSON.stringify({ ...s, server_time: null });
      ui.state = s;
      if (key !== ui.lastKey) { ui.lastKey = key; render(); } else { renderStatus(); renderTop(); }
    } else throw new Error(s.error || 'Bad state payload');
  } catch (e) {
    $('#run-status').innerHTML = `<span class="pulse" style="background:var(--red)"></span><div class="text"><strong>Can't reach n8n</strong><span class="muted">${esc(e.message)}: is the stack running? (docker compose up -d)</span></div>`;
  }
  const running = isRunning();
  pollTimer = setTimeout(refresh, document.hidden ? 60000 : running ? 3000 : 15000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = `toast${err ? ' err' : ''}`;
  el.innerHTML = `${err ? I.warn : I.check}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), err ? 7000 : 3800);
}

async function act(key, body, okMsg) {
  if (ui.busy.has(key)) return null;
  ui.busy.add(key);
  render();
  try {
    const r = await api('action', body);
    if (r.ok === false) {
      const failed = r.rules?.checks?.filter((c) => !c.pass).map((c) => c.label).join(', ');
      toast(failed ? `Blocked by guardrails: ${failed}` : (r.error || 'Action failed'), true);
    } else if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    return r;
  } catch (e) {
    toast(e.message, true);
    return null;
  } finally {
    ui.busy.delete(key);
    await refresh();
  }
}

// ---------- derived ----------
const posts = () => ui.state?.posts || [];
const setting = (k) => ui.state?.settings?.[k]?.value;
const isRunning = () => (ui.state?.runs || []).some((r) => r.status === 'running' && r.workflow === 'pipeline');
const queue = () => posts()
  .filter((p) => ['needs_review', 'pending_approval', 'publish_failed'].includes(p.status))
  .sort((a, b) => (rank(a) - rank(b)) || (new Date(b.created_at) - new Date(a.created_at)));
const rank = (p) => ({ needs_review: 0, publish_failed: 1, pending_approval: 2 }[p.status] ?? 3);
const media = (p) => p.media_path ? `/${p.media_path}?v=${encodeURIComponent(p.updated_at || '')}` : (p.image_url || null);

// ---------- render ----------
function render() {
  if (!ui.state) return;
  renderTop();
  renderAlerts();
  renderStatus();
  renderKpis();
  renderWeek();
  $('#c-review').textContent = queue().length;
  $('#c-posts').textContent = posts().filter((p) => p.status !== 'drafting').length;
  $('#c-runs').textContent = (ui.state.runs || []).length;
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === ui.tab)));
  const view = $('#view');
  if (ui.tab === 'review') renderReview(view);
  else if (ui.tab === 'posts') renderPosts(view);
  else if (ui.tab === 'runs') renderRuns(view);
  else renderSettings(view);
  $('#server-time').textContent = `Server time ${fmt(ui.state.server_time, { dateStyle: 'medium', timeStyle: 'medium' })} (${tz()})`;
}

function renderTop() {
  const dry = setting('dry_run') !== 'false';
  $('#env-chip').innerHTML = dry
    ? `<span class="chip dry" title="Facebook calls are simulated"><span class="dot"></span>Dry run</span>`
    : `<span class="chip live" title="Posting to the configured Facebook Page"><span class="dot"></span>Live: Facebook</span>`;
  $$('#mode-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === setting('publish_mode'))));
  const btn = $('#run-now');
  const running = isRunning() || ui.busy.has('run');
  btn.disabled = running;
  btn.innerHTML = running ? '<span class="spinner"></span><span>Running…</span>' : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z"/></svg><span>Run now</span>`;
}

function renderAlerts() {
  const alerts = ui.state.alerts || [];
  $('#alerts').innerHTML = alerts.slice(0, 3).map((a) => `
    <div class="alert ${esc(a.severity)}">${I.warn}
      <div class="body"><div class="title">${esc(a.message)}</div>
        <div class="meta">${esc(a.source)} · ${ago(a.created_at)}</div></div>
      <button class="btn sm" data-ack="${a.id}">Dismiss</button>
    </div>`).join('') + (alerts.length > 3 ? `<div class="muted" style="font-size:12px">+${alerts.length - 3} more · <button class="btn ghost sm" data-ack="all">Dismiss all</button></div>` : '');
}

function nextRunAt() {
  // Schedule trigger fires daily at 07:00 server time.
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - Math.floor(now / 60000) * 60000;
  let t = Date.UTC(+parts.year, +parts.month - 1, +parts.day, 7, 0) - offset;
  if (t <= now.getTime()) t += 86400000;
  return new Date(t).toISOString();
}

function renderStatus() {
  const runs = (ui.state.runs || []).filter((r) => r.workflow === 'pipeline');
  const live = runs.find((r) => r.status === 'running');
  const last = runs.find((r) => r.status !== 'running');
  const el = $('#run-status');
  el.classList.toggle('running', !!live);
  if (live) {
    const secs = Math.round((Date.now() - new Date(live.started_at)) / 1000);
    const step = secs < 8 ? 'Reading PlacidWay sitemaps' : secs < 14 ? 'Extracting the chosen page' : secs < 75 ? 'Claude is writing the post' : 'Guardrails are reviewing the draft';
    el.innerHTML = `<span class="pulse"></span><div class="text"><strong>${step}…</strong><span class="muted">Run ${esc(live.run_id)} · started ${secs}s ago via ${esc(live.trigger)}</span></div><span class="spinner" style="color:var(--coral)"></span>`;
  } else {
    const d = last?.details || {};
    el.innerHTML = `<span class="pulse"></span><div class="text"><strong>Next scheduled run ${ago(nextRunAt())} · ${fmt(nextRunAt(), { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
      <span class="muted">${last ? `Last run ${ago(last.finished_at || last.started_at)}: ${esc(STATUS_LABEL[last.status] || last.status)}${d.title ? ` · “${esc(d.title)}”` : ''}` : 'No runs yet: press Run now to generate the first draft.'}</span></div>`;
  }
}

function renderKpis() {
  const ps = posts();
  const live = ps.filter((p) => ['published', 'scheduled'].includes(p.status));
  const sched = ps.filter((p) => p.status === 'scheduled').length;
  const review = ps.filter((p) => ['pending_approval', 'needs_review'].includes(p.status));
  const attention = ps.filter((p) => ['needs_review', 'publish_failed'].includes(p.status)).length;
  const checked = ps.filter((p) => p.guardrail && p.guardrail.rules);
  const firstPass = checked.filter((p) => p.guardrail.passed && p.attempts === 1).length;
  const avgAttempts = checked.length ? (checked.reduce((s, p) => s + (p.attempts || 0), 0) / checked.length).toFixed(1) : '—';
  const tracked = live.filter((p) => p.reactions != null);
  const eng = tracked.reduce((s, p) => s + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0);
  $('#kpis').innerHTML = `
    <div class="kpi k1"><div class="label">Published</div><div class="value">${live.length}</div><div class="sub">${sched ? `${sched} scheduled · ` : ''}${live.filter((p) => p.dry_run).length} simulated</div></div>
    <div class="kpi k2"><div class="label">Awaiting review</div><div class="value">${review.length}</div><div class="sub">${attention ? `${attention} flagged by guardrails` : 'Nothing flagged'}</div></div>
    <div class="kpi k3"><div class="label">Guardrail first-pass</div><div class="value">${checked.length ? Math.round(firstPass / checked.length * 100) : '—'}<small>%</small></div><div class="sub">avg ${avgAttempts} attempts per post</div></div>
    <div class="kpi k4"><div class="label">Engagement</div><div class="value">${tracked.length ? eng : '—'}</div><div class="sub">${tracked.length ? `across ${tracked.length} live posts` : ui.state.env?.fb_configured ? 'Waiting for first read-back' : 'Add a Page token to track'}</div></div>`;
}

function renderWeek() {
  let rot = {};
  try { rot = JSON.parse(setting('rotation') || '{}'); } catch { /* ignore */ }
  const now = new Date();
  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz() }).format(now);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayIdx = names.indexOf(todayName);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const dayKey = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: tz() }).format(new Date(iso));
  $('#week').innerHTML = order.map((d) => {
    const delta = order.indexOf(d) - order.indexOf(todayIdx);      // days from today within this Mon–Sun week
    const date = new Date(now.getTime() + delta * 86400000);
    const key = dayKey(date.toISOString());
    const dayPosts = posts().filter((p) => p.status !== 'drafting' && dayKey(p.created_at) === key);
    const p = dayPosts[0];
    return `<div class="day ${d === todayIdx ? 'today' : ''}">
      <div class="dname"><span>${names[d]}</span><span>${new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: tz() }).format(date)}</span></div>
      <div class="dtype">${esc(TYPE_LABEL[rot[d]] || rot[d] || '—')}</div>
      <div class="dpost" title="${esc(p?.title || '')}">${p ? `${pill(p.status, '')} ${esc(p.title)}` : `<span class="muted">${delta > 0 ? 'Upcoming' : delta === 0 ? 'Today' : 'No post'}</span>`}${dayPosts.length > 1 ? ` <span class="muted">+${dayPosts.length - 1}</span>` : ''}</div>
    </div>`;
  }).join('');
}

// ---------- review ----------
function renderReview(view) {
  const q = queue();
  let sel = posts().find((p) => p.id === ui.selected);
  if (!sel || (!q.includes(sel) && ui.tab === 'review' && !ui.pinSelected)) sel = q[0] || sel;
  if (sel) ui.selected = sel.id;
  if (!q.length && !sel) {
    view.innerHTML = `<div class="empty">${I.inbox}<h3>Inbox zero</h3><p>No drafts are waiting. ${setting('publish_mode') === 'auto' ? 'Auto-publish is on, so clean drafts go straight out.' : 'The next draft lands here after the scheduled run.'}</p>
      <button class="btn coral" data-run="1" style="margin-top:12px">${I.spark} Generate a draft now</button></div>`;
    return;
  }
  const keepScroll = $('.excerpt')?.scrollTop;
  view.innerHTML = `<div class="review">
    <div class="queue" role="list">${q.map(qItem).join('') || '<div class="muted" style="padding:8px">Queue is empty</div>'}</div>
    <div>${sel ? detail(sel) : ''}</div></div>`;
  if (keepScroll != null && $('.excerpt')) $('.excerpt').scrollTop = keepScroll;
  if (ui.editing) { const ta = $('#editor'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
}

function qItem(p) {
  const img = media(p);
  return `<button class="qitem" role="listitem" data-select="${p.id}" aria-current="${p.id === ui.selected}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
    <div><div class="qt">${esc(p.title)}</div>
    <div class="qm">${pill(p.status)}<span class="pill t-pill">${esc(TYPE_LABEL[p.content_type] || p.content_type)}</span></div></div>
  </button>`;
}

function fbText(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.length > 60 ? u.slice(0, 57) + '…' : u}</a>`)
    .replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, '$1<span class="tag">$2</span>');
}

function liveChecks(p, text) {
  if (typeof runRuleChecks !== 'function') return null;
  const parsed = parsePostText(text, p.source_url);
  return { parsed, result: runRuleChecks(parsed, { excerpt: p.source_excerpt || '', url: p.source_url }, text === p.post_text ? (p.claims || []) : null) };
}

function detail(p) {
  const g = p.guardrail || {};
  const editable = ['pending_approval', 'needs_review', 'publish_failed'].includes(p.status);
  const text = ui.editing ? ui.draft : p.post_text || '';
  const live = liveChecks(p, text);
  const checks = (ui.editing && live ? live.result.checks : g.rules?.checks) || [];
  const rulesPass = checks.length ? checks.every((c) => c.pass) : false;
  const llm = g.llm || {};
  const passed = ui.editing ? rulesPass : !!g.passed;
  const bodyChars = live ? live.parsed.body_chars : 0;
  const img = media(p);
  const busyA = ui.busy.has(`approve-${p.id}`);
  const actions = editable ? `
      ${ui.editing
        ? `<button class="btn ghost" data-cancel-edit>Cancel</button>`
        : `<button class="btn" data-edit>${I.edit} Edit</button>`}
      <button class="btn danger" data-reject="${p.id}">${I.x} Reject</button>
      <button class="btn primary" data-approve="${p.id}" ${busyA || (ui.editing && !rulesPass) ? 'disabled' : ''}>${busyA ? '<span class="spinner"></span>' : I.send}
        ${p.status === 'publish_failed' ? 'Retry publish' : setting('dry_run') !== 'false' ? 'Approve & publish (dry run)' : 'Approve & publish'}</button>`
    : p.fb_permalink ? `<a class="btn" href="${esc(p.fb_permalink)}" target="_blank" rel="noopener">${I.ext} View on Facebook</a>` : '';

  const attempts = g.attempts_log || [];
  const fresh = ui.lastDetail !== p.id;
  ui.lastDetail = p.id;
  return `<div class="detail${fresh ? ' enter' : ''}">
    <div class="detail-head">
      <div style="min-width:0;flex:1">
        <h2>${esc(p.title)}</h2>
        <div class="meta">${pill(p.status)}<span class="pill t-pill">${esc(TYPE_LABEL[p.content_type] || p.content_type)}</span>
          <span>${esc(p.category || '')}</span><span>·</span><span>Drafted ${ago(p.created_at)}</span>
          ${p.edited ? '<span>· edited by reviewer</span>' : ''}${p.reviewed_by ? `<span>· ${esc(p.reviewed_by)}</span>` : ''}
          ${p.scheduled_for ? `<span>· scheduled ${fmt(p.scheduled_for)}</span>` : ''}</div>
        ${p.error ? `<div class="alert" style="margin-top:10px">${I.warn}<div class="body"><div class="title">${esc(p.error)}</div></div></div>` : ''}
        ${p.status === 'needs_review' ? `<div class="alert warning" style="margin-top:10px">${I.warn}<div class="body"><div class="title">Guardrails could not clear this draft after ${p.attempts} attempt${p.attempts > 1 ? 's' : ''}</div><div class="meta">It will never auto-publish. Edit until every rule passes, or reject it.</div></div></div>` : ''}
      </div>
      <div class="actions">${actions}</div>
    </div>

    <div class="stack">
      <div class="fb" aria-label="Facebook post preview">
        <div class="fb-head"><div class="fb-avatar">P</div><div><div class="fb-name">PlacidWay Test Page</div>
          <div class="fb-time">${p.published_at ? ago(p.published_at) : p.scheduled_for ? `Scheduled · ${fmt(p.scheduled_for, { dateStyle: 'short', timeStyle: 'short' })}` : 'Preview'} · <svg width="12" height="12" viewBox="0 0 16 16" fill="#65676B"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm5.9 7h-2.4a12 12 0 00-1-4.6A6 6 0 0113.9 7zM8 2c.7 1 1.4 2.8 1.5 5h-3C6.6 4.8 7.3 3 8 2zM5.5 2.4A12 12 0 004.5 7H2.1a6 6 0 013.4-4.6zM2.1 9h2.4a12 12 0 001 4.6A6 6 0 012.1 9zM8 14c-.7-1-1.4-2.8-1.5-5h3C9.4 11.2 8.7 13 8 14zm2.5-.4a12 12 0 001-4.6h2.4a6 6 0 01-3.4 4.6z"/></svg></div></div><div class="fb-dots">···</div></div>
        ${ui.editing ? `<textarea id="editor" class="fb-edit" spellcheck="true" aria-label="Edit post text">${esc(ui.draft)}</textarea>` : `<div class="fb-text">${fbText(text)}</div>`}
        ${img ? `<img class="fb-img" src="${esc(img)}" alt="Post image">` : ''}
        <div class="fb-stats"><span class="fb-reacts">${p.reactions != null ? `<span class="r" style="background:#1877F2">👍</span><span class="r" style="background:#F33E58">❤</span><span style="margin-left:12px">${p.reactions}</span>` : '<span>—</span>'}</span>
          <span>${p.comments != null ? `${p.comments} comments · ${p.shares || 0} shares` : p.clicks != null ? `${p.clicks} clicks${p.views != null ? ` · ${p.views} views` : ''}` : p.dry_run ? 'Simulated: no engagement' : ''}</span></div>
        <div class="fb-actions"><span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span></div>
      </div>
      <div class="panel"><div class="fb-ribbon">
        <span>${bodyChars} / 500 before link</span>
        <div class="meter"><i style="width:${Math.min(100, bodyChars / 5)}%;background:${bodyChars >= 500 ? 'var(--red)' : bodyChars > 440 ? 'var(--amber)' : 'var(--green)'}"></i></div>
        <span>${live ? live.parsed.hashtags.length : 0} hashtags</span>
      </div></div>
    </div>

    <div class="stack">
      <div class="panel">
        <div class="verdict ${passed ? 'pass' : 'fail'}">
          <div class="badge">${passed ? I.shield : I.warn}</div>
          <div><h4>${ui.editing ? (rulesPass ? 'Your edit passes every rule' : 'Your edit breaks a rule') : passed ? 'Cleared by both guardrail layers' : 'Held by guardrails'}</h4>
          <p>${ui.editing ? 'Checked live with the same rule engine the pipeline runs. The AI reviewer is advisory for human edits.' : `${checks.filter((c) => c.pass).length}/${checks.length} rules passed · reviewer: ${esc(llm.verdict || '—')} · ${p.attempts || 0} attempt${p.attempts === 1 ? '' : 's'}`}</p></div>
        </div>
        ${attempts.length > 1 ? `<ol class="timeline" aria-label="Attempts">${attempts.map((a) => `<li class="${a.passed ? 'ok' : 'bad'}" title="${esc((a.failed_rules || []).join(', ') || (a.passed ? 'passed' : `reviewer: ${a.llm_verdict}`))}"><span class="n">${a.attempt}</span>${a.passed ? 'passed' : esc((a.failed_rules || [])[0]?.replace('_', ' ') || `reviewer ${a.llm_verdict}`)}</li>`).join('')}</ol>` : ''}
        <ul class="checks">${checks.map((c) => `<li class="${c.pass ? 'ok' : 'bad'}"><span class="ic">${c.pass ? I.check : I.x}</span><div><div class="lbl">${esc(c.label)}</div><div class="det">${esc(c.detail)}</div></div></li>`).join('')}</ul>
        ${llm.summary ? `<div class="llm"><div class="llm-h">${I.spark.replace('<svg', '<svg width="15" height="15"')} AI compliance reviewer <span class="pill ${llm.verdict === 'pass' ? 's-published' : 's-needs_review'}">${esc(llm.verdict)}</span><span class="muted mono" style="margin-left:auto">${esc((llm.model || '').replace(/-\d{8}$/, ''))}</span></div>
          <p>${esc(llm.summary)}</p>
          ${(llm.issues || []).map((i) => `<div class="issue ${esc(i.severity)}"><strong>${esc(i.type.replace('_', ' '))}</strong> · ${esc(i.severity)}<br><q>${esc(i.excerpt)}</q>: ${esc(i.explanation)}</div>`).join('')}</div>` : ''}
      </div>

      ${sourcePanel(p)}
    </div>
  </div>`;
}

function locate(excerpt, quote) {
  const lower = excerpt.toLowerCase();
  const q = String(quote || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!q) return null;
  let i = lower.indexOf(q);
  if (i >= 0) return [i, i + q.length];
  const words = q.split(' ');
  for (let n = Math.min(words.length, 10); n >= 4; n--) {
    for (let s = 0; s + n <= words.length; s++) {
      const frag = words.slice(s, s + n).join(' ');
      i = lower.indexOf(frag);
      if (i >= 0) return [i, i + frag.length];
    }
  }
  return null;
}

function sourcePanel(p) {
  const ex = p.source_excerpt || '';
  const claims = p.claims || [];
  const ranges = claims.map((c, idx) => { const r = locate(ex, c.source_quote); return r ? { s: r[0], e: r[1], idx } : null; })
    .filter(Boolean).sort((a, b) => a.s - b.s);
  let html = '';
  let pos = 0;
  for (const r of ranges) {
    if (r.s < pos) continue;
    html += esc(ex.slice(pos, r.s)) + `<mark data-claim="${r.idx}">${esc(ex.slice(r.s, r.e))}</mark>`;
    pos = r.e;
  }
  html += esc(ex.slice(pos));
  const sel = g(p).selection || {};
  return `<div class="panel">
    <div class="panel-h"><h3>Source & grounding</h3><div class="right"><a class="btn sm" href="${esc(p.source_url)}" target="_blank" rel="noopener">${I.ext} Open page</a></div></div>
    <dl class="source-meta">
      <dt>URL</dt><dd class="mono" title="${esc(p.source_url)}">${esc(p.source_url.replace('https://www.placidway.com', ''))}</dd>
      <dt>Why this</dt><dd title="${esc(sel.reason || '')}">${esc(sel.reason || '—')}</dd>
      <dt>Extracted</dt><dd>${esc(g(p).extracted_via || '—')} · writer ${esc(String(g(p).writer_model || '—').replace(/-\d{8}$/, ''))}</dd>
    </dl>
    ${claims.length ? `<ul class="claims">${claims.map((c, i) => `<li data-claim-row="${i}"><span class="num">${i + 1}</span><div><div class="line">${esc(c.line)}</div><div class="q">“${esc(c.source_quote)}”</div></div></li>`).join('')}</ul>` : ''}
    <div class="excerpt" tabindex="0" aria-label="Source excerpt the model was allowed to use">${html || '<span class="muted">No excerpt stored</span>'}</div>
  </div>`;
}
const g = (p) => p.guardrail || {};

// ---------- posts ----------
function renderPosts(view) {
  const filters = [['all', 'All'], ['published', 'Published'], ['scheduled', 'Scheduled'], ['pending_approval', 'Awaiting'], ['needs_review', 'Needs review'], ['rejected', 'Rejected'], ['failed', 'Failed']];
  const list = posts().filter((p) => p.status !== 'drafting')
    .filter((p) => ui.postFilter === 'all' || p.status === ui.postFilter || (ui.postFilter === 'failed' && p.status === 'publish_failed'));
  view.innerHTML = `<div class="filters" role="group" aria-label="Filter posts">${filters.map(([k, l]) => `<button data-filter="${k}" aria-pressed="${ui.postFilter === k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="grid">${list.map((p, i) => postCard(p, i)).join('')}</div>` : `<div class="empty">${I.inbox}<h3>No posts here yet</h3><p>Generated posts and their outcomes will appear here.</p></div>`}`;
}

function postCard(p, i) {
  const img = media(p);
  const eng = p.reactions != null
    ? `<span class="eng"><span title="Reactions">${I.like}${p.reactions}</span>${p.comments != null ? `<span title="Comments">${I.comment}${p.comments}</span>` : ''}${p.shares != null ? `<span title="Shares">${I.share}${p.shares}</span>` : ''}${p.clicks != null ? `<span title="Clicks">${I.click}${p.clicks}</span>` : ''}${p.views != null ? `<span title="Views">👁 ${p.views}</span>` : ''}</span>`
    : `<span class="muted">${p.dry_run && ['published', 'scheduled'].includes(p.status) ? 'Simulated publish' : 'No engagement yet'}</span>`;
  return `<article class="pcard" style="animation-delay:${Math.min(i, 12) * 30}ms">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
    <div class="pb">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${pill(p.status)}<span class="pill t-pill">${esc(TYPE_LABEL[p.content_type] || p.content_type)}</span></div>
      <div class="pt">${esc(p.title)}</div>
      <div class="hook">${esc((p.post_text || '').split('\n')[0])}</div>
    </div>
    <div class="pf">${eng}<span style="margin-left:auto">${fmt(p.published_at || p.created_at, { dateStyle: 'medium' })}</span>
      <button class="btn sm" data-open="${p.id}">Details</button>
      ${p.fb_permalink ? `<a class="btn sm" href="${esc(p.fb_permalink)}" target="_blank" rel="noopener" aria-label="View on Facebook">${I.ext}</a>` : ''}</div>
  </article>`;
}

// ---------- runs ----------
function renderRuns(view) {
  const runs = ui.state.runs || [];
  if (!runs.length) { view.innerHTML = `<div class="empty">${I.inbox}<h3>No runs logged yet</h3><p>Every pipeline and publish execution is recorded here with its outcome.</p></div>`; return; }
  view.innerHTML = `<div class="panel"><div class="panel-h"><h3>Executions</h3><div class="right muted" style="font-size:12px">Click a row for details · last ${runs.length}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Run</th><th>Workflow</th><th>Trigger</th><th>Status</th><th>Item</th><th>Started</th><th>Duration</th><th>FB post</th></tr></thead><tbody>
    ${runs.map((r) => `<tr class="clickable" data-run-row="${esc(r.run_id)}">
      <td class="mono">${esc(r.run_id)}</td><td>${esc(r.workflow)}</td><td>${esc(r.trigger || '—')}</td><td>${pill(r.status)}</td>
      <td><span class="trunc" title="${esc(r.item_url || '')}">${esc(r.details?.title || (r.item_url || '').replace('https://www.placidway.com', '') || r.details?.note || '—')}</span>${r.error ? `<span class="trunc" style="color:var(--red);font-size:12px">${esc(r.error)}</span>` : ''}</td>
      <td title="${esc(fmt(r.started_at))}">${ago(r.started_at)}</td><td>${r.status === 'running' ? '<span class="spinner" style="color:var(--coral)"></span>' : dur(r.started_at, r.finished_at)}</td>
      <td class="mono">${esc(r.fb_post_id ? (r.fb_post_id.startsWith('dryrun') ? 'simulated' : r.fb_post_id) : '—')}</td></tr>
      ${ui.expandedRun === r.run_id ? `<tr class="expand"><td colspan="8"><pre class="json">${esc(JSON.stringify({ details: r.details, error: r.error, mode: r.mode, dry_run: r.dry_run, post_id: r.post_id }, null, 2))}</pre></td></tr>` : ''}`).join('')}
    </tbody></table></div></div>`;
}

// ---------- settings ----------
function renderSettings(view) {
  const v = (k) => (k in ui.settingsDirty ? ui.settingsDirty[k] : setting(k));
  const sw = (k) => `<label class="switch"><input type="checkbox" data-set="${k}" ${v(k) === 'true' ? 'checked' : ''}><span></span></label>`;
  let rot = {};
  try { rot = JSON.parse(v('rotation') || '{}'); } catch { /* ignore */ }
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const env = ui.state.env || {};
  const dirty = Object.keys(ui.settingsDirty).length;
  view.innerHTML = `<div class="settings">
    <div class="panel">
      <div class="panel-h"><h3>Pipeline settings</h3><div class="right">
        ${dirty ? `<span class="muted" style="font-size:12px">${dirty} unsaved change${dirty > 1 ? 's' : ''}</span><button class="btn ghost sm" data-settings-reset>Discard</button>` : ''}
        <button class="btn primary sm" data-settings-save ${dirty ? '' : 'disabled'}>Save changes</button></div></div>
      <div class="field"><label for="s-mode">Publish mode</label><div class="help">Approval sends every clean draft to this dashboard. Auto publishes clean drafts immediately. Flagged drafts always wait for a human.</div>
        <div class="control"><select id="s-mode" data-set="publish_mode"><option value="approval" ${v('publish_mode') === 'approval' ? 'selected' : ''}>Approval</option><option value="auto" ${v('publish_mode') === 'auto' ? 'selected' : ''}>Auto-publish</option></select></div></div>
      <div class="field"><label>Dry run</label><div class="help">Simulate the Facebook Graph API calls (recorded in the run log). Turn off only once a Page token is configured.</div><div class="control">${sw('dry_run')}</div></div>
      <div class="field"><label for="s-time">Post time</label><div class="help"><code>now</code> publishes on approval; <code>HH:MM</code> (${esc(tz())}) schedules natively on Facebook for the next slot.</div>
        <div class="control"><input id="s-time" type="text" data-set="post_time" value="${esc(v('post_time'))}" size="6" pattern="now|\\d{1,2}:\\d{2}"></div></div>
      <div class="field"><label>Brand images</label><div class="help">Add the PlacidWay bar to featured images, or render a title card when a page has no image.</div><div class="control">${sw('brand_images')}</div></div>
      <div class="field"><label>Cross-post to Instagram</label><div class="help">Publish the branded image to the linked Instagram Business account (needs IG_USER_ID).</div><div class="control">${sw('crosspost_instagram')}</div></div>
      <div class="field"><label for="s-att">Max generation attempts</label><div class="help">Rewrites with guardrail feedback before escalating to human review.</div>
        <div class="control"><input id="s-att" type="number" min="1" max="5" data-set="max_attempts" value="${esc(v('max_attempts'))}" style="width:70px"></div></div>
      <div class="field"><label for="s-cat">Category cool-down</label><div class="help">Avoid repeating a treatment category used in the last N posts.</div>
        <div class="control"><input id="s-cat" type="number" min="0" max="9" data-set="avoid_recent_categories" value="${esc(v('avoid_recent_categories'))}" style="width:70px"></div></div>
      <div class="field" style="border-bottom:0"><label>Weekly content rotation</label><div class="help">Which content type each day prefers (falls back to another type if nothing fresh).</div></div>
      <div class="rotation">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label>${names[d]}<select data-rot="${d}">${['article', 'package', 'answer', 'news'].map((t) => `<option value="${t}" ${rot[d] === t ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}</select></label>`).join('')}</div>
    </div>
    <div class="stack">
      <div class="panel"><div class="panel-h"><h3>Environment</h3></div><ul class="envlist">
        <li><span>Facebook Page token</span>${env.fb_configured ? '<span class="ok-t">Configured</span>' : '<span class="bad-t">Not set</span>'}</li>
        <li><span>Instagram account</span>${env.ig_configured ? '<span class="ok-t">Configured</span>' : '<span class="muted">Not set</span>'}</li>
        <li><span>LLM backend</span><span class="mono">${esc(env.llm_backend)}</span></li>
        <li><span>Writer model</span><span class="mono">${esc(env.writer_model)}</span></li>
        <li><span>Reviewer model</span><span class="mono">${esc(env.reviewer_model)}</span></li>
        <li><span>Timezone</span><span class="mono">${esc(env.tz)}</span></li>
        <li><span>Schedule</span><span>Daily 07:00 · engagement every 6 h</span></li>
      </ul></div>
      <div class="panel"><div class="panel-h"><h3>Shortcuts</h3></div><div class="panel-b" style="display:flex;flex-direction:column;gap:8px">
        <a class="btn" href="http://localhost:5678" target="_blank" rel="noopener">${I.ext} Open n8n editor</a>
        <button class="btn" data-engagement>${I.retry} Refresh engagement now</button>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['article', 'package', 'answer', 'news'].map((t) => `<button class="btn sm" data-run-type="${t}" ${isRunning() ? 'disabled' : ''}>Run: ${TYPE_LABEL[t]}</button>`).join('')}</div>
      </div></div>
    </div>
  </div>`;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a, tr');
  if (!t) return;
  const d = t.dataset;

  if (t.classList.contains('tab')) {
    ui.tab = d.tab; ui.editing = false; ui.pinSelected = false;
    try { localStorage.setItem('pw.tab', ui.tab); } catch (err) { /* ignore */ }
    render(); return;
  }
  if (d.select) { ui.selected = Number(d.select); ui.editing = false; render(); return; }
  if (d.open) { ui.selected = Number(d.open); ui.pinSelected = true; ui.tab = 'review'; ui.editing = false; render(); window.scrollTo({ top: $('.tabs').offsetTop - 70, behavior: 'smooth' }); return; }
  if (d.filter) { ui.postFilter = d.filter; render(); return; }
  if (d.runRow) { ui.expandedRun = ui.expandedRun === d.runRow ? null : d.runRow; render(); return; }
  if ('edit' in d) { const p = posts().find((x) => x.id === ui.selected); ui.editing = true; ui.draft = p.post_text || ''; render(); return; }
  if ('cancelEdit' in d) { ui.editing = false; render(); return; }

  if (d.approve) {
    const id = Number(d.approve);
    const p = posts().find((x) => x.id === id);
    const body = { action: p.status === 'publish_failed' ? 'retry' : 'approve', id, reviewer: 'dashboard' };
    if (ui.editing && ui.draft !== p.post_text) body.post_text = ui.draft;
    const r = await act(`approve-${id}`, body, (res) => res.result?.status === 'scheduled' ? `Scheduled for ${fmt(res.result.scheduled_for)}` : res.result?.dry_run ? 'Published (simulated: dry run)' : 'Published to Facebook');
    if (r && r.ok !== false) { ui.editing = false; ui.pinSelected = false; }
    return;
  }
  if (d.reject) {
    const dlg = $('#reject-dialog');
    $('#reject-note').value = '';
    dlg.returnValue = '';
    dlg.showModal();
    dlg.addEventListener('close', async () => {
      if (dlg.returnValue === 'ok') {
        await act(`reject-${d.reject}`, { action: 'reject', id: Number(d.reject), note: $('#reject-note').value, reviewer: 'dashboard' }, 'Draft rejected');
        ui.editing = false;
      }
    }, { once: true });
    return;
  }
  if (d.ack) { await act(`ack-${d.ack}`, { action: 'ack', id: d.ack === 'all' ? null : Number(d.ack) }); return; }
  if (t.id === 'run-now' || d.run || d.runType) {
    await act('run', { action: 'run', force_type: d.runType || null }, 'Pipeline started: a fresh draft will appear in about two minutes');
    return;
  }
  if (d.mode && t.closest('#mode-toggle')) {
    if (d.mode === setting('publish_mode')) return;
    await act('mode', { action: 'settings', settings: { publish_mode: d.mode } }, d.mode === 'auto' ? 'Auto-publish on: clean drafts publish without review' : 'Approval mode on: drafts wait for you');
    return;
  }
  if ('settingsSave' in d) {
    const changes = { ...ui.settingsDirty };
    if (changes.dry_run === 'false' && !ui.state.env?.fb_configured && !confirm('No Facebook Page token is configured. Turn off dry run anyway? Publishing will fail until FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN are set.')) return;
    const r = await act('settings', { action: 'settings', settings: changes }, (res) => `Saved ${(res.saved || []).length} setting(s)`);
    if (r && r.ok !== false) ui.settingsDirty = {};
    render();
    return;
  }
  if ('settingsReset' in d) { ui.settingsDirty = {}; render(); return; }
  if ('engagement' in d) { await act('engagement', { action: 'engagement' }, 'Engagement refreshed'); return; }
  if (t.id === 'theme-toggle') {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pw.theme', next); } catch (err) { /* ignore */ }
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'editor') {
    ui.draft = e.target.value;
    const pos = e.target.selectionStart;
    const scroll = e.target.scrollTop;
    clearTimeout(ui.editT);
    ui.editT = setTimeout(() => {
      render();
      const ta = $('#editor');
      if (ta) { ta.setSelectionRange(pos, pos); ta.scrollTop = scroll; ta.focus(); }
    }, 180);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.set) {
    const val = el.type === 'checkbox' ? String(el.checked) : String(el.value).trim();
    if (val === setting(el.dataset.set)) delete ui.settingsDirty[el.dataset.set]; else ui.settingsDirty[el.dataset.set] = val;
    render();
  }
  if (el.dataset.rot != null) {
    let rot = {};
    try { rot = JSON.parse(ui.settingsDirty.rotation || setting('rotation') || '{}'); } catch { /* ignore */ }
    rot[el.dataset.rot] = el.value;
    const json = JSON.stringify(Object.fromEntries(Object.keys(rot).sort().map((k) => [k, rot[k]])));
    if (json === setting('rotation')) delete ui.settingsDirty.rotation; else ui.settingsDirty.rotation = json;
    render();
  }
});

// Hovering a claim highlights its supporting quote in the source.
document.addEventListener('mouseover', (e) => {
  const row = e.target.closest('[data-claim-row]');
  $$('mark.hot').forEach((m) => m.classList.remove('hot'));
  if (row) {
    const m = $(`mark[data-claim="${row.dataset.claimRow}"]`);
    if (m) { m.classList.add('hot'); m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
});

refresh();
