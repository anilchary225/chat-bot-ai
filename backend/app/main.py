import asyncio
import json
import logging
import re
import secrets
import string
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from . import resume as resume_tool
from .auth import current_user, router as auth_router
from .channels import router as channels_router, channel_config
from .chat_core import (
    add_web_results, attachment_meta, create_chat as new_chat_doc, ensure_access_key, key_matches,
    model_error_message, now, parse_object_id, prepare_turn, save_reply, serialize_chat, serialize_message,
)
from .config import settings
from .db import close_db, connect_db, get_db
from .documents import MAX_UPLOAD_BYTES, DocumentError, extract_text
from .openrouter import complete_chat, stream_chat
from .schemas import CreateChatRequest, SendMessageRequest
from .search import SearchError

MAX_DOCS_PER_CHAT = 10
LINK_CODE_MINUTES = 15
logger = logging.getLogger("zenoxi.api")


def serialize_document(doc):
    return {
        "id": str(doc["_id"]),
        "filename": doc["filename"],
        "kind": doc["kind"],
        "size": doc["size"],
        "pages": doc.get("pages"),
        "chars": doc["chars"],
        "created_at": doc["created_at"].isoformat(),
    }


def valid_id(value: str):
    oid = parse_object_id(value)
    if oid is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return oid


async def load_chat(chat_id: str, key: str | None, user: dict) -> dict:
    """A chat the user owns, or a linked chat whose private key they hold.

    Opening a WhatsApp/Instagram chat through its private link claims it for the
    signed-in user, so it then shows up in their chat list on every device.
    """
    db = get_db()
    chat = await db.chats.find_one({"_id": valid_id(chat_id)})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.get("owner_id") == user["_id"]:
        return chat
    # A private key only unlocks a chat nobody owns yet (started on WhatsApp/Instagram).
    if chat.get("owner_id") is None and chat.get("access_key") and key and key_matches(chat, key):
        await db.chats.update_one({"_id": chat["_id"]}, {"$set": {"owner_id": user["_id"]}})
        chat["owner_id"] = user["_id"]
        return chat
    raise HTTPException(status_code=404, detail="Chat not found")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.auth_secret:
        logger.warning("AUTH_SECRET is not set; using a development secret. Set it before going to production.")
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Zenoxi API", version="0.2.0", lifespan=lifespan)
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
app.include_router(channels_router)
app.include_router(auth_router)


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
        "model": settings.openrouter_model,
        "inference": settings.openrouter_base_url,
    }


@app.get("/api/chats")
async def list_chats(x_chat_keys: str | None = Header(None), user: dict = Depends(current_user)):
    """The user's chats, plus linked chats whose private keys this browser holds."""
    db = get_db()
    chats = [doc async for doc in db.chats.find({"owner_id": user["_id"]}).sort("updated_at", -1).limit(200)]
    seen = {c["_id"] for c in chats}
    for pair in (x_chat_keys or "").split(",")[:50]:
        chat_id, _, key = pair.strip().partition(":")
        oid = parse_object_id(chat_id)
        if oid and key and oid not in seen:
            chat = await db.chats.find_one({"_id": oid})
            if chat and chat.get("access_key") and key_matches(chat, key) and chat.get("owner_id") in (None, user["_id"]):
                chats.append(chat)
                seen.add(oid)
    chats.sort(key=lambda c: c["updated_at"], reverse=True)
    return [serialize_chat(doc) for doc in chats]


@app.post("/api/chats")
async def create_chat(payload: CreateChatRequest, user: dict = Depends(current_user)):
    doc = await new_chat_doc(get_db(), payload.title.strip() or "New chat", owner_id=user["_id"])
    return serialize_chat(doc)


@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    return serialize_chat(await load_chat(chat_id, x_chat_key, user))


@app.get("/api/chats/{chat_id}/messages")
async def get_messages(chat_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    cursor = get_db().messages.find({"chat_id": chat["_id"]}).sort("created_at", 1).limit(500)
    return [serialize_message(doc) async for doc in cursor]


@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    db = get_db()
    await db.chats.delete_one({"_id": chat["_id"]})
    await db.messages.delete_many({"chat_id": chat["_id"]})
    await db.documents.delete_many({"chat_id": chat["_id"]})
    await db.channel_links.delete_many({"chat_id": chat["_id"]})
    await db.link_codes.delete_many({"chat_id": chat["_id"]})
    return {"deleted": True}


# ---------- Continue on WhatsApp / Instagram ----------

@app.get("/api/channels")
async def channels_info():
    return channel_config()


@app.post("/api/chats/{chat_id}/link-code")
async def create_link_code(chat_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    """One-time code the user sends to the WhatsApp/Instagram bot to join this chat."""
    chat = await load_chat(chat_id, x_chat_key, user)
    db = get_db()
    key = await ensure_access_key(db, chat)  # linked chats become private
    alphabet = "".join(c for c in string.ascii_uppercase + string.digits if c not in "O0I1L")
    code = "".join(secrets.choice(alphabet) for _ in range(6))
    expires = now() + timedelta(minutes=LINK_CODE_MINUTES)
    await db.link_codes.delete_many({"chat_id": chat["_id"]})
    await db.link_codes.insert_one({"_id": code, "chat_id": chat["_id"], "expires_at": expires})
    return {"code": code, "expires_at": expires.isoformat(), "key": key, **channel_config(code)}


# ---------- Documents ----------

@app.post("/api/chats/{chat_id}/documents")
async def upload_document(chat_id: str, file: UploadFile = File(...), x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    db = get_db()
    if await db.documents.count_documents({"chat_id": chat["_id"]}) >= MAX_DOCS_PER_CHAT:
        raise HTTPException(status_code=422, detail=f"A chat can have up to {MAX_DOCS_PER_CHAT} files.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    filename = Path(file.filename or "document").name[:120] or "document"
    try:
        doc = await store_document(db, chat["_id"], filename, data)
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return serialize_document(doc)


async def store_document(db, chat_oid, filename: str, data: bytes) -> dict:
    """Parse a file and save its text to a chat (raises DocumentError)."""
    try:
        parsed = await asyncio.to_thread(extract_text, filename, data)
    except DocumentError:
        raise
    except Exception as exc:
        logger.exception("Failed to parse upload %s", filename)
        raise DocumentError("Couldn't read this file.") from exc
    doc = {
        "chat_id": chat_oid,
        "filename": filename,
        "kind": parsed["kind"],
        "size": len(data),
        "pages": parsed["pages"],
        "chars": len(parsed["text"]),
        "text": parsed["text"],
        "created_at": now(),
    }
    result = await db.documents.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@app.get("/api/chats/{chat_id}/documents")
async def list_documents(chat_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    cursor = get_db().documents.find({"chat_id": chat["_id"]}, {"text": 0}).sort("created_at", 1)
    return [serialize_document(doc) async for doc in cursor]


@app.delete("/api/chats/{chat_id}/documents/{document_id}")
async def delete_document(chat_id: str, document_id: str, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    result = await get_db().documents.delete_one({"_id": valid_id(document_id), "chat_id": chat["_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="File not found")
    return {"deleted": True}


# ---------- Chat ----------

@app.post("/api/chats/{chat_id}/messages")
async def send_message(chat_id: str, payload: SendMessageRequest, x_chat_key: str | None = Header(None),
                user: dict = Depends(current_user)):
    chat = await load_chat(chat_id, x_chat_key, user)
    db = get_db()
    user_text = payload.content.strip()
    if not user_text:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    turn = await prepare_turn(db, chat, user_text, attachment_ids=payload.attachment_ids, channel="web")

    async def event_stream():
        pieces, sources = [], []
        if payload.web_search:
            yield json.dumps({"type": "status", "stage": "searching"}) + "\n"
            try:
                sources = await add_web_results(turn)
            except SearchError:
                yield json.dumps({
                    "type": "notice",
                    "message": "Web search is unavailable right now, so this answer uses built-in knowledge.",
                }) + "\n"
            if sources:
                yield json.dumps({"type": "sources", "sources": sources}) + "\n"
        try:
            async for token in stream_chat(turn["messages"]):
                pieces.append(token)
                yield json.dumps({"type": "token", "content": token}) + "\n"
            message_id = await save_reply(db, turn["oid"], "".join(pieces), sources, "web")
            yield json.dumps({"type": "done", "message_id": str(message_id)}) + "\n"
        except Exception as exc:
            logger.exception("Model request failed")
            yield json.dumps({"type": "error", "message": model_error_message(exc)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ---------- Resume ATS tool ----------

class TailorRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=60000)
    job_description: str = Field(min_length=30, max_length=30000)

class DocxRequest(BaseModel):
    resume: dict

def openrouter_error_message(exc: Exception | None) -> str:
    if isinstance(exc, (httpx.HTTPStatusError, httpx.RequestError)):
        return model_error_message(exc)
    return "The AI couldn't produce a valid resume. Try again."

@app.post("/api/resume/analyze")
async def resume_analyze(
    job_description: str = Form(..., min_length=30, max_length=30000),
    file: UploadFile | None = File(None),
    resume_text: str | None = Form(None, max_length=60000),
    user: dict = Depends(current_user),
):
    if file is not None:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        try:
            parsed = await asyncio.to_thread(extract_text, Path(file.filename or "resume").name, data)
        except DocumentError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        text = parsed["text"]
    else:
        text = (resume_text or "").strip()
    if len(text) < 50:
        raise HTTPException(status_code=422, detail="Add your resume as a file or paste at least a few lines of it.")
    # PDF page markers aren't part of the resume itself.
    text = re.sub(r"^\[Page \d+\]\n", "", text, flags=re.M)
    return {"resume_text": text, "analysis": resume_tool.analyze(text, job_description)}

@app.post("/api/resume/tailor")
async def resume_tailor(payload: TailorRequest, user: dict = Depends(current_user)):
    before = resume_tool.analyze(payload.resume_text, payload.job_description)
    messages = resume_tool.tailor_messages(payload.resume_text, payload.job_description, before)
    last_error: Exception | None = None
    for _ in range(2):  # free models sometimes return broken JSON; retry once
        try:
            raw = await complete_chat(messages, temperature=0.3, max_tokens=4000)
            tailored = resume_tool.clean_resume(resume_tool.parse_json(raw))
            if not (tailored["experience"] or tailored["education"] or tailored["skills"]):
                raise ValueError("Model returned an empty resume")
            break
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.exception("Resume tailoring request failed")
            raise HTTPException(status_code=502, detail=openrouter_error_message(exc))
        except Exception as exc:
            logger.warning("Resume tailoring returned unusable output: %s", exc)
            last_error = exc
    else:
        raise HTTPException(status_code=502, detail=openrouter_error_message(last_error))

    text = resume_tool.resume_to_text(tailored)
    after = resume_tool.analyze(text, payload.job_description)
    _, scale, one_page = await asyncio.to_thread(resume_tool.render_pdf, tailored)
    return {"resume": tailored, "text": text, "before": before, "after": after,
            "layout": {"scale": scale, "one_page": one_page}}

def _resume_filename(resume: dict, ext: str) -> str:
    name = re.sub(r"[^A-Za-z0-9]+", "_", resume["name"] or "resume").strip("_") or "resume"
    return f"{name}_ATS_Resume.{ext}"


@app.post("/api/resume/docx")
async def resume_docx(payload: DocxRequest, user: dict = Depends(current_user)):
    resume = resume_tool.clean_resume(payload.resume)
    data = await asyncio.to_thread(resume_tool.render_docx, resume)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_resume_filename(resume, "docx")}"'},
    )


@app.post("/api/resume/pdf")
async def resume_pdf(payload: DocxRequest, user: dict = Depends(current_user)):
    resume = resume_tool.clean_resume(payload.resume)
    data, scale, one_page = await asyncio.to_thread(resume_tool.render_pdf, resume)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_resume_filename(resume, "pdf")}"',
            "X-Resume-Scale": str(scale),
            "X-Resume-One-Page": "true" if one_page else "false",
        },
    )
