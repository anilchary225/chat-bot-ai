# Zenoxi AI Chat

A standalone, text-only AI chatbot using:
- React + Vite + Tailwind CSS frontend
- FastAPI backend
- OpenRouter `openrouter/free` model routing for hosted inference
- MongoDB Atlas for conversation persistence
- Optional live web search (Tavily, or free keyless engines as a fallback) with cited sources
- Accounts: "Continue with Google", or sign up / sign in with a 6-digit code sent by email (no passwords)
- Document uploads (PDF, Word, text, CSV, code) that the AI reads and cites
- Resume ATS Match: score a resume against a job description and generate a tailored one-page resume (PDF/DOCX)
- One conversation across the website, WhatsApp and Instagram

Phase 1 runs locally. It includes chat sessions, conversation history, streaming responses, web search, document uploads, and light/dark themes. No voice or image features.

## Prerequisites
- Python 3.11+
- Node.js 20+
- OpenRouter API key (free account)
- MongoDB Atlas account (or local MongoDB)

## 1. Configure OpenRouter and MongoDB

Create a MongoDB Atlas cluster, create a database user, and allow your development IP in Network Access.

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and `OPENROUTER_API_KEY`.
The backend uses OpenRouter's `openrouter/free` router, which selects a free model.
Do not commit `backend/.env`.

### Web search (optional)
Turn on the **Web** toggle in the message box to answer from live search results. The backend searches,
adds the top results to the prompt with today's date, and the reply cites them as [1], [2] with source chips.

- Set `TAVILY_API_KEY` (free tier at https://tavily.com) for reliable results.
- When the Tavily key runs out of credits (HTTP 432/433) or is rejected, Zenoxi switches to the free engines
  and stops calling Tavily for an hour (one minute after a 429 rate limit), then tries Tavily again.
- Without a key, Zenoxi falls back to free keyless engines via the `ddgs` package. They work without
  sign-up but can be rate-limited or blocked from some networks (including some cloud hosts).
- `WEB_SEARCH_MAX_RESULTS` sets how many results to use (default 5).

### Documents
Attach files with the paperclip in the message box or drag them onto the chat. Zenoxi extracts the text and
uses it for every later message in that chat.

- Supported: PDF, Word (.docx), TXT, Markdown, CSV/TSV, JSON and common code files; up to 10 MB and 10 files per chat.
- Scanned PDFs (images without selectable text) and password-protected PDFs can't be read; old `.doc` files need saving as `.docx`.
- Large documents are split into passages and only the ones most relevant to the question are sent to the model.
  `DOC_CONTEXT_CHARS` (default 24000) sets how much document text goes into each prompt.
- Extracted text is stored in MongoDB (`documents` collection) and deleted with its chat.
- On Render, add `TAVILY_API_KEY` as an environment variable on the backend service.

### Accounts and email codes
Everyone signs in with their email: Zenoxi emails a 6-digit code (valid 10 minutes, 5 tries, one resend per minute).
Each user only sees their own chats. Chats created before accounts existed have no owner and are no longer listed.

1. Set `AUTH_SECRET` to a long random string (`python -c "import secrets; print(secrets.token_urlsafe(32))"`).
2. Choose how emails are sent:
   - **Brevo (recommended, free ~300 emails/day):** create an account at brevo.com, add and verify your Gmail
     under *Senders*, create an API key under *SMTP & API*, then set `BREVO_API_KEY` and `MAIL_FROM` (that Gmail).
     It uses HTTPS, so it works on hosts that block SMTP ports (Render's free plan may).
   - **Gmail SMTP:** turn on 2-step verification, create an *App password*, then set `SMTP_HOST=smtp.gmail.com`,
     `SMTP_PORT=587`, `SMTP_USERNAME`/`MAIL_FROM` = your Gmail and `SMTP_PASSWORD` = the app password.
   - **Nothing set (local development):** codes are printed in the backend log instead of being emailed.
3. Codes sent from a Gmail address through a third party can land in spam; a custom domain avoids that.
4. The email design lives in `backend/app/templates/verification.html` (and `.txt`); edit it freely.
   Words like `$code` and `$greeting` are filled in by `backend/app/mailer.py`.

### Continue with Google (optional, free)
1. Open https://console.cloud.google.com, create (or pick) a project.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform): choose *External*, fill in the app name
   (Zenoxi), support email and developer email, and publish the app (*In production*) so anyone can sign in.
   Sign-in only asks for basic profile + email, so Google doesn't require a verification review.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Under *Authorized JavaScript origins*
   add `http://localhost:5173`, `http://localhost` and `https://zenoxi.vercel.app` (no redirect URIs needed).
4. Copy the client ID (`….apps.googleusercontent.com`) into **both**:
   - backend `GOOGLE_CLIENT_ID` (Render environment / `backend/.env`)
   - frontend `VITE_GOOGLE_CLIENT_ID` (Vercel environment / `frontend/.env`), then redeploy the frontend.
5. Without the client ID the Google button is hidden and email codes keep working. Signing in with Google using the
   same email as an existing account opens that same account.

### Resume ATS Match
Open **Resume ATS Match** in the sidebar, upload a resume (PDF/DOCX/text) and paste a job description. Zenoxi shows a
match score, matched and missing keywords and formatting checks, then rewrites the resume for the job without
inventing experience (unsupported keywords are listed as "add only if true"). The result uses a classic one-page
template and the PDF is automatically scaled to fit one A4 page; a matching Word file is also available.
The score is an estimate; real applicant tracking systems each score differently.

### WhatsApp and Instagram (optional)
Chat with Zenoxi on WhatsApp and Instagram and continue the same conversation on the website. Replying to people who
message first is free on both platforms. Setup takes about 30 minutes in Meta's developer dashboard:
see [docs/MESSAGING_SETUP.md](docs/MESSAGING_SETUP.md).

## 2. Start backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs: http://127.0.0.1:8000/docs

## 3. Start frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL, normally http://localhost:5173.

## API
- `GET /api/health`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/{chat_id}/messages`
- `DELETE /api/chats/{chat_id}`
- `POST /api/auth/request-code` `{email, mode: "signin"|"signup", name?}`, `POST /api/auth/verify` `{email, code}` → `{token, user}`,
  `POST /api/auth/google` `{credential}` (Google ID token) → `{token, user}`, `GET /api/auth/me`, `POST /api/auth/logout` — every other `/api` call needs `Authorization: Bearer <token>`
- `POST /api/chats/{chat_id}/link-code` — one-time code to continue a chat on WhatsApp/Instagram; `GET /api/channels`
- `POST /api/resume/analyze` (multipart `file` or `resume_text`, plus `job_description`), `POST /api/resume/tailor`,
  `POST /api/resume/pdf`, `POST /api/resume/docx`
- `GET|POST /webhooks/whatsapp`, `GET|POST /webhooks/instagram` — Meta webhooks (signature-checked)
- `POST /api/chats/{chat_id}/documents` — multipart upload (`file`); returns file details
- `GET /api/chats/{chat_id}/documents`
- `DELETE /api/chats/{chat_id}/documents/{document_id}`
- `POST /api/chats/{chat_id}/messages` — body `{"content": "...", "web_search": false, "attachment_ids": []}`; streams newline-delimited JSON events:
  - `{"type":"status","stage":"searching"}` (web search only)
  - `{"type":"sources","sources":[{"title","url","domain","snippet"}]}` (web search only)
  - `{"type":"notice","message":"..."}` (search failed; answer continues without it)
  - `{"type":"token","content":"..."}`
  - `{"type":"done","message_id":"..."}`
  - `{"type":"error","message":"..."}`

## Notes
- OpenRouter free models have provider availability and usage limits; the free account currently allows up to 50 requests per day.
- This is a development MVP, not a public multi-user production deployment. Before exposing it publicly, add authentication, per-user data isolation, rate limiting, HTTPS, request limits, and secure secret management.
- A free frontend host does not provide free, always-on model inference. OpenRouter supplies hosted inference within its free model and rate limits.
