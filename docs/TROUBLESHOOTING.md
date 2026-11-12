# Troubleshooting

Problems seen while building and running Zenoxi, with their causes and fixes.

## Website and API

| Symptom | Cause | Fix |
|---|---|---|
| "Couldn't connect to Zenoxi" banner | Backend asleep, down, or `VITE_API_URL` wrong | Open `/api/health` and wait up to a minute for Render to wake; check `VITE_API_URL` and redeploy Vercel. |
| Browser console shows a CORS error | Frontend domain not allowed | Set `FRONTEND_ORIGIN` on Render to the exact site origin (scheme + host, no trailing slash). |
| New features missing after a push | Render deployed an older commit | In the deploy log check `Checking out commit …`; use **Manual Deploy → Deploy latest commit**; turn on Auto-Deploy. |
| Blank white page after an action | A component crashed, or an exit animation stalled | Check the browser console; see the `AnimatePresence` note in [Development](DEVELOPMENT.md#conventions). |
| "OpenRouter's free usage limit was reached" | About 50 free requests a day | Wait for the reset, or add credit to OpenRouter. |
| Signed out unexpectedly | Session expired (30 days) or `AUTH_SECRET` changed | Sign in again. |

## Sign-in

| Symptom | Cause | Fix |
|---|---|---|
| No code email | No email provider configured, wrong sender, or spam folder | Check spam; set `BREVO_API_KEY` + `MAIL_FROM`; locally, read the code in the backend log. |
| Brevo rejects mail | `MAIL_FROM` not a verified sender, or it's set to `smtp-relay.brevo.com` | Verify the sender in Brevo and set `MAIL_FROM` to that **email address**. |
| SMTP times out on Render | Render's free plan blocks ports 25/465/587 | Use Brevo's HTTP API instead. |
| Google: "origin is not allowed" | Site origin missing from the OAuth client | Add the exact origin under Authorized JavaScript origins; wait 5 minutes to a few hours. |
| Google button missing | `VITE_GOOGLE_CLIENT_ID` unset or the frontend not rebuilt | Set it on Vercel and redeploy. |
| "Google sign-in isn't set up on the server yet" | `GOOGLE_CLIENT_ID` missing on the backend | Add it on Render (same value as the frontend). |
| Google sign-in fails with a valid account | Client IDs differ between frontend and backend | Make both values identical (watch for a missing `-`). |

## Documents and resume

| Symptom | Cause | Fix |
|---|---|---|
| "This PDF has no selectable text" | Scanned or image-only PDF | Export a text PDF, or paste the text. |
| "Couldn't read this Word file" | Old `.doc` format | Save as `.docx`. |
| Resume tailoring fails | The free model returned invalid JSON twice, or the quota ran out | Try again later; check the OpenRouter limit. |
| Resume PDF says "longer than 1 page" | Very long resume even at the smallest scale | Shorten bullets or project descriptions. |

## WhatsApp and Instagram

| Symptom | Cause | Fix |
|---|---|---|
| Webhook "Verify and save" fails | Backend asleep, old code deployed (route returns 404), or verify token mismatch | Wake `/api/health`; confirm `/webhooks/...` returns 403 (not 404) for a wrong token; copy `META_VERIFY_TOKEN` exactly. |
| `POST /webhooks/... 403` in logs | Signature mismatch | `META_APP_SECRET` must equal **App settings → Basic → App secret**. |
| Dashboard "Test" works, real DMs don't arrive | The Instagram account isn't subscribed to the app | `POST https://graph.facebook.com/v23.0/<IG_ACCOUNT_ID>/subscribed_apps` with `subscribed_fields=messages` (see [Messaging setup](MESSAGING_SETUP.md)). |
| Real messages still don't arrive | App is unpublished; only testers' messages (Instagram) or none (WhatsApp) are delivered | Add people as Instagram testers; publish the app after Meta business verification. |
| Messages arrive, but replies fail (`Graph API … 400/401/403` in logs) | Token expired or missing permission | Regenerate the token with `instagram_manage_messages` / `whatsapp_business_messaging`. |
| Instagram account missing when creating a token | Not connected to the business portfolio | Business settings → Accounts → Instagram accounts → Add; assign it to the app and system user. |
| "Select a configuration in Step 1" | Unified login needs a configuration | Instagram API → API setup with Unified login → **Create new configuration** first. |
| Tester invite not visible | Instagram app doesn't show invites | On the web: instagram.com/accounts/manage_access → **Tester invites**. |
| `link CODE` says invalid or expired | Codes last 15 minutes and work once | Get a new code from **Continue on…**. |
| WhatsApp test token stops working after a day | The API Setup token expires in 24 hours | Create a permanent system-user token. |

## Getting logs

- **Render:** service → **Logs** (live). Look for lines with `/webhooks/`, `Graph API`, `OpenRouter`,
  `Tavily` or `Traceback`.
- **Browser:** DevTools → Console and Network (filter by the API domain).
