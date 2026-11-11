from contextlib import asynccontextmanager
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import json
import logging

from .config import settings
from .db import connect_db, close_db, get_db
from .schemas import CreateChatRequest, SendMessageRequest
from .ollama import stream_chat

SYSTEM_PROMPT = (
    "You are Zenoxi, a helpful general-purpose text assistant. "
    "Answer clearly and accurately. If you are unsure, say so. "
    "Do not claim to have accessed live information or external systems."
)
logger = logging.getLogger("zenoxi.model")

def now():
    return datetime.now(timezone.utc)

def serialize_chat(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "New chat"),
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat()
    }

def serialize_message(doc):
    return {
        "id": str(doc["_id"]),
        "chat_id": str(doc["chat_id"]),
        "role": doc["role"],
        "content": doc["content"],
        "created_at": doc["created_at"].isoformat()
    }

def valid_id(value: str):
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=404, detail="Chat not found")
    return ObjectId(value)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(title="Zenoxi API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([
        settings.frontend_origin,
        "https://zenoxi.vercel.app",
        "https://www.zenoxi.vercel.app",
        "https://chat-bot-ai-anil-charys-projects.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    db_ok = True
    try:
        await get_db().command("ping")
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "model": settings.ollama_model,
        "inference": settings.ollama_base_url
    }

@app.get("/api/chats")
async def list_chats():
    cursor = get_db().chats.find().sort("updated_at", -1).limit(100)
    return [serialize_chat(doc) async for doc in cursor]

@app.post("/api/chats")
async def create_chat(payload: CreateChatRequest):
    timestamp = now()
    doc = {
        "title": payload.title.strip() or "New chat",
        "created_at": timestamp,
        "updated_at": timestamp
    }
    result = await get_db().chats.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_chat(doc)

@app.get("/api/chats/{chat_id}/messages")
async def get_messages(chat_id: str):
    oid = valid_id(chat_id)
    chat = await get_db().chats.find_one({"_id": oid})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    cursor = get_db().messages.find({"chat_id": oid}).sort("created_at", 1).limit(500)
    return [serialize_message(doc) async for doc in cursor]

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str):
    oid = valid_id(chat_id)
    result = await get_db().chats.delete_one({"_id": oid})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Chat not found")
    await get_db().messages.delete_many({"chat_id": oid})
    return {"deleted": True}

@app.post("/api/chats/{chat_id}/messages")
async def send_message(chat_id: str, payload: SendMessageRequest):
    oid = valid_id(chat_id)
    db = get_db()
    chat = await db.chats.find_one({"_id": oid})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    user_text = payload.content.strip()
    if not user_text:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    timestamp = now()
    user_doc = {
        "chat_id": oid, "role": "user",
        "content": user_text, "created_at": timestamp
    }
    await db.messages.insert_one(user_doc)

    # Keep a bounded context window to avoid unbounded prompt growth.
    history_cursor = db.messages.find({"chat_id": oid}).sort("created_at", -1).limit(20)
    history = [doc async for doc in history_cursor]
    history.reverse()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend({"role": doc["role"], "content": doc["content"]} for doc in history)

    if chat.get("title") == "New chat":
        title = user_text[:48] + ("…" if len(user_text) > 48 else "")
        await db.chats.update_one(
            {"_id": oid},
            {"$set": {"title": title, "updated_at": timestamp}}
        )

    async def event_stream():
        pieces = []
        try:
            async for token in stream_chat(messages):
                pieces.append(token)
                yield json.dumps({"type": "token", "content": token}) + "\n"
            answer = "".join(pieces).strip()
            assistant_doc = {
                "chat_id": oid, "role": "assistant",
                "content": answer, "created_at": now()
            }
            result = await db.messages.insert_one(assistant_doc)
            await db.chats.update_one(
                {"_id": oid}, {"$set": {"updated_at": assistant_doc["created_at"]}}
            )
            yield json.dumps({
                "type": "done",
                "message_id": str(result.inserted_id)
            }) + "\n"
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.exception("Ollama Cloud returned HTTP %s", status)
            if status in (401, 403):
                message = "Ollama Cloud rejected the API key. Check OLLAMA_API_KEY in Render."
            elif status == 404:
                message = "Ollama Cloud couldn't find the model. Check OLLAMA_MODEL in Render."
            elif status == 429:
                message = "Ollama Cloud usage limit reached. Check your Ollama account usage."
            elif status >= 500:
                message = "Ollama Cloud is temporarily unavailable. Try again shortly."
            else:
                message = f"Ollama Cloud returned an error (HTTP {status}). Check the Render logs."
            yield json.dumps({"type": "error", "message": message}) + "\n"
        except httpx.RequestError:
            logger.exception("Could not connect to Ollama Cloud")
            yield json.dumps({
                "type": "error",
                "message": "Couldn't connect to Ollama Cloud. Check OLLAMA_BASE_URL in Render."
            }) + "\n"
        except Exception:
            logger.exception("Unexpected error while streaming an Ollama response")
            yield json.dumps({
                "type": "error",
                "message": "Zenoxi couldn't get a reply. Check the Render logs for the model request error."
            }) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
