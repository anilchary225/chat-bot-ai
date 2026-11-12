# Configuration

All settings come from environment variables. Locally they're read from `backend/.env` and `frontend/.env` (copy
the `.env.example` files). In production set them in **Render → Environment** (backend) and
**Vercel → Settings → Environment Variables** (frontend).

> Never commit `.env` files or put secrets in the frontend. Everything starting with `VITE_` is bundled into public
> JavaScript.

## Backend (`backend/.env`, Render)

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | ✅ | | MongoDB connection string (`mongodb+srv://…`). |
| `MONGODB_DATABASE` | | `vac_ai_chat` | Database name. |
| `OPENROUTER_API_KEY` | ✅ | | OpenRouter API key (`sk-or-…`). |
| `OPENROUTER_MODEL` | | `openrouter/free` | Model ID; the default picks an available free model. |
| `OPENROUTER_BASE_URL` | | `https://openrouter.ai/api/v1` | OpenAI-compatible API base. |
| `FRONTEND_ORIGIN` | ✅ prod | `http://localhost:5173` | Extra allowed CORS origin, e.g. `https://zenoxi.vercel.app`. |
| `PUBLIC_FRONTEND_URL` | ✅ prod | `https://zenoxi.vercel.app` | Website address used in `/web` links and emails. |

### Accounts and email

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH_SECRET` | ✅ prod | dev value | Long random string used to hash codes and session tokens. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it signs everyone out. |
| `GOOGLE_CLIENT_ID` | | | OAuth Web client ID; enables "Continue with Google". Must equal `VITE_GOOGLE_CLIENT_ID`. |
| `BREVO_API_KEY` | one of the email options | | Brevo **API** key (`xkeysib-…`, not the SMTP key). Preferred: works on hosts that block SMTP. |
| `MAIL_FROM` | with email | | Sender address; must be verified in Brevo (or be the SMTP account). |
| `MAIL_FROM_NAME` | | `Zenoxi` | Sender display name. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | alternative | `587` | Plain SMTP, e.g. Gmail with an app password. **Blocked on Render's free plan.** |

With no email option set, codes are written to the server log (development only).

### Website Agents and admin

| Variable | Default | Description |
|---|---|---|
| `ADMIN_EMAILS` | | Comma-separated emails that get the Admin dashboard (`/admin`) and `/api/admin/*`, e.g. your own. There's no separate admin password: sign in with that email. |
| `AGENT_DAILY_MESSAGES` | `100` | Maximum visitor messages per agent per day, protecting the shared AI quota. |
| `AGENT_DAILY_MESSAGES_OWN_KEY` | `2000` | The daily limit for agents whose owner added their own OpenRouter key. |
| `AGENT_DAILY_EMAILS` | `50` | Maximum emails per agent per day (owner alerts, visitor confirmations, follow-ups, reports). |
| `PUBLIC_API_URL` | Render URL | This API's public address, used for unsubscribe links in emails. |
| `CRON_SECRET` | | Optional. Lets an external scheduler call `POST /api/cron/run` with header `X-Cron-Secret` (setup: [Deployment](DEPLOYMENT.md#5c-scheduled-jobs-lead-reports-and-follow-ups)). |
| `BACKGROUND_JOBS` | `true` | Runs reports and follow-ups inside the server every 30 minutes. A MongoDB lock makes each run happen once, even with several copies. |

Owners' own OpenRouter keys are encrypted (Fernet) with a key derived from `AUTH_SECRET`. **Changing `AUTH_SECRET`
signs everyone out and makes saved owner keys unreadable** (owners must re-enter them).

**Brevo IP allow-list:** if Brevo has "Authorised IPs" turned on, it rejects emails from Render (whose IPs change).
Turn it off in Brevo → Security → Authorised IPs, or emails show as `failed` in the agent's email log.

### Web search and documents

| Variable | Default | Description |
|---|---|---|
| `TAVILY_API_KEY` | | Tavily key (`tvly-…`). Without it, or when its quota runs out, free engines are used. |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Results added to the prompt. |
| `DOC_CONTEXT_CHARS` | `24000` | Maximum document text per prompt, shared across a chat's files. |

### WhatsApp and Instagram (see [Messaging setup](MESSAGING_SETUP.md))

| Variable | Description |
|---|---|
| `META_VERIFY_TOKEN` | Any random text; must match the verify token entered in Meta's webhook settings. |
| `META_APP_SECRET` | Meta app secret (**App settings → Basic**); verifies webhook signatures. |
| `GRAPH_API_VERSION` | Graph API version, default `v23.0`. |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system-user token with `whatsapp_business_messaging`. |
| `WHATSAPP_PHONE_NUMBER_ID` | From WhatsApp **API Setup** (an ID, not the phone number). |
| `WHATSAPP_DISPLAY_NUMBER` | The phone number with country code, for the wa.me button (spaces and `+` are ignored). |
| `INSTAGRAM_ACCESS_TOKEN` | Unified-login (`EAA…`) or Instagram-login (`IG…`) token with `instagram_manage_messages`. |
| `INSTAGRAM_USERNAME` | Bot username without `@`. |
| `INSTAGRAM_ACCOUNT_ID` | Instagram account ID (Unified login). Optional: learned from incoming webhooks. |
| `INSTAGRAM_APP_SECRET` | Only for Instagram-login apps; Unified-login apps use `META_APP_SECRET`. |

In `/api/channels`, WhatsApp shows as enabled when the access token, phone number ID and display number are all set; Instagram when the access token and username are set.

## Frontend (`frontend/.env`, Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend URL, e.g. `https://chat-bot-ai-ouc2.onrender.com` (local: `http://127.0.0.1:8000`). In production builds it falls back to the Render URL when unset. |
| `VITE_GOOGLE_CLIENT_ID` | | Same value as the backend's `GOOGLE_CLIENT_ID`. Without it the Google button is hidden. |

Vite reads these **at build time**: after changing them on Vercel, redeploy.

## `render.yaml`

The Render Blueprint declares every backend variable. Secrets use `sync: false`, so Render asks for their values and
they never live in Git.
