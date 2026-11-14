# WhatsApp and Instagram setup

Zenoxi can answer in Instagram DMs and WhatsApp, and conversations can continue in the Zenoxi web app:

- **Website → app:** in a chat, tap **Continue on…**. WhatsApp opens with `link CODE` already typed: send it. On
  Instagram, send `link CODE` to your Zenoxi account. The conversation (with its history and files) continues there.
- **Instagram → Zenoxi app:** send `/web` in Instagram. Zenoxi replies with a private link; open it while signed in
  to see that same conversation in the app. New messages sync between Instagram and the app.
- **WhatsApp → website:** send `/web` in WhatsApp. Zenoxi replies with a private link to the same conversation.
- Other commands: `/new` (new chat), `/search <question>` (answer with live web results), `/help`.
- On WhatsApp you can also send a PDF or Word file and ask questions about it.

## Cost

Both APIs are free to set up. Replies to people who message you first (within 24 hours) are free; Zenoxi never
starts conversations, so it doesn't need paid template messages. Meta changes pricing occasionally, so check their
pricing page before going live. The AI replies still use your OpenRouter quota (the free plan allows ~50 requests a day).

## What you need

- The backend deployed on a public HTTPS URL (for example Render): `https://YOUR-API.onrender.com`
- A Meta developer account (developers.facebook.com) and a Meta Business portfolio
- For WhatsApp: a phone number that is **not** registered in the WhatsApp app (Meta also gives you a free test number)
- For Instagram: an Instagram **Professional** account (Business or Creator)

Pick any random string as your verify token and set it as `META_VERIFY_TOKEN` on the backend.

> Meta renames dashboard menus often; the names below were accurate at the time of writing.

## WhatsApp (Cloud API)

1. Go to developers.facebook.com → **My Apps → Create app**, choose the WhatsApp / "Connect with customers" use case
   (app type *Business*) and link your Business portfolio.
2. Open **WhatsApp → API Setup**. Note the **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   Set `WHATSAPP_DISPLAY_NUMBER` to that number in international format (e.g. `15551234567`); it powers the wa.me button.
3. Access token → `WHATSAPP_ACCESS_TOKEN`. The token on API Setup expires in 24 hours, so for a permanent one go to
   **Business settings → Users → System users**, add an admin system user, assign it your app, and generate a token
   with `whatsapp_business_messaging` and `whatsapp_business_management` permissions (expiry: never).
4. **App settings → Basic → App secret** → `META_APP_SECRET` (used to check that webhooks really come from Meta).
5. **WhatsApp → Configuration → Webhook → Edit**: callback URL `https://YOUR-API.onrender.com/webhooks/whatsapp`,
   verify token = your `META_VERIFY_TOKEN`. Click **Verify and save**, then **subscribe to the `messages` field**.
6. With the test number, add up to 5 recipient numbers under API Setup (each one confirms with a code).
   To use your own number, add it under **Phone numbers**, get the display name approved, and switch the app to **Live**.
   Business verification raises the daily conversation limit.

## Instagram

Newer Meta apps use **"API setup with Unified login"** (older apps show "API setup with Instagram login").
Zenoxi supports both; it picks the right one from the token you paste.

Testing with your own accounts needs no business verification or App Review. You need the bot's Instagram
account (Professional) and a second Instagram account to chat with it.

1. In the bot's Instagram app: **Settings → Account type and tools → Switch to professional account**, then
   **Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages**.
2. Meta app → **App roles → Roles → Add people → Instagram tester**: add the bot account **and** the second
   account. Accept each invite while logged in as that account (instagram.com → Settings → Apps and websites →
   Tester invites).
3. **Use cases → Instagram API → Customize → API setup with Unified login → 2. Generate access tokens →
   Add account**, pick the bot account and copy its access token → `INSTAGRAM_ACCESS_TOKEN`.
   (If your app shows "API setup with Instagram login" instead, the token starts with `IG` and you also set
   `INSTAGRAM_APP_SECRET` from that page.) You can skip "1. Configure your app" and the redirect URL: those are
   for letting other people connect their own Instagram accounts.
4. `INSTAGRAM_USERNAME` = the bot's username without @. `INSTAGRAM_ACCOUNT_ID` is optional (shown next to the
   account after step 3); Zenoxi also learns it from incoming messages.
5. **3. Configure webhooks**: callback URL `https://YOUR-API.onrender.com/webhooks/instagram`, the same verify
   token, **Verify and save**, then subscribe to **`messages`**. Unified-login webhooks are signed with the
   Meta **App secret** (`META_APP_SECRET`), which you already set for WhatsApp.
6. Ignore **4. Complete App Review** while testing: it is only needed to let people who aren't testers chat with
   the bot (and that also needs business verification).
7. **Subscribe the Instagram account to the app.** This is easy to miss: without it, the dashboard "Test" button works
   but real DMs never arrive. Run once, with the account ID and the same token:
   ```bash
   curl -X POST "https://graph.facebook.com/v23.0/<INSTAGRAM_ACCOUNT_ID>/subscribed_apps" \
     -d "subscribed_fields=messages" -d "access_token=<INSTAGRAM_ACCESS_TOKEN>"
   ```
   Expected answer: `{"success":true}`. Check with
   `GET https://graph.facebook.com/v23.0/<INSTAGRAM_ACCOUNT_ID>/subscribed_apps?access_token=…`; it should list your app
   with `messages`.
8. If the account doesn't appear when creating the configuration or token, connect it to the business portfolio first:
   **business.facebook.com/settings → Accounts → Instagram accounts → Add**, then give the app and the system user
   access to it.

## Set the variables and test

Add these to the backend (Render → your service → Environment), then redeploy:

```
META_VERIFY_TOKEN=your-random-string
META_APP_SECRET=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_DISPLAY_NUMBER=15551234567
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_USERNAME=yourbot
INSTAGRAM_ACCOUNT_ID=   # optional, Unified login
PUBLIC_FRONTEND_URL=https://zenoxi.vercel.app
```

Then message your WhatsApp number or Instagram account with `hi`. You should get the help message back.

## Going live for everyone

While the Meta app is **unpublished** (development mode):
- **Instagram:** only accounts with a role on the app (Instagram testers) can chat with the bot.
- **WhatsApp:** Meta delivers no real messages, only dashboard test webhooks.

To open both to the public:
1. **Business verification** in the business portfolio (legal business documents, depending on your country).
2. **App Review** for advanced access to `instagram_manage_messages` (and the WhatsApp messaging permissions). Submit a
   screen recording of the bot replying, a usage description, and the Privacy Policy, Terms and Data deletion URLs
   (`https://zenoxi.vercel.app/privacy`, `/terms`, `/data-deletion`).
3. **Publish** the app (**Publish** in the app dashboard).
4. For WhatsApp, add your own phone number (not the test number) and get the display name approved.

No code changes are needed: once Meta approves, everything already works.

## Troubleshooting

- **Webhook verification fails:** the verify token in Meta must equal `META_VERIFY_TOKEN`, and the backend must be awake.
- **Messages arrive but nobody answers:** check the backend logs. `Bad signature` means `META_APP_SECRET` /
  `INSTAGRAM_APP_SECRET` is wrong; `Graph API … 401` means the access token expired.
- **First reply is slow:** Render's free plan sleeps after ~15 minutes idle and takes up to a minute to wake. Meta
  retries webhooks, and Zenoxi ignores duplicates, so the message still gets one answer.
