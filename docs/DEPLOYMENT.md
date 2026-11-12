# Deployment

Production runs on free tiers:

| Part | Service | URL |
|---|---|---|
| Frontend | Vercel | https://zenoxi.vercel.app |
| Backend API | Render (Docker, free plan) | https://chat-bot-ai-ouc2.onrender.com |
| Database | MongoDB Atlas (free M0) | |

Pushing to `main` on GitHub redeploys both Vercel and Render automatically.

## 1. MongoDB Atlas

1. Create a free **M0** cluster and a database user.
2. **Network Access:** allow `0.0.0.0/0`. Render's free plan has no fixed outbound IP, so the database user's strong
   password is the protection.
3. Copy the connection string → `MONGODB_URI`.

The backend creates all indexes (including TTL cleanup) at startup; no migrations are needed.

## 2. Backend on Render

1. **New → Blueprint** → connect the GitHub repo. `render.yaml` creates a free Docker web service from `backend/`
   (health check `/api/health`).
2. Fill in the secret variables Render asks for (see [Configuration](CONFIGURATION.md)). The minimum is:
   `MONGODB_URI`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `FRONTEND_ORIGIN`, `PUBLIC_FRONTEND_URL`, plus an email option.
3. **Settings → Build & Deploy → Auto-Deploy: On commit**.
4. Check: `https://<service>.onrender.com/api/health` returns `"database":"connected"`.

> **Saving environment variables redeploys the commit that's already deployed**, not the latest one. After pushing
> code, check the deploy log says `Checking out commit <latest>`; if not, use **Manual Deploy → Deploy latest commit**.

**Free plan notes:** the service sleeps after about 15 idle minutes (the first request then takes up to a minute), and
outbound SMTP ports are blocked, so use Brevo's HTTP API for email.

## 3. Frontend on Vercel

1. **Add New → Project** → import the repo, **Root Directory:** `frontend`, framework **Vite**.
2. Environment variables: `VITE_API_URL=https://<service>.onrender.com`, and `VITE_GOOGLE_CLIENT_ID` if using Google.
3. Deploy. `frontend/vercel.json` enables clean URLs, so `/privacy`, `/terms` and `/data-deletion` work, and
   rewrites `/admin`, `/agents` and `/resume` to the app. Those rewrites must point to `/`, not `/index.html`: with
   clean URLs on, Vercel redirects `/index.html`, and the page returns 404.
4. If you use a custom domain, add it to the backend's CORS (`FRONTEND_ORIGIN`), to `PUBLIC_FRONTEND_URL`, and to
   Google's authorized origins.

## 4. Google sign-in (optional)

1. Google Cloud Console → new project → **OAuth consent screen**: External, app name, support email → **Publish**.
2. **Credentials → OAuth client ID → Web application**. Authorized JavaScript origins: `https://zenoxi.vercel.app`,
   `http://localhost:5173`, `http://localhost`. No redirect URIs needed. Leave "AI-powered agent" unchecked.
3. Put the client ID in `GOOGLE_CLIENT_ID` (Render) **and** `VITE_GOOGLE_CLIENT_ID` (Vercel), then redeploy both.

New origins can take from 5 minutes to a few hours to start working.

## 5. Email for sign-in codes

**Brevo (recommended):** free plan (about 300 emails a day). **Senders** → add and verify your address; **SMTP & API →
API Keys** → create one. Set `BREVO_API_KEY` (starts with `xkeysib-`) and `MAIL_FROM` (the verified address).

**Turn off Brevo's IP blocking.** Brevo → **Security → Authorised IPs** → **Deactivate for API keys**. Render's
outgoing IP changes, so with blocking on, every email fails with `401 … unrecognised IP address` and sign-in shows
"Couldn't send the email right now". Don't authorise single IPs instead; it breaks again when the IP changes. With
blocking off, the API key is the only protection, so keep it only in Render.

**Keep emails out of spam.** Sending "from" a Gmail or other free address through Brevo fails the receiver's
sender checks, so many emails land in spam. For reliable delivery:
1. Use your own domain (for example `zenoxi.in`).
2. Brevo → **Senders, domains, IPs → Domains** → add it and copy the DNS records Brevo shows (verification code,
   DKIM, DMARC) into your domain's DNS.
3. When Brevo shows **Authenticated**, set `MAIL_FROM=no-reply@yourdomain` on Render.

Until then, the sign-in screen and the widget remind people to check their Spam or Promotions folder.

The email designs are in `backend/app/templates/verification.html` and `.txt` (sign-in codes) and `email_html()` in
`backend/app/agent_extras.py` (Website Agent emails). Logos are drawn with HTML, not images, so they show even when
an email app blocks images.

## 5b. Admin access

Set `ADMIN_EMAILS` on Render to your sign-in email (comma-separate several). After the redeploy, sign in with that
email: **Admin** appears in the sidebar, and `https://<your-site>/admin` opens the dashboard. There's no separate
admin password.

## 5c. Scheduled jobs (lead reports and follow-ups)

The server runs due jobs every 30 minutes while it's awake. Render's free plan sleeps when idle, so add a free
external trigger:
1. Generate a secret: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` and set it as `CRON_SECRET`
   on Render.
2. On **cron-job.org** → **Create cronjob**:
   - **Common** tab: URL `https://<service>.onrender.com/api/cron/run`, schedule **every 30 minutes**.
   - **Advanced** tab: request method **POST**; header `X-Cron-Secret` = the same secret; timeout as high as allowed.
3. **Test run:** `200` works · `403` secret mismatch · `404` new code not deployed yet · timeout means the server was
   asleep, so run it again.

The admin **System** tab shows when jobs last ran and what started them, and has a **Run now** button.

## 6. WhatsApp and Instagram (optional)

Follow [Messaging setup](MESSAGING_SETUP.md). Webhook URLs:
`https://<service>.onrender.com/webhooks/whatsapp` and `…/webhooks/instagram`.

## Go-live checklist

- [ ] `/api/health` shows the database connected
- [ ] `AUTH_SECRET` set to a long random value (the logs warn when it isn't)
- [ ] Brevo **Authorised IPs** blocking is off for API keys
- [ ] Sign-up email arrives (check spam), and the code signs you in
- [ ] Signing in with an `ADMIN_EMAILS` address shows **Admin**; `/admin` opens; the **System** tab is all green
- [ ] "Continue with Google" works on the live domain
- [ ] A chat streams a reply; web search shows sources; a PDF upload works
- [ ] Resume tool: analyze, tailor, download PDF
- [ ] `/privacy`, `/terms` and `/data-deletion` load
- [ ] Render auto-deploy is on, and the deploy log shows the latest commit
- [ ] (If using Meta) webhook test returns 200, and a tester's DM gets a reply
- [ ] (If using Website Agents) cron-job.org test run returns 200; an agent previewed on the sample page answers and
      saves a test lead

## Rollback

- **Render:** **Events** → pick an earlier successful deploy → **Rollback**.
- **Vercel:** **Deployments** → earlier deployment → **⋯ → Promote to Production**.
- **Code:** `git revert <commit>` and push.

## Legacy deployment files

`deploy/oracle/` and `deploy/render-free.md` describe an older version that ran Ollama models. The backend now uses
OpenRouter, so those files are kept for reference only and don't match the current code.
