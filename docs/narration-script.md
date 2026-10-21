# Narration script
Read one scene per take in the recorder (`cd video && npm run record` → http://localhost:8095). About 6 minutes in total.

## 01 · Intro

Hi, I'm Irvan. This is my submission for the AI Automation assessment. I built a production-minded n8n workflow that turns public PlacidWay content into one on-brand, fact-checked Facebook post every day. In the next few minutes I'll run it live, from extraction all the way to a published post, and explain the decisions behind it.

## 02 · Architecture

Here's the shape of it. n8n runs five workflows in Docker: the daily pipeline, a publish sub-workflow, a small API for the review dashboard, an engagement read-back, and an error handler that every other workflow reports to. Postgres is the memory: which URLs were used, every draft, every run, every alert. The writing and fact-checking happen in Claude, through the Claude CLI on my machine, and publishing goes through the Facebook Graph API to a test page I own.

## 03 · The brief

Every line of the brief maps to something concrete: a daily schedule plus manual runs, sitemap extraction, a never-twice selection store, structured generation, two layers of guardrails, an approval switch, and logging with retries and alerts.

## 04 · The workflow

This is the main pipeline, laid out in six stages. Select reads PlacidWay's public sitemaps: four requests, a second apart, which is exactly what robots dot txt invites crawlers to use. Extract claims the URL in the database before any expensive work, so a unique constraint, not workflow logic, guarantees we never post the same page twice. Then generate, guardrails, image, and finally save and publish.

## 05 · Live run

Here's a live run. It ran on a Tuesday, so the weekday rotation preferred a treatment package, and it skipped any category used in the last three posts. It picked a women's health screening package and logged why. Extraction reads the page's own structured data: the body text, the listed price, the FAQ and the category. Then Claude writes the post, but not as free text. It returns a hook, two to four value lines, a call to action and hashtags, plus a verbatim quote from the source for every line it writes. Code assembles the final post, so the format is guaranteed.

## 06 · Guardrails

This is the part I care about most. A medical tourism brand can't afford a post that promises a cure or invents a price, so every draft passes two independent checks. First, deterministic rules: structure, length, hashtags, no outcome promises, and every number and every price must appear in the source, with every quote really present on the page. Second, a separate Claude model audits the post against the source like a compliance reviewer. If either one fails, the findings go back to the writer for a rewrite. After three tries it goes to a human, and it can never auto-publish.

## 07 · Human review

The draft lands in the review dashboard. On the left is exactly what Facebook will show, with the branded image. On the right, the guardrail report, and the source text with each claim's supporting quote highlighted. If I edit the post and type something like 'guaranteed results', the same rule engine flags it as I type and blocks the approval. The server re-checks too, so the interface can't be bypassed.

## 08 · Publish

Approval mode is one switch; in auto mode, clean drafts publish straight away. I'll approve this one. The image is uploaded first, then attached to a feed post, the same path Facebook uses for scheduled posts. And here it is, live on the test page.

## 09 · Logging & failures

Every run is logged: the item chosen, the final post text, the Facebook post ID and the status. And nothing fails silently. I tested each failure for real: PlacidWay unreachable, the language model down, and an invalid Facebook token. Each one retries, then raises an alert with a specific fix. A failed draft releases its URL so the next run can try again, and a failed publish gets a one-click retry.

## 10 · Stretch goals

I also covered the stretch goals: weekday content rotation with a category cool-down, smart-cropped branded images or a rendered title card when there's no image, native Facebook scheduling, an Instagram cross-post path, this dashboard, and an engagement read-back that stores reactions, clicks and views next to each post.

## 11 · Engineering

A few engineering choices. All the Code-node logic lives in real files, with twenty-two unit tests that run against real PlacidWay pages, and a build step assembles the n8n workflows from them. Everything starts in dry run, which records the exact Graph API calls it would make. And I documented what I'd change for production: a never-expiring system-user token, an idempotency check before retrying a publish, and queue-mode n8n.

## 12 · Wrap-up

So: one trustworthy post a day, grounded in PlacidWay's own content, with a human in the loop whenever it matters. The workflows, the README and the sample posts are all in the repository. Thanks for watching. I'm looking forward to walking you through it live.
