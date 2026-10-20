# Recording run-sheet (target: 8 minutes)

Before recording:
- [ ] `docker compose up -d` and `npm run bridge` running (bridge terminal visible is a nice touch)
- [ ] Dry run **off** with your test Page token (docs/facebook-setup.md), or explain you're showing dry run
- [ ] Publish mode **Approval**, post time **now**
- [ ] Tabs open: dashboard (localhost:8080), n8n "PW · 1" canvas, your test Facebook Page
- [ ] Optional: clear a slot so the run is fresh. `Run now` always picks an unused URL

| Time | Show | Say |
|---|---|---|
| 0:00 | Dashboard hero + week strip | "One trustworthy post a day from PlacidWay content. Approval mode and a weekday rotation: today is a *package* day." |
| 0:30 | n8n canvas, PW · 1, left → right using the sticky notes | Trigger (daily 07:00 / manual / dashboard) → **Select** (sitemaps, why not RSS/headless, 5 requests a day at 1 rps) → **Extract** (JSON-LD first, OG, HTML fallback) |
| 1:45 | Click **Run now** in the dashboard; flip to n8n **Executions** to watch it live | "The URL is claimed in Postgres first, a UNIQUE constraint, so it can never post twice, even if two runs race." |
| 2:30 | While Claude writes: open `Build Prompt` / `Rule-Based Checks` | Structured output plus code assembly. Each line must cite a verbatim source quote. Walk through the rule table and the independent Haiku reviewer, then the retry-with-feedback loop and escalation to a human. |
| 4:00 | Draft lands in the **Review queue** | FB-style preview with the branded image. Guardrail report. Hover a claim and its quote lights up in the source excerpt. "Why this item" line. |
| 4:45 | Click **Edit**, type "guaranteed results" | Rules fail live and Approve disables. "The server re-checks too, so the UI can't be bypassed." Undo the edit. |
| 5:15 | **Approve & publish** | Toast → switch to the Facebook Page and refresh → the post is live with the image. Back in the dashboard: Published status and View on Facebook. |
| 6:00 | **Run log** tab, expand the publish row | Logged run: item, FB post id, status. In dry run it shows the exact Graph calls. |
| 6:30 | Show an alert banner (from the bad-token test or a stopped bridge) | Failure handling: retries, the error workflow, classified FB errors (expired token), Retry publish, optional Slack webhook. |
| 7:15 | Settings tab | Auto-publish switch, scheduling `HH:MM` natively on FB, image branding, Instagram cross-post, rotation, engagement read-back every 6 h. |
| 7:45 | README "Design decisions" | Wrap up with trade-offs and what I'd do for production. |

### Handy demos
- **Guardrail retry on camera:** use **Settings → Run: Patient Q&A**. Q&A pages often have prices and durations, which tend to trigger the number rule on attempt 1.
- **Failure on camera:** stop the bridge (`Ctrl-C`) and press **Run now**. About 20 s later the dashboard shows "LLM bridge unreachable", and the half-drafted URL is released.
- **No-image card:** set a post's `image_url` to null in SQL, or see `tools/render-test.mjs`.
