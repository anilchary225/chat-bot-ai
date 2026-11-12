# Security

## Reporting a vulnerability

Please **don't open a public GitHub issue** for security problems. Email **vadlaanilchary225@gmail.com** with:
- a description and the impact
- steps to reproduce (requests, payloads, screenshots)
- any suggested fix

You'll get a reply within 7 days. Please give a reasonable time to fix the issue before sharing it publicly.

## Security model

| Area | How it's protected |
|---|---|
| **Accounts** | Passwordless: 6-digit email codes or Google ID tokens. No passwords are stored. |
| **Sign-in codes** | Stored only as HMAC-SHA256 hashes (keyed with `AUTH_SECRET`); expire after 10 minutes; 5 attempts; resend limited to once a minute and 6 an hour. |
| **Sessions** | 256-bit random bearer tokens; only their hashes are stored; 30-day expiry with automatic database cleanup. |
| **Google sign-in** | ID tokens verified with `google-auth` (signature, audience = `GOOGLE_CLIENT_ID`, issuer, expiry, verified email). |
| **Authorization** | Every chat request goes through one check (`load_chat`): you must own the chat, or hold the key of a linked chat nobody has claimed. Unauthorized and missing chats both return `404`. |
| **Linked chats** | Link codes are random, single-use and expire in 15 minutes. Chat keys are 144-bit random values compared in constant time. A chat claimed by one account can't be opened by another, even with its key. |
| **Meta webhooks** | Verify-token handshake, plus an `X-Hub-Signature-256` HMAC check of every request body. Duplicate events are ignored. |
| **Model and search input** | Web results, documents and resumes are inserted as reference data, with instructions to the model to ignore any commands inside them. |
| **Website Agents** | The public widget API only answers requests whose `Origin` is one of the agent's allowed domains; draft agents work only in Zenoxi previews; per-IP rate limits and a daily cap per agent; spam-trap field on inquiries; admins can disable agents. Owners' own OpenRouter keys are encrypted at rest (Fernet, key derived from `AUTH_SECRET`) and never returned. Emails to visitors need consent, carry a signed unsubscribe link, and are capped per agent per day; preview tests only email the owner. CSV exports escape formula characters. Logo uploads are re-encoded as PNG (SVG refused). The website reader refuses private, loopback and link-local addresses on every redirect hop (SSRF protection). |
| **Uploads** | Type allow-list, 10 MB cap, parsed in memory; only the extracted text is stored. Exception: files an agent owner uploads as knowledge (≤ 5 MB) are kept so they can be emailed as brochures, and are deleted with the agent. |
| **Transport** | HTTPS everywhere (Vercel, Render, Atlas, Graph API). |
| **Secrets** | Only in environment variables (`sync: false` in `render.yaml`); `.env` files are git-ignored; nothing secret ships in the frontend. |

## Known limitations

- **Limited rate limiting:** only sign-in codes and the public widget API are rate-limited. A busy or malicious
  signed-in client could still use up the shared OpenRouter or search quota through the main chat.
- **Session tokens live in `localStorage`**, so they can be read by any script running on the site (for example, if a
  cross-site scripting bug were ever introduced). Markdown is rendered without raw HTML to reduce that risk.
- **The MongoDB network allow-list is open** (`0.0.0.0/0`) because Render's free plan has no fixed IP; security relies
  on a strong database password.
- **`/web` links work for the first claimer:** if a link leaks before the owner opens it, someone else could claim the
  chat.
- **Widget origin checks stop browsers, not scripts:** a script can send any `Origin`, so rate limits and the daily cap are what protect the AI quota.
- **Admin actions are logged to the server log only** (who blocked, deleted or disabled what); there is no in-app audit trail yet.

## Operational checklist

- Set a strong, unique `AUTH_SECRET` in production (the server logs a warning when it's missing).
- Rotate the Meta, OpenRouter, Brevo and Tavily keys if they're ever exposed; changing `AUTH_SECRET` signs everyone
  out.
- Keep dependencies updated (`pip list --outdated`, `npm outdated`) and review `npm audit`.
