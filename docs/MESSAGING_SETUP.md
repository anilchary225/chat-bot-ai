# WhatsApp and Instagram setup

Zenoxi can answer on WhatsApp and Instagram, and every chat is shared with the website:

- **Website → app:** in a chat, tap **Continue on…**. WhatsApp opens with `link CODE` already typed: send it. On
  Instagram, send `link CODE` to your Zenoxi account. The conversation (with its history and files) continues there.
- **App → website:** send `/web` in WhatsApp or Instagram. Zenoxi replies with a private link; open it while signed in
  and the chat is added to your account.
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

## Instagram (Instagram API with Instagram Login)

1. In the Instagram app: **Settings → Account type** → switch to Professional. Then
   **Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages**.
2. In the same Meta app, add the **Instagram** product and open **API setup with Instagram login**.
3. **Generate access tokens**: add your Instagram account and copy the token → `INSTAGRAM_ACCESS_TOKEN`.
   Set `INSTAGRAM_USERNAME` to the account's username (without @).
   Long-lived Instagram tokens last about 60 days; refresh it before it expires
   (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN`).
4. Copy the **Instagram app secret** (shown in the Instagram product's business login settings) → `INSTAGRAM_APP_SECRET`.
5. **Configure webhooks**: callback URL `https://YOUR-API.onrender.com/webhooks/instagram`, the same verify token,
   then subscribe to the **`messages`** field.
6. While the app is in development mode only accounts with a role on the app (add them as Instagram testers) can chat
   with the bot. To open it to everyone, complete **App Review** for `instagram_business_manage_messages` and business
   verification.

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
PUBLIC_FRONTEND_URL=https://zenoxi.vercel.app
```

Then message your WhatsApp number or Instagram account with `hi`. You should get the help message back.

## Troubleshooting

- **Webhook verification fails:** the verify token in Meta must equal `META_VERIFY_TOKEN`, and the backend must be awake.
- **Messages arrive but nobody answers:** check the backend logs. `Bad signature` means `META_APP_SECRET` /
  `INSTAGRAM_APP_SECRET` is wrong; `Graph API … 401` means the access token expired.
- **First reply is slow:** Render's free plan sleeps after ~15 minutes idle and takes up to a minute to wake. Meta
  retries webhooks, and Zenoxi ignores duplicates, so the message still gets one answer.
