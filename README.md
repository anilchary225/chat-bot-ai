# VAC AI Chat — Phase 1

A standalone, text-only AI chatbot using:
- React + Vite + Tailwind CSS frontend
- FastAPI backend
- Ollama with `qwen3.5:0.8b`
- MongoDB Atlas for conversation persistence

Phase 1 runs locally. It includes chat sessions, conversation history, streaming responses, and a dark interface. No voice, image, or document features.

## Prerequisites
- Python 3.11+
- Node.js 20+
- Ollama installed
- MongoDB Atlas account (or local MongoDB)

## 1. Download and run the model

```bash
ollama pull qwen3.5:0.8b
ollama serve
```

In another terminal, verify:

```bash
ollama run qwen3.5:0.8b
```

## 2. Configure MongoDB

Create a MongoDB Atlas cluster, create a database user, and allow your development IP in Network Access.

Copy `.env.example` to `backend/.env` and set `MONGODB_URI`.
Do not commit `backend/.env`.

## 3. Start backend

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

## 4. Start frontend

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
- Ollama must be running and reachable from the backend.
- The 0.8B model is a lightweight starting point; answer quality is limited compared with larger models.
- This is a development MVP, not a public multi-user production deployment. Before exposing it publicly, add authentication, per-user data isolation, rate limiting, HTTPS, request limits, and secure secret management.
- A free frontend host does not provide free, always-on model inference. For a free demo, keep inference on your Mac and use a secure tunnel only when needed; your Mac must remain awake and online.
