# Architecture

This document explains how Zenoxi is put together: the moving parts, where data lives, and what happens on each
important request.

## System overview

```
                       ┌──────────────────────────────┐
  Browser  ──────────► │  Frontend (Vercel)           │   React SPA + static legal pages
                       │  zenoxi.vercel.app           │
                       └──────────────┬───────────────┘
                                      │ HTTPS (JSON, NDJSON stream, multipart)
                                      │ Authorization: Bearer <session token>
                                      ▼
  Meta (WhatsApp, ──── webhooks ─► ┌──────────────────────────────┐ ──► OpenRouter (AI replies)
  Instagram)       ◄── Graph API ─ │  Backend API (Render)        │ ──► Tavily / ddgs (web search)
                                   │  FastAPI, Python 3.12        │ ──► Brevo or SMTP (email codes)
                                   │  chat-bot-ai-ouc2.onrender…  │ ──► Google (ID token checks)
                                   └──────────────┬───────────────┘
                                                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │  MongoDB Atlas               │
                                   └──────────────────────────────┘
```

| Component | Responsibility |
|---|---|
| **Frontend** (`frontend/`) | Single-page React app: sign-in, chat UI, file uploads, resume tool, "Continue on…" linking. Hosted on Vercel, which also serves `/privacy`, `/terms` and `/data-deletion`. |
| **Backend** (`backend/app/`) | REST API, streaming chat, auth, document parsing, resume analysis and rendering, Meta webhooks. Stateless apart from MongoDB, so it can restart or scale freely. |
| **MongoDB Atlas** | All persistent data: users, sessions, chats, messages, document text, channel links. |
| **OpenRouter** | Generates replies. The backend sends the prompt and streams tokens back. |
| **Meta Graph API** | Delivers WhatsApp/Instagram messages to the backend (webhooks) and sends Zenoxi's replies. |

## Backend modules

| File | Purpose |
|---|---|
| `main.py` | FastAPI app, CORS, chat/document/link-code/resume endpoints, access checks (`load_chat`). |
| `chat_core.py` | Channel-independent conversation logic: prompts, `prepare_turn`, `run_turn`, `save_reply`, serializers, chat keys. |
| `auth.py` | Email-code sign-up/sign-in, Google sign-in, sessions, the `current_user` dependency. |
| `mailer.py` + `templates/` | Renders and sends the verification email (Brevo HTTP API, SMTP, or log fallback). |
| `channels.py` | WhatsApp and Instagram webhooks, commands (`link`, `/web`, `/new`, `/search`), Graph API senders, formatting. |
| `documents.py` | Text extraction (PDF, DOCX, text formats), chunking and relevant-passage selection. |
| `search.py` | Web search via Tavily, with fallback engines, retries and a quota cooldown. |
| `resume.py` | ATS analysis (keywords, formatting checks), AI tailoring prompt, one-page PDF and DOCX rendering. |
| `agents.py` | Website Agents: owner endpoints (interview, profile, knowledge, settings, test, leads), the public widget API (domain checks, rate limits, inquiries) and admin endpoints. |
| `agent_extras.py` | Website Agents Phase 2/3: lead management, Excel/CSV export, emails (alerts, confirmations with brochures, follow-ups, reports), avatars, owner AI keys, analytics, unanswered inbox, scheduled jobs. |
| `agent_tokens.py` | Token savers: instant FAQ answers and the answer cache. |
| `webreader.py` | Reads a few pages of a public website as text, refusing private addresses (SSRF protection) and honouring robots.txt. |
| `openrouter.py` | Streaming and non-streaming OpenRouter clients. |
| `config.py` | Typed settings loaded from environment variables / `.env`. |
| `db.py` | MongoDB connection and index creation at startup. |

## Data model (MongoDB)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | `email` (unique), `name`, `google_sub` (unique, sparse), `picture`, `created_at`, `last_login` | Created on first successful sign-in. |
| `sessions` | `_id` = HMAC hash of the token, `user_id`, `expires_at` | 30-day sessions; TTL index deletes expired ones. The raw token is never stored. |
| `email_codes` | `_id` = email, `code_hash`, `purpose`, `attempts`, `sent_at`, `sends[]`, `expires_at` | One pending code per email; TTL after 10 minutes. |
| `chats` | `title`, `owner_id`, `access_key`, `channels[]`, `created_at`, `updated_at` | `owner_id` is the signed-in user. `access_key` exists for chats linked to or started on a messaging app. |
| `messages` | `chat_id`, `role` (`user`/`assistant`), `content`, `channel` (`web`/`whatsapp`/`instagram`), `sources[]`, `attachments[]`, `created_at` | Every message from every channel lives here, which is what makes chats continue across apps. |
| `documents` | `chat_id`, `filename`, `kind`, `size`, `pages`, `chars`, `text`, `created_at` | Extracted text only (max 1.5M characters); original files are not stored. |
| `channel_links` | `_id` = `"<channel>:<user id>"`, `chat_id` | Which chat a WhatsApp number or Instagram user is currently in. |
| `link_codes` | `_id` = 6-character code, `chat_id`, `expires_at` | One-time codes for "Continue on…"; TTL after 15 minutes. |
| `agents` | `owner_id`, `public_key` (unique), `name`, `business_name`, `status`, `disabled`, `profile`, `settings`, `allowed_domains`, `interview[]` | One per website assistant. |
| `agent_sources` | `agent_id`, `kind` (`profile`/`page`/`file`/`note`), `title`, `source`, `text` | An agent's knowledge. |
| `agent_conversations` / `agent_messages` | `agent_id`, `visitor_id`, `conversation_id`, `role`, `content` | Anonymous visitor chats. |
| `agent_leads` | `agent_id`, `conversation_id`, `fields{}`, `page_url`, `consent`, `status` | Inquiries from the widget form. |
| `agent_usage` / `agent_rate` | Per-agent daily counters / per-IP rate-limit windows (TTL) | Usage limits. |
| `agent_files` | `agent_id`, `filename`, `mime`, `data` | Original uploaded files (≤ 5 MB) that can be emailed as brochures. |
| `agent_cache` | `_id` = agent + version + question terms, `answer`, `expires_at` | Answer cache; TTL 7 days, cleared when knowledge changes. |
| `agent_emails` | `agent_id`, `lead_id`, `kind`, `to`, `status`, `error` | Email log. |
| `agent_unanswered` | `agent_id`, `question`, `count`, `last_at` | Questions the agent couldn't answer. |
| `agent_unsubscribes` | `_id` = `"<agent id>:<email>"` | Visitors who opted out of emails. |
| `job_locks` | `_id` = job + 30-minute slot | Makes scheduled jobs run once across several server copies; TTL 24 h. |
| `channel_events` | `_id` = `"wa:<message id>"` / `"ig:<message id>"` | De-duplicates Meta webhook retries; TTL after 7 days. |

## Key flows

### Sending a message on the website
1. The frontend sends `POST /api/chats/{id}/messages` with the text, the web-search flag and any attachment IDs.
2. `load_chat` checks that the signed-in user owns the chat (or holds the key of an unclaimed linked chat).
3. `prepare_turn` stores the user message, loads the last 20 messages, builds the system prompt (with today's date),
   and adds relevant passages from the chat's documents.
4. If web search is on, `add_web_results` searches and inserts the numbered sources into the prompt.
5. The response is a **newline-delimited JSON stream**: `status` → `sources` → many `token` events → `done`
   (or `error`). The frontend renders tokens as they arrive.
6. `save_reply` stores the full answer with its sources.

### Signing in with an email code
1. `POST /api/auth/request-code` creates a 6-digit code, stores only its HMAC hash and emails it
   (rate limits: one per minute, six per hour).
2. `POST /api/auth/verify` checks the code (five attempts maximum), creates the user if needed, and returns a random
   session token. The browser keeps it in `localStorage` and sends it as `Authorization: Bearer …`.

Google sign-in follows the same last step, after `google-auth` verifies the ID token's signature, audience and
issuer.

### A message arriving from WhatsApp or Instagram
1. Meta calls `POST /webhooks/{whatsapp|instagram}`. The backend checks the `X-Hub-Signature-256` HMAC with the app
   secret, answers `200` immediately, and does the work in a background task.
2. The event ID is recorded in `channel_events`, so retries are ignored.
3. Commands are handled first (`link CODE`, `/web`, `/new`, `/search`, `/help`); otherwise `run_turn` produces a
   reply using the same logic as the website.
4. The reply is converted for the platform (WhatsApp formatting or plain text), split to fit message limits, and sent
   through the Graph API.

### Continuing one chat across apps
- **Website → app:** `POST /api/chats/{id}/link-code` makes the chat private (adds an `access_key`) and returns a
  15-minute code. The user sends `link CODE` to the bot; the backend maps their messaging ID to that chat in
  `channel_links`.
- **App → website:** `/web` replies with `https://zenoxi.vercel.app/?chat=ID&key=KEY`. The first signed-in user who
  opens it claims the chat (`owner_id`); after that only they can open it.
- **Live view:** while a linked chat is open, the website polls its messages every 4 seconds and shows new ones with
  a "via Instagram/WhatsApp" badge.

### Website Agents
1. **Create:** the owner gives a business name and website. `webreader` fetches up to 8 important pages, and their
   domain becomes the first allowed domain.
2. **Interview:** a consultant prompt asks one question at a time, skipping what the website already answers.
3. **Profile:** the model turns the interview + website into strict JSON (retried once on bad JSON); the owner edits
   it, and it's saved as a `profile` knowledge source.
4. **Answering:** for each visitor message, `knowledge_context` picks the most relevant passages from every source
   within a shared budget. The system prompt only allows answers from that knowledge, lists the owner's "never say"
   items, and asks the model to add `[[SHOW_FORM]]` when the visitor wants to book, buy or be contacted. Buying-intent
   words in the message also trigger the form.
5. **Widget:** `widget.js` renders in a Shadow DOM (isolated from the site's CSS), calls the public API, streams
   answers, and shows the inquiry form as a card or as a conversational sequence.
6. **Protection:** `Origin` must match the allowed domains, draft agents only work in previews, and there are
   per-IP rate limits, a daily per-agent cap, a spam trap on the form, and admin disabling.

7. **After an inquiry:** a background task writes a one-line AI summary, emails the owner (Reply-To = visitor), and,
   with consent, sends the visitor a confirmation with any brochures they ticked. Follow-ups and daily/weekly reports
   run from the scheduled-jobs loop.

### Saving AI tokens
| Where | How |
|---|---|
| Website Agents | Questions that match a saved FAQ get the FAQ answer with no AI call. First questions are cached per agent for 7 days (cache cleared on any knowledge change). Knowledge budget 6,000 characters (10,000 for broad questions), last 6 turns, replies capped at 450 tokens. |
| Web chat | History trimmed to 12,000 characters, older long replies shortened; documents get 8,000 characters for specific questions and the full `DOC_CONTEXT_CHARS` only for "summarize / whole document" questions; replies capped at 1,200 tokens (500 on WhatsApp/Instagram). |
| Documents | Passages are ranked by matching question words with light stemming ("prices" matches "price"), so fewer, better passages are sent. |
| Owners' own key | An owner can add an OpenRouter key; their agent then uses it (higher daily limit) instead of the shared quota. |

### Load balancing
`deploy/nginx/` runs three API copies behind nginx (`least_conn`, failover, streaming without buffering, per-IP
rate limits). The backend keeps no state in memory, so any copy can serve any request. See
[deploy/nginx/README.md](../deploy/nginx/README.md).

### Resume ATS Match
`/api/resume/analyze` extracts text and scores it deterministically: weighted keyword coverage (75%) plus seven
formatting checks (25%). `/api/resume/tailor` asks the model for strict JSON, with rules against inventing facts,
retries once on invalid JSON, then re-scores the result. `/api/resume/pdf` lays the resume out with reportlab and
shrinks font size and spacing step by step until it fits one A4 page; `/api/resume/docx` uses the same layout and
scale. Resume data is not stored.

## Design decisions

| Decision | Reason |
|---|---|
| Passwordless sign-in (codes + Google) | No passwords to store, leak or reset. |
| Store hashes of codes and sessions | A database leak doesn't expose usable codes or tokens. |
| Messaging chats keyed by an `access_key` until claimed | Chats can start on Instagram/WhatsApp before the person has a website account. |
| Polling instead of WebSockets for live sync | Works on Render's free plan and through any proxy; 4 seconds is fast enough for chat. |
| Web search via HTTPS APIs only | Render's free plan blocks outbound SMTP and similar ports; HTTPS always works. |
| Resume PDF rendered server-side | Exact one-page fitting needs real text measurement, which the browser can't guarantee for print. |
| Documents stored as extracted text | Smaller, searchable, and avoids keeping original files that could contain personal data. |

## Limits

| Limit | Value |
|---|---|
| Message length | 12,000 characters |
| History sent to the model | Last 20 messages, trimmed to 12,000 characters |
| Upload size / files per chat | 10 MB / 10 files |
| Document text in a prompt | `DOC_CONTEXT_CHARS` (default 24,000 characters) |
| Web search results | `WEB_SEARCH_MAX_RESULTS` (default 5) |
| Session lifetime | 30 days |
| Sign-in code | 6 digits, 10 minutes, 5 attempts |
| Link code | 6 characters, 15 minutes, single use |
| WhatsApp / Instagram reply chunks | 4,000 / 950 characters |
