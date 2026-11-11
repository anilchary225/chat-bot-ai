"""WhatsApp (Cloud API) and Instagram (Messaging API) channels.

Both apps talk to the same chats as the website:
  • "link CODE"  joins the web chat that produced CODE ("Continue on WhatsApp")
  • "/web"       replies with a private link that opens this chat on the website
  • "/new"       starts a fresh chat;  "/search <question>" answers with web search
Replies to users who message first are free on both platforms (24-hour window).
"""
import asyncio
import hashlib
import hmac
import json
import logging
import re
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pymongo.errors import DuplicateKeyError

from .chat_core import create_chat, ensure_access_key, model_error_message, now, run_turn
from .config import settings
from .db import get_db
from .documents import MAX_UPLOAD_BYTES, DocumentError

logger = logging.getLogger("zenoxi.channels")
router = APIRouter()

LIMITS = {"whatsapp": 4000, "instagram": 950}  # WhatsApp 4096 / Instagram 1000 chars per message
HELP = (
    "Hi, I'm Zenoxi 👋 Ask me anything.\n\n"
    "Commands:\n"
    "• /web: open this chat on the website\n"
    "• /new: start a new chat\n"
    "• /search <question>: answer with live web results\n"
    "• link CODE: continue a chat from the website"
)


def channel_config(code: str | None = None) -> dict:
    """Public info the website needs for its "Continue on…" buttons."""
    text = quote(f"link {code}") if code else ""
    wa_number = re.sub(r"\D", "", settings.whatsapp_display_number or "")
    ig_user = (settings.instagram_username or "").lstrip("@")
    whatsapp = bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id and wa_number)
    instagram = bool(settings.instagram_access_token and ig_user)
    return {
        "whatsapp": {
            "enabled": whatsapp,
            "number": wa_number if whatsapp else None,
            "url": (f"https://wa.me/{wa_number}" + (f"?text={text}" if text else "")) if whatsapp else None,
        },
        "instagram": {
            "enabled": instagram,
            "username": ig_user if instagram else None,
            "url": f"https://ig.me/m/{ig_user}" if instagram else None,
        },
    }


# ---------- formatting ----------

def to_whatsapp(text: str) -> str:
    """Markdown -> WhatsApp formatting (*bold*, _italic_, no headings/link syntax)."""
    text = re.sub(r"```[a-zA-Z0-9_-]*\n", "```\n", text)
    text = re.sub(r"^#{1,6}\s*(.+)$", r"*\1*", text, flags=re.M)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    text = re.sub(r"__(.+?)__", r"*\1*", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1 (\2)", text)
    return re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.M)


def to_plain(text: str) -> str:
    """Markdown -> plain text for Instagram, which has no formatting."""
    text = re.sub(r"```[a-zA-Z0-9_-]*\n?", "", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"(\*\*|__)(.+?)\1", r"\2", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1 (\2)", text)
    return re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.M)


def split_message(text: str, limit: int) -> list[str]:
    """Split on paragraph, then line, then word boundaries to fit platform limits."""
    parts, current = [], ""
    for block in re.split(r"(\n\n)", text):
        if len(current) + len(block) <= limit:
            current += block
            continue
        if current.strip():
            parts.append(current.strip())
        current = ""
        while len(block) > limit:
            cut = block.rfind("\n", 0, limit)
            cut = cut if cut > limit // 2 else block.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            parts.append(block[:cut].strip())
            block = block[cut:]
        current = block
    if current.strip():
        parts.append(current.strip())
    return parts or [text[:limit]]


def format_reply(channel: str, answer: str, sources: list[dict], notice: str | None) -> list[str]:
    body = to_whatsapp(answer) if channel == "whatsapp" else to_plain(answer)
    if sources:
        body += "\n\nSources:\n" + "\n".join(f"[{i}] {s['url']}" for i, s in enumerate(sources, 1))
    if notice:
        body = f"({notice})\n\n{body}"
    return split_message(body, LIMITS[channel])


# ---------- Graph API senders ----------

def _graph(path: str, host: str = "graph.facebook.com") -> str:
    return f"https://{host}/{settings.graph_api_version}/{path.lstrip('/')}"


async def _post(url: str, token: str, payload: dict) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, json=payload, headers={"Authorization": f"Bearer {token}"})
        if response.status_code >= 400:
            logger.error("Graph API %s -> %s %s", url, response.status_code, response.text[:300])
        response.raise_for_status()


async def send_whatsapp(to: str, text: str) -> None:
    await _post(_graph(f"{settings.whatsapp_phone_number_id}/messages"), settings.whatsapp_access_token, {
        "messaging_product": "whatsapp", "recipient_type": "individual", "to": to,
        "type": "text", "text": {"preview_url": False, "body": text},
    })


async def whatsapp_typing(message_id: str) -> None:
    """Mark the user's message read and show "typing…" (best effort)."""
    try:
        await _post(_graph(f"{settings.whatsapp_phone_number_id}/messages"), settings.whatsapp_access_token, {
            "messaging_product": "whatsapp", "status": "read", "message_id": message_id,
            "typing_indicator": {"type": "text"},
        })
    except Exception:
        pass


async def send_instagram(to: str, text: str) -> None:
    await _post(_graph("me/messages", "graph.instagram.com"), settings.instagram_access_token, {
        "recipient": {"id": to}, "message": {"text": text},
    })


async def instagram_typing(to: str) -> None:
    try:
        await _post(_graph("me/messages", "graph.instagram.com"), settings.instagram_access_token, {
            "recipient": {"id": to}, "sender_action": "typing_on",
        })
    except Exception:
        pass


SENDERS = {"whatsapp": send_whatsapp, "instagram": send_instagram}


async def reply(channel: str, to: str, text: str) -> None:
    parts = format_reply(channel, text, [], None) if isinstance(text, str) else text
    for part in parts:
        await SENDERS[channel](to, part)


async def download_whatsapp_media(media_id: str) -> bytes:
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        meta = await client.get(_graph(media_id), headers=headers)
        meta.raise_for_status()
        info = meta.json()
        if int(info.get("file_size") or 0) > MAX_UPLOAD_BYTES:
            raise DocumentError("Files can be up to 10 MB.")
        media = await client.get(info["url"], headers=headers)
        media.raise_for_status()
        return media.content


# ---------- conversation routing ----------

async def linked_chat(db, channel: str, user_id: str, *, create: bool = True) -> dict | None:
    link = await db.channel_links.find_one({"_id": f"{channel}:{user_id}"})
    if link:
        chat = await db.chats.find_one({"_id": link["chat_id"]})
        if chat:
            return chat
    if not create:
        return None
    chat = await create_chat(db, private=True, channel=channel)
    await set_link(db, channel, user_id, chat)
    return chat


async def set_link(db, channel: str, user_id: str, chat: dict) -> None:
    await db.channel_links.update_one(
        {"_id": f"{channel}:{user_id}"},
        {"$set": {"chat_id": chat["_id"], "channel": channel, "updated_at": now()}},
        upsert=True,
    )
    channels = sorted(set(chat.get("channels", [])) | {channel})
    await db.chats.update_one({"_id": chat["_id"]}, {"$set": {"channels": channels}})
    chat["channels"] = channels


def web_link(chat: dict) -> str:
    base = settings.public_frontend_url.rstrip("/")
    return f"{base}/?chat={chat['_id']}&key={chat['access_key']}"


async def handle_text(channel: str, user_id: str, text: str, *, attachment_ids=()) -> None:
    db = get_db()
    text = text.strip()
    lower = text.lower()

    link_match = re.fullmatch(r"/?link\s+([A-Za-z0-9]{6})", text, flags=re.I)
    if link_match:
        code = link_match.group(1).upper()
        record = await db.link_codes.find_one({"_id": code})
        expires = record and record["expires_at"]
        if expires is not None and expires.tzinfo is None:  # Mongo returns naive UTC datetimes
            expires = expires.replace(tzinfo=now().tzinfo)
        chat = record and expires > now() and await db.chats.find_one({"_id": record["chat_id"]})
        if not chat:
            await reply(channel, user_id, "That code is invalid or has expired. Tap \"Continue on\" on the website to get a new one.")
            return
        await db.link_codes.delete_one({"_id": code})
        await ensure_access_key(db, chat)
        await set_link(db, channel, user_id, chat)
        await reply(channel, user_id, f"Linked ✅ You're now in \"{chat.get('title', 'your chat')}\". "
                                      "Keep chatting here; everything stays in sync with the website.")
        return
    if lower in ("/help", "help", "hi", "hello", "start", "/start") and not await linked_chat(db, channel, user_id, create=False):
        await linked_chat(db, channel, user_id)
        await reply(channel, user_id, HELP)
        return
    if lower == "/help":
        await reply(channel, user_id, HELP)
        return
    if lower == "/new":
        chat = await create_chat(db, private=True, channel=channel)
        await set_link(db, channel, user_id, chat)
        await reply(channel, user_id, "Started a new chat ✨ What would you like to talk about?")
        return
    if lower == "/web":
        chat = await linked_chat(db, channel, user_id)
        await ensure_access_key(db, chat)
        await reply(channel, user_id, f"Open this chat on the website (keep this link private):\n{web_link(chat)}")
        return

    use_web = False
    if lower.startswith("/search"):
        use_web, text = True, text[len("/search"):].strip()
        if not text:
            await reply(channel, user_id, "Add a question after /search, e.g. /search latest iPhone price")
            return

    chat = await linked_chat(db, channel, user_id)
    try:
        answer, sources, notice = await run_turn(
            db, chat, text, channel=channel, use_web=use_web, attachment_ids=attachment_ids
        )
    except Exception as exc:
        logger.exception("Channel reply failed")
        await reply(channel, user_id, model_error_message(exc))
        return
    await reply(channel, user_id, format_reply(channel, answer, sources, notice))


async def handle_whatsapp_document(user_id: str, message: dict) -> None:
    from .main import store_document  # local import avoids a circular import

    db = get_db()
    doc = message.get("document", {})
    filename = Path(doc.get("filename") or "document").name[:120]
    chat = await linked_chat(db, "whatsapp", user_id)
    try:
        data = await download_whatsapp_media(doc["id"])
        stored = await store_document(db, chat["_id"], filename, data)
    except DocumentError as exc:
        await reply("whatsapp", user_id, f"I couldn't read {filename}: {exc}")
        return
    except Exception:
        logger.exception("WhatsApp document download failed")
        await reply("whatsapp", user_id, f"I couldn't download {filename}. Try sending it again.")
        return
    caption = (doc.get("caption") or "").strip()
    if caption:
        await handle_text("whatsapp", user_id, caption, attachment_ids=[stored["_id"]])
    else:
        pages = f" ({stored['pages']} pages)" if stored.get("pages") else ""
        await reply("whatsapp", user_id, f"📄 Got {filename}{pages}. Ask me anything about it.")


async def first_time(event_id: str) -> bool:
    """Meta retries webhooks; process each message id only once."""
    try:
        await get_db().channel_events.insert_one({"_id": event_id, "created_at": now()})
        return True
    except DuplicateKeyError:
        return False


async def process_whatsapp(payload: dict) -> None:
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []) or []:
                if not await first_time(f"wa:{message.get('id')}"):
                    continue
                sender = message.get("from")
                kind = message.get("type")
                try:
                    await whatsapp_typing(message.get("id"))
                    if kind == "text":
                        await handle_text("whatsapp", sender, message["text"]["body"])
                    elif kind == "document":
                        await handle_whatsapp_document(sender, message)
                    elif kind == "interactive":
                        reply_obj = message["interactive"].get("button_reply") or message["interactive"].get("list_reply") or {}
                        await handle_text("whatsapp", sender, reply_obj.get("title", ""))
                    else:
                        await reply("whatsapp", sender, "I can read text messages and documents (PDF, Word, text) for now.")
                except Exception:
                    logger.exception("Failed to handle WhatsApp message")


async def process_instagram(payload: dict) -> None:
    for entry in payload.get("entry", []):
        account_id = str(entry.get("id", ""))
        for event in entry.get("messaging", []) or []:
            message = event.get("message") or {}
            sender = str(event.get("sender", {}).get("id", ""))
            if not message or message.get("is_echo") or sender == account_id:
                continue
            if not await first_time(f"ig:{message.get('mid')}"):
                continue
            try:
                if message.get("text"):
                    await instagram_typing(sender)
                    await handle_text("instagram", sender, message["text"])
                elif message.get("attachments"):
                    await reply("instagram", sender, "I can only read text messages on Instagram. Send files on the website or WhatsApp.")
            except Exception:
                logger.exception("Failed to handle Instagram message")


# ---------- webhooks ----------

def verify_signature(body: bytes, header: str | None, secret: str | None) -> bool:
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def verify_challenge(mode: str | None, token: str | None, challenge: str | None) -> PlainTextResponse:
    if mode == "subscribe" and settings.meta_verify_token and token and hmac.compare_digest(token, settings.meta_verify_token):
        return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.get("/webhooks/whatsapp")
async def whatsapp_verify(mode: str | None = Query(None, alias="hub.mode"),
                          token: str | None = Query(None, alias="hub.verify_token"),
                          challenge: str | None = Query(None, alias="hub.challenge")):
    return verify_challenge(mode, token, challenge)


@router.get("/webhooks/instagram")
async def instagram_verify(mode: str | None = Query(None, alias="hub.mode"),
                           token: str | None = Query(None, alias="hub.verify_token"),
                           challenge: str | None = Query(None, alias="hub.challenge")):
    return verify_challenge(mode, token, challenge)


async def _receive(request: Request, secret: str | None) -> dict:
    body = await request.body()
    if not verify_signature(body, request.headers.get("X-Hub-Signature-256"), secret):
        raise HTTPException(status_code=403, detail="Bad signature")
    try:
        return json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request, background: BackgroundTasks):
    payload = await _receive(request, settings.meta_app_secret)
    background.add_task(process_whatsapp, payload)  # reply after Meta gets its fast 200
    return {"ok": True}


@router.post("/webhooks/instagram")
async def instagram_webhook(request: Request, background: BackgroundTasks):
    payload = await _receive(request, settings.instagram_app_secret or settings.meta_app_secret)
    background.add_task(process_instagram, payload)
    return {"ok": True}
