# Zenoxi AI Chat

A standalone, text-only AI chatbot using:
- React + Vite + Tailwind CSS frontend
- FastAPI backend
- OpenRouter `openrouter/free` model routing for hosted inference
- MongoDB Atlas for conversation persistence

Phase 1 runs locally. It includes chat sessions, conversation history, streaming responses, and a dark interface. No voice, image, or document features.

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
- `POST /api/chats/{chat_id}/messages` — streams newline-delimited JSON events:
  - `{"type":"token","content":"..."}`
  - `{"type":"done","message_id":"..."}`
  - `{"type":"error","message":"..."}`

## Notes
- OpenRouter free models have provider availability and usage limits; the free account currently allows up to 50 requests per day.
- This is a development MVP, not a public multi-user production deployment. Before exposing it publicly, add authentication, per-user data isolation, rate limiting, HTTPS, request limits, and secure secret management.
- A free frontend host does not provide free, always-on model inference. OpenRouter supplies hosted inference within its free model and rate limits.
