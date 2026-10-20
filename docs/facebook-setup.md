# Facebook test Page setup (about 10 minutes)

The pipeline runs in **dry run** until you do this. You only need it for the live part of the recording.

> Ground rule from the brief: post only to a **test Page you own**. Never to a PlacidWay Page.

## 1. Create a test Page
facebook.com → **Pages → Create new Page**. Any name works, e.g. "PW Autopilot Test". Keep it unpublished if you like; the Graph API can still post to it.

## 2. Create a Meta app
1. Go to https://developers.facebook.com/apps → **Create app**, choose the **Other** use case, then app type **Business**.
2. Leave the app in **Development mode**. As the app admin, you can post to Pages you manage without App Review.

## 3. Get a Page access token
1. Open **Tools → Graph API Explorer** (https://developers.facebook.com/tools/explorer).
2. Select your app, then **User or Page → Get User Access Token** with these permissions:
   - `pages_show_list`
   - `pages_read_engagement` (needed for engagement read-back)
   - `pages_manage_posts`
   - *(optional)* `pages_read_user_content`, so engagement read-back can also count comments and shares (Graph v26 requires it)
   - *(optional, for Instagram)* `instagram_basic`, `instagram_content_publish`, `business_management`
3. Click **Generate Access Token** and approve.
4. Run `GET /me/accounts`. The response lists each Page you manage with its `id` and `access_token`. Copy both.

### Make it long-lived (recommended)
The token from the Explorer expires in about an hour. Exchange it first:

```
GET https://graph.facebook.com/v26.0/oauth/access_token
    ?grant_type=fb_exchange_token
    &client_id={APP_ID}
    &client_secret={APP_SECRET}
    &fb_exchange_token={SHORT_LIVED_USER_TOKEN}
```

Then call `GET /me/accounts` with the **long-lived user token**. The Page tokens it returns don't expire as long as the user stays an admin and keeps the app authorised.

Check any token at https://developers.facebook.com/tools/debug/accesstoken.

## 4. Configure and go live
```bash
# .env
FB_PAGE_ID=123456789012345
FB_PAGE_ACCESS_TOKEN=EAAG...
# optional
IG_USER_ID=1784...         # GET /{page-id}?fields=instagram_business_account
```

```bash
docker compose up -d n8n        # re-reads .env
```

Then in the dashboard → **Settings**, turn **Dry run** off and save. The header chip turns green ("Live: Facebook").

### Tip: get the Page token without copying it around
With a long-lived **user** token you can fetch the Page token directly:
`GET /{page-id}?fields=access_token`. Page tokens obtained from a long-lived user token don't expire. Check one in the debugger: `type: PAGE`, `expires_at: 0`.

> When you approve the consent screen, Facebook may grant access to **every** Page you manage. To restrict it, go to Facebook → Settings → Business integrations → your app → Edit.

## What the workflow calls
| Step | Call |
|---|---|
| Upload image (unpublished) | `POST /{page-id}/photos` multipart `source`, `published=false`, `temporary=<scheduled>` |
| Create the post | `POST /{page-id}/feed` JSON `{ message, attached_media:[{media_fbid}], published, scheduled_publish_time? }` |
| Text-only fallback | `POST /{page-id}/feed` `{ message, link }` |
| Permalink | `GET /{post-id}?fields=permalink_url` |
| Engagement | `GET /{post-id}/insights?metric=post_reactions_by_type_total,post_clicks,post_media_view` (needs `pages_read_engagement`), then `GET /{post-id}?fields=reactions.summary(total_count),comments.summary(total_count),shares` (needs `pages_read_user_content`, optional) |
| Instagram (optional) | `GET /{photo-id}?fields=images` → `POST /{ig-user}/media` → `POST /{ig-user}/media_publish` |

## Failure modes you'll see in the dashboard
| Graph error | What the alert says |
|---|---|
| `190` / OAuthException | Token invalid or expired: generate a new long-lived Page token |
| `10`, `200` | Missing permission (`pages_manage_posts` / `pages_read_engagement`) |
| `4`, `17`, `32`, `613`, HTTP 429 | Rate limited: retry from the dashboard later |
| 5xx / timeout | Facebook unreachable after 3 retries |

The post moves to **Publish failed** with a **Retry publish** button, so nothing is lost.
