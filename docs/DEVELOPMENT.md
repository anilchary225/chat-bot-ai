# Development

## Prerequisites

- Python **3.11+** (production uses 3.12)
- Node.js **20+** and npm
- A MongoDB database (Atlas free tier, or a local `mongod`)
- An OpenRouter API key

## Running locally

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in MONGODB_URI, OPENROUTER_API_KEY, AUTH_SECRET
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://127.0.0.1:8000
npm run dev                   # http://localhost:5173
```

**Tips:**
- Without an email service configured, sign-in codes appear in the backend log
  (`No email service configured. Verification code for …`).
- `uvicorn --reload` reloads on code changes but **not** on `.env` changes; restart it after editing `.env`.
- Atlas only accepts connections from IP addresses in its Network Access list.
- Meta webhooks can't reach `localhost`. To test them locally, use a tunnel (for example `cloudflared tunnel --url
  http://127.0.0.1:8000`) and point the Meta webhook at the tunnel URL temporarily.

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app and HTTP endpoints
│   │   ├── chat_core.py       # shared chat logic for all channels
│   │   ├── auth.py            # email codes, Google sign-in, sessions
│   │   ├── mailer.py          # verification email sending
│   │   ├── templates/         # verification email (HTML + text)
│   │   ├── channels.py        # WhatsApp + Instagram webhooks and replies
│   │   ├── documents.py       # file text extraction and passage selection
│   │   ├── search.py          # web search (Tavily + fallback engines)
│   │   ├── resume.py          # ATS analysis, tailoring, PDF/DOCX rendering
│   │   ├── openrouter.py      # AI model client
│   │   ├── config.py          # settings from environment variables
│   │   └── db.py              # MongoDB connection and indexes
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # root: auth gate, splash, app
│   │   ├── App.jsx            # chat UI, sidebar, composer, live sync
│   │   ├── auth.js            # token storage + fetch wrapper
│   │   ├── chatKeys.js        # keys for linked chats
│   │   ├── config.js          # API base URL
│   │   ├── styles.css         # design tokens and all styles
│   │   └── components/        # AuthScreen, GoogleButton, Orb, Aurora, Markdown,
│   │                          # Sources, Attachments, ContinueOn, ResumeTool
│   ├── public/                # logo, icons, privacy/terms/data-deletion pages
│   └── vercel.json
├── docs/                      # this documentation
├── deploy/                    # legacy Ollama-era deployment files
├── marketing/                 # local-only promo assets (git-ignored)
└── render.yaml                # Render Blueprint
```

## Conventions

**Backend**
- Endpoints in `main.py` stay thin: put channel-independent logic in `chat_core.py` so web, WhatsApp and Instagram
  behave the same.
- Every chat endpoint takes `user: dict = Depends(current_user)` and loads chats through `load_chat`, which enforces
  ownership. Never query chats by ID without it.
- Raise `HTTPException` with a short, user-facing `detail`; log technical details with `logger.exception`.
- Settings belong in `config.py` and are documented in `CONFIGURATION.md` and both `.env.example` files.
- Run blocking work (file parsing, PDF rendering, SMTP) with `asyncio.to_thread`.

**Frontend**
- Colors and fonts come from the CSS variables in `styles.css` (`--ember`, `--amber`, `--mint`, `--text` and so on).
  Both themes must work.
- Animations use Framer Motion; the app is wrapped in `MotionConfig reducedMotion="user"`.
- Avoid `AnimatePresence mode="wait"` around components that re-render while leaving: it can stall and leave a blank
  screen. Use a keyed enter animation instead.
- API calls go through the global `fetch` wrapper (`auth.js`), which adds the bearer token and handles `401`.

## Manual test plan

There's no automated test suite yet. Before releasing, check these by hand:

1. **Auth:** sign up with an email code; wrong code shows the tries left; sign out; sign in with Google.
2. **Chat:** a reply streams; Markdown and code blocks render; Copy works; the chat title updates.
3. **Web search:** toggle on; "Searching the web" state; sources and clickable `[n]` citations.
4. **Documents:** attach a PDF and a DOCX; a scanned PDF shows an error; ask about the file.
5. **Resume:** analyze (upload and paste); tailor; download the PDF (one page) and the DOCX.
6. **Linking:** Continue on… shows a code; a tester DM with `link CODE` links the chat; `/web` link opens it while
   signed in; another account can't open it.
7. **Mobile:** full-width replies, sidebar drawer, popover stays on screen.
8. **Themes:** light and dark both readable.

## Useful commands

```bash
npm run build                                   # frontend production build (frontend/)
MONGODB_URI=x python -c "import app.main"       # backend import check (backend/, venv active)
curl http://127.0.0.1:8000/api/health
```
