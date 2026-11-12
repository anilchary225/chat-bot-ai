"""Website Agents, phases 2-3: leads management, Excel/CSV export, email automations, avatars,
owner AI keys, analytics, unanswered-questions inbox and scheduled jobs.
"""
import asyncio
import base64
import csv
import hashlib
import hmac
import io
import logging
import re
from collections import Counter
from datetime import timedelta
from html import escape

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from . import openrouter
from .agents import (aware, bump_usage, now, oid, owned_agent, profile_text, save_profile_source, serialize_lead,
                     serialize_source)
from .auth import current_user
from .config import settings
from .db import get_db
from .mailer import MailError, send_email

logger = logging.getLogger("zenoxi.agents.extras")
owner_x = APIRouter(prefix="/api/agents")
public_x = APIRouter(prefix="/api/public")
cron_router = APIRouter(prefix="/api/cron")

LEAD_STATUSES = ("new", "contacted", "interested", "won", "lost")


# ---------------------------------------------------------------- secrets

def _fernet():
    from cryptography.fernet import Fernet
    secret = (settings.auth_secret or "zenoxi-dev-secret").encode()
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"agent-keys:" + secret).digest()))


def encrypt_key(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_key(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode()).decode()
    except Exception:
        logger.warning("Couldn't decrypt an agent AI key (AUTH_SECRET changed?)")
        return None


def unsubscribe_token(lead_id) -> str:
    secret = (settings.auth_secret or "zenoxi-dev-secret").encode()
    return hmac.new(secret, f"unsub:{lead_id}".encode(), hashlib.sha256).hexdigest()[:32]


# ---------------------------------------------------------------- unanswered questions

def _norm_question(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text.lower())).strip()[:200]


async def record_unanswered(agent: dict, question: str) -> None:
    norm = _norm_question(question)
    if len(norm) < 3:
        return
    key = f"{agent['_id']}:{hashlib.sha1(norm.encode()).hexdigest()[:16]}"
    await get_db().agent_unanswered.update_one(
        {"_id": key},
        {"$inc": {"count": 1}, "$set": {"agent_id": agent["_id"], "question": question.strip()[:300], "last_at": now()},
         "$setOnInsert": {"status": "open", "created_at": now()}},
        upsert=True,
    )


# ---------------------------------------------------------------- email rendering

def fill(template: str, values: dict) -> str:
    """Replace {placeholders}; unknown ones become empty (owners can't break emails)."""
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), "")), template or "")


def email_html(title: str, body_html: str, color: str, footer_html: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f6f4f1;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ece6df">
<tr><td style="height:5px;background:{color}"></td></tr>
<tr><td style="padding:26px 28px 8px;font-size:20px;font-weight:700">{escape(title)}</td></tr>
<tr><td style="padding:6px 28px 24px;font-size:14.5px;line-height:1.6">{body_html}</td></tr>
</table>
<div style="max-width:560px;padding:14px 8px;font-size:12px;line-height:1.5;color:#8a8178">{footer_html}</div>
</td></tr></table></body></html>"""


def text_to_html(text: str) -> str:
    return "<br>".join(escape(line) for line in (text or "").split("\n"))


async def log_email(agent_id, lead_id, to: str, kind: str, subject: str, status: str, error: str = "") -> None:
    await get_db().agent_emails.insert_one({"agent_id": agent_id, "lead_id": lead_id, "to": to, "kind": kind,
                                            "subject": subject[:200], "status": status, "error": error[:300], "created_at": now()})


async def deliver(agent: dict, lead_id, to: str, kind: str, subject: str, html: str, text: str,
                  reply_to: str | None = None, attachments=None) -> str:
    """Send one email for an agent, enforcing the daily cap and logging the result."""
    if await bump_usage(agent["_id"], "emails") > settings.agent_daily_emails:
        await log_email(agent["_id"], lead_id, to, kind, subject, "skipped", "Daily email limit reached")
        return "skipped"
    try:
        status = await send_email(to, subject, html, text, reply_to=reply_to,
                                  from_name=f"{agent['business_name'][:40]} via Zenoxi", attachments=attachments)
        await log_email(agent["_id"], lead_id, to, kind, subject, status)
        return status
    except MailError as exc:
        await log_email(agent["_id"], lead_id, to, kind, subject, "failed", str(exc))
        return "failed"


async def owner_address(agent: dict) -> str | None:
    custom = (agent.get("settings") or {}).get("emails", {}).get("owner_email")
    if custom:
        return custom
    owner = await get_db().users.find_one({"_id": agent.get("owner_id")})
    return (owner or {}).get("email")


def lead_values(agent: dict, lead: dict) -> dict:
    fields = lead.get("fields", {})
    return {"business": agent["business_name"], "agent": agent["name"], "name": fields.get("name", "there"),
            **{k: v for k, v in fields.items()}}


def field_rows(agent: dict, lead: dict) -> str:
    labels = {f["key"]: f["label"] for f in (agent.get("settings") or {}).get("form", {}).get("fields", [])}
    rows = "".join(f'<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top">{escape(labels.get(k, k))}</td>'
                   f'<td style="padding:6px 0;font-weight:600">{escape(str(v))}</td></tr>' for k, v in lead.get("fields", {}).items())
    return f'<table role="presentation" style="border-collapse:collapse">{rows}</table>'


# ---------------------------------------------------------------- new lead pipeline

async def summarize_conversation(agent: dict, conversation_id) -> str:
    if not conversation_id:
        return ""
    msgs = [m async for m in get_db().agent_messages.find({"conversation_id": conversation_id}).sort("created_at", 1).limit(30)]
    if not msgs:
        return ""
    transcript = "\n".join(f"{'Visitor' if m['role'] == 'user' else 'Assistant'}: {m['content'][:400]}" for m in msgs)[-5000:]
    from .agents import agent_api_key
    try:
        summary = await openrouter.complete_chat([
            {"role": "system", "content": "Summarize what this website visitor wants in one or two short sentences for "
                                          "a sales follow-up (interest, budget, timing, questions). No preamble."},
            {"role": "user", "content": transcript}], temperature=0.2, max_tokens=120, api_key=agent_api_key(agent))
        return summary.strip()[:400]
    except Exception:
        logger.warning("Lead summary failed", exc_info=True)
        return ""


async def process_new_lead(agent_id, lead_id) -> None:
    """Runs after an inquiry: AI summary, owner alert, visitor confirmation (+ requested documents)."""
    db = get_db()
    agent = await db.agents.find_one({"_id": agent_id})
    lead = await db.agent_leads.find_one({"_id": lead_id})
    if not agent or not lead:
        return
    s = agent.get("settings") or {}
    emails = s.get("emails") or {}
    color = s.get("color", "#ff6a2b")
    summary = await summarize_conversation(agent, lead.get("conversation_id"))
    if summary:
        await db.agent_leads.update_one({"_id": lead_id}, {"$set": {"summary": summary}})
        lead["summary"] = summary
    values = lead_values(agent, lead)

    if emails.get("notify_owner", True) and not lead.get("preview"):
        to = await owner_address(agent)
        if to:
            dashboard = settings.public_frontend_url.rstrip("/")
            body = (f"<p>You have a new inquiry from your website assistant.</p>{field_rows(agent, lead)}"
                    + (f'<p style="margin-top:14px;padding:10px 12px;background:#fff7ed;border-radius:10px"><b>Summary:</b> {escape(summary)}</p>' if summary else "")
                    + (f'<p style="color:#6b7280">Page: {escape(lead.get("page_url") or "-")}</p>')
                    + f'<p><a href="{dashboard}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:{color};color:#fff;text-decoration:none;font-weight:700">Open leads in Zenoxi</a></p>')
            text = f"New inquiry for {agent['business_name']}\n\n" + "\n".join(f"{k}: {v}" for k, v in lead["fields"].items()) + (f"\n\nSummary: {summary}" if summary else "")
            visitor_email = lead["fields"].get("email")
            await deliver(agent, lead_id, to, "owner_alert", f"New inquiry: {values.get('name', 'website visitor')}",
                          email_html("New inquiry 🎉", body, color, f"Sent by Zenoxi for {escape(agent['business_name'])}."),
                          text, reply_to=visitor_email)

    visitor = lead["fields"].get("email")
    unsubscribed = visitor and await db.agent_unsubscribes.find_one({"_id": f"{agent_id}:{visitor.lower()}"})
    if visitor and lead.get("preview"):
        # Preview tests only email the owner's own address, never whatever was typed in.
        owner = (await owner_address(agent) or "").lower()
        if visitor.lower() != owner:
            visitor = None
    if visitor and lead.get("consent") and emails.get("visitor_confirmation") and not unsubscribed:
        subject = fill(emails.get("confirmation_subject", ""), values)
        text_body = fill(emails.get("confirmation_body", ""), values)
        attachments = []
        for doc_id in lead.get("documents", []):
            f = await db.agent_files.find_one({"_id": ObjectId(doc_id)}) if ObjectId.is_valid(doc_id) else None
            if f and f.get("agent_id") == agent_id:
                attachments.append((f["filename"], f["data"], f.get("mime", "application/octet-stream")))
        unsub = f"{settings.public_api_url.rstrip('/')}/api/public/unsubscribe?l={lead_id}&t={unsubscribe_token(lead_id)}"
        footer = (f"You're receiving this because you contacted {escape(agent['business_name'])} through their website. "
                  f'<a href="{unsub}" style="color:#8a8178">Unsubscribe</a>')
        await deliver(agent, lead_id, visitor, "visitor_confirmation", subject,
                      email_html(subject, text_to_html(text_body), color, footer),
                      text_body + f"\n\nUnsubscribe: {unsub}", reply_to=await owner_address(agent), attachments=attachments)


# ---------------------------------------------------------------- leads management + export

class LeadUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(new|contacted|interested|won|lost)$")
    notes: str | None = Field(None, max_length=4000)


@owner_x.patch("/{agent_id}/leads/{lead_id}")
async def update_lead(agent_id: str, lead_id: str, payload: LeadUpdate, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=422, detail="Nothing to update.")
    update["updated_at"] = now()
    result = await get_db().agent_leads.update_one({"_id": oid(lead_id), "agent_id": agent["_id"]}, {"$set": update})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Lead not found")
    return serialize_lead(await get_db().agent_leads.find_one({"_id": oid(lead_id)}))


@owner_x.delete("/{agent_id}/leads/{lead_id}")
async def delete_lead(agent_id: str, lead_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    result = await get_db().agent_leads.delete_one({"_id": oid(lead_id), "agent_id": agent["_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"deleted": True}


@owner_x.get("/{agent_id}/conversations/{conversation_id}")
async def get_conversation(agent_id: str, conversation_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    conv = await get_db().agent_conversations.find_one({"_id": oid(conversation_id), "agent_id": agent["_id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = [m async for m in get_db().agent_messages.find({"conversation_id": conv["_id"]}).sort("created_at", 1).limit(200)]
    return {"id": str(conv["_id"]), "page_url": conv.get("page_url"),
            "messages": [{"role": m["role"], "content": m["content"], "created_at": aware(m["created_at"]).isoformat()} for m in msgs]}


async def leads_for_export(agent: dict, status: str | None) -> tuple[list[str], list[str], list[list]]:
    query = {"agent_id": agent["_id"]}
    if status in LEAD_STATUSES:
        query["status"] = status
    leads = [l async for l in get_db().agent_leads.find(query).sort("created_at", -1).limit(5000)]
    form_fields = (agent.get("settings") or {}).get("form", {}).get("fields", [])
    keys = [f["key"] for f in form_fields]
    keys += sorted({k for l in leads for k in l.get("fields", {})} - set(keys))
    labels = {f["key"]: f["label"] for f in form_fields}
    headers = ["Date", *[labels.get(k, k) for k in keys], "Status", "Notes", "Summary", "Page", "Consent"]
    rows = [[aware(l["created_at"]).strftime("%Y-%m-%d %H:%M"), *[l.get("fields", {}).get(k, "") for k in keys],
             l.get("status", "new"), l.get("notes", ""), l.get("summary", ""), l.get("page_url") or "",
             "Yes" if l.get("consent") else "No"] for l in leads]
    return keys, headers, rows


def build_xlsx(title: str, headers: list[str], rows: list[list], color: str) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Leads"
    ws.append(headers)
    fill_color = color.lstrip("#").upper() if re.fullmatch(r"#[0-9a-fA-F]{6}", color or "") else "FF6A2B"
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=fill_color)
        cell.alignment = Alignment(vertical="center")
    for row in rows:
        ws.append([str(v) if v is not None else "" for v in row])
    for i, header in enumerate(headers, 1):
        width = max([len(str(header))] + [len(str(r[i - 1])) for r in rows[:500]]) + 2
        ws.column_dimensions[get_column_letter(i)].width = min(max(width, 10), 60)
    ws.freeze_panes = "A2"
    if rows:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    wb.properties.title = title
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_csv(headers: list[str], rows: list[list]) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    for row in rows:  # neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell)
        writer.writerow([("'" + str(v)) if str(v)[:1] in ("=", "+", "-", "@") else v for v in row])
    return ("﻿" + out.getvalue()).encode("utf-8")  # BOM so Excel opens UTF-8 correctly


def safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")[:40] or "agent"


@owner_x.get("/{agent_id}/leads/export")
async def export_leads(agent_id: str, format: str = "xlsx", status: str | None = None, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    _, headers, rows = await leads_for_export(agent, status)
    stamp = now().strftime("%Y-%m-%d")
    base = f"{safe_filename(agent['business_name'])}_leads_{stamp}"
    if format == "csv":
        return Response(build_csv(headers, rows), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{base}.csv"'})
    data = await asyncio.to_thread(build_xlsx, f"{agent['business_name']} leads", headers, rows,
                                   (agent.get("settings") or {}).get("color", "#ff6a2b"))
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{base}.xlsx"'})


@owner_x.get("/{agent_id}/emails")
async def email_log(agent_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    return [{"id": str(e["_id"]), "to": e["to"], "kind": e["kind"], "subject": e["subject"], "status": e["status"],
             "error": e.get("error", ""), "created_at": aware(e["created_at"]).isoformat()}
            async for e in get_db().agent_emails.find({"agent_id": agent["_id"]}).sort("created_at", -1).limit(200)]


# ---------------------------------------------------------------- knowledge: shareable files

class SourceUpdate(BaseModel):
    shareable: bool


@owner_x.patch("/{agent_id}/sources/{source_id}")
async def update_source(agent_id: str, source_id: str, payload: SourceUpdate, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    src = await get_db().agent_sources.find_one({"_id": oid(source_id), "agent_id": agent["_id"]})
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    if payload.shareable and not src.get("has_file"):
        raise HTTPException(status_code=422, detail="Only uploaded files (up to 5 MB) can be emailed to visitors.")
    await get_db().agent_sources.update_one({"_id": src["_id"]}, {"$set": {"shareable": payload.shareable}})
    src["shareable"] = payload.shareable
    return serialize_source(src)


# ---------------------------------------------------------------- avatar

@owner_x.post("/{agent_id}/avatar")
async def upload_avatar(agent_id: str, file: UploadFile = File(...), user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    data = await file.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise HTTPException(status_code=422, detail="Logos can be up to 1 MB.")

    def process() -> bytes:
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(data))
        if img.format not in ("PNG", "JPEG", "WEBP"):
            raise ValueError("format")
        img = ImageOps.exif_transpose(img).convert("RGBA")
        img = ImageOps.fit(img, (256, 256), method=Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        return out.getvalue()

    try:
        png = await asyncio.to_thread(process)
    except Exception:
        raise HTTPException(status_code=422, detail="Use a PNG, JPG or WebP image.")
    s = agent.get("settings") or {}
    s.setdefault("avatar", {})["type"] = "image"
    version = int(agent.get("avatar_version", 0)) + 1
    await get_db().agents.update_one({"_id": agent["_id"]}, {"$set": {
        "avatar_png": base64.b64encode(png).decode(), "avatar_version": version, "settings": s, "updated_at": now()}})
    from .agents import serialize_agent
    return serialize_agent({**agent, "avatar_png": True, "avatar_version": version, "settings": s})


@owner_x.delete("/{agent_id}/avatar")
async def delete_avatar(agent_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    s = agent.get("settings") or {}
    if s.get("avatar", {}).get("type") == "image":
        s["avatar"]["type"] = "orb"
    await get_db().agents.update_one({"_id": agent["_id"]}, {"$set": {"avatar_png": None, "settings": s}})
    return {"deleted": True}


@public_x.get("/agents/{public_key}/avatar")
async def public_avatar(public_key: str):
    agent = await get_db().agents.find_one({"public_key": public_key})
    if not agent or agent.get("disabled") or not agent.get("avatar_png"):
        raise HTTPException(status_code=404, detail="No avatar")
    return Response(base64.b64decode(agent["avatar_png"]), media_type="image/png",
                    headers={"Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff"})


# ---------------------------------------------------------------- owner's own AI key

class AiKey(BaseModel):
    key: str = Field(min_length=20, max_length=200)


@owner_x.put("/{agent_id}/ai-key")
async def set_ai_key(agent_id: str, payload: AiKey, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    key = payload.key.strip()
    if not key.startswith("sk-or-"):
        raise HTTPException(status_code=422, detail="That doesn't look like an OpenRouter key (it starts with sk-or-).")
    await get_db().agents.update_one({"_id": agent["_id"]}, {"$set": {"ai_key_enc": encrypt_key(key), "ai_key_last4": key[-4:]}})
    return {"own_ai_key": True, "ai_key_last4": key[-4:], "daily_limit": settings.agent_daily_messages_own_key}


@owner_x.delete("/{agent_id}/ai-key")
async def delete_ai_key(agent_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    await get_db().agents.update_one({"_id": agent["_id"]}, {"$set": {"ai_key_enc": None, "ai_key_last4": None}})
    return {"own_ai_key": False, "daily_limit": settings.agent_daily_messages}


# ---------------------------------------------------------------- analytics

@owner_x.get("/{agent_id}/analytics")
async def analytics(agent_id: str, days: int = 14, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    db = get_db()
    days = max(7, min(days, 60))
    series = []
    for i in range(days - 1, -1, -1):
        day = (now() - timedelta(days=i)).strftime("%Y-%m-%d")
        u = await db.agent_usage.find_one({"_id": f"{agent['_id']}:{day}"}) or {}
        series.append({"day": day, "messages": u.get("messages", 0), "leads": u.get("leads", 0),
                       "emails": u.get("emails", 0), "cached": u.get("cached", 0)})
    conversations = await db.agent_conversations.count_documents({"agent_id": agent["_id"]})
    leads = [l async for l in db.agent_leads.find({"agent_id": agent["_id"]})]
    by_status = Counter(l.get("status", "new") for l in leads)
    questions = Counter()
    async for m in db.agent_messages.find({"agent_id": agent["_id"], "role": "user"}).sort("created_at", -1).limit(2000):
        norm = _norm_question(m["content"])
        if len(norm) > 3:
            questions[norm] += 1
    total_msgs = sum(d["messages"] for d in series)
    cached = sum(d["cached"] for d in series)
    return {
        "series": series,
        "totals": {"messages": total_msgs, "leads": sum(d["leads"] for d in series), "conversations": conversations,
                   "conversion": round(100 * len(leads) / conversations, 1) if conversations else 0,
                   "answered_free": cached, "saved_percent": round(100 * cached / total_msgs, 1) if total_msgs else 0},
        "leads_by_status": {s: by_status.get(s, 0) for s in LEAD_STATUSES},
        "top_questions": [{"question": q, "count": c} for q, c in questions.most_common(10)],
        "unanswered_open": await db.agent_unanswered.count_documents({"agent_id": agent["_id"], "status": "open"}),
        "daily_limit": settings.agent_daily_messages_own_key if agent.get("ai_key_enc") else settings.agent_daily_messages,
    }


# ---------------------------------------------------------------- unanswered inbox

class UnansweredAnswer(BaseModel):
    answer: str = Field(min_length=2, max_length=2000)


@owner_x.get("/{agent_id}/unanswered")
async def list_unanswered(agent_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    return [{"id": u["_id"], "question": u["question"], "count": u.get("count", 1), "status": u.get("status", "open"),
             "last_at": aware(u["last_at"]).isoformat()}
            async for u in get_db().agent_unanswered.find({"agent_id": agent["_id"], "status": "open"}).sort("last_at", -1).limit(200)]


@owner_x.post("/{agent_id}/unanswered/{item_id}/answer")
async def answer_unanswered(agent_id: str, item_id: str, payload: UnansweredAnswer, user: dict = Depends(current_user)):
    """Turn a question the agent couldn't answer into a FAQ, so it knows next time."""
    agent = await owned_agent(agent_id, user)
    db = get_db()
    item = await db.agent_unanswered.find_one({"_id": item_id, "agent_id": agent["_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")
    faq = {"q": item["question"], "a": payload.answer.strip()}
    profile = agent.get("profile")
    if profile:
        profile.setdefault("faqs", []).append(faq)
        await db.agents.update_one({"_id": agent["_id"]}, {"$set": {"profile": profile, "updated_at": now()}})
        await save_profile_source(db, agent, profile)
    else:
        await db.agent_sources.insert_one({"agent_id": agent["_id"], "kind": "note", "title": f"FAQ: {faq['q'][:80]}",
                                           "source": None, "text": f"Q: {faq['q']}\nA: {faq['a']}", "created_at": now()})
    await db.agent_unanswered.update_one({"_id": item_id}, {"$set": {"status": "answered", "answer": faq["a"]}})
    from .agent_tokens import clear_cache
    await clear_cache(agent["_id"])
    return {"ok": True, "faq": faq}


@owner_x.delete("/{agent_id}/unanswered/{item_id}")
async def dismiss_unanswered(agent_id: str, item_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    await get_db().agent_unanswered.update_one({"_id": item_id, "agent_id": agent["_id"]}, {"$set": {"status": "dismissed"}})
    return {"ok": True}


# ---------------------------------------------------------------- unsubscribe

@public_x.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(l: str, t: str):
    page = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial;background:#f6f4f1;display:grid;place-items:center;height:100vh;margin:0"><div style="background:#fff;padding:28px 32px;border-radius:16px;max-width:420px;text-align:center"><h2>{title}</h2><p style="color:#6b7280">{text}</p></div>'
    if not ObjectId.is_valid(l) or not hmac.compare_digest(unsubscribe_token(l), t or ""):
        return HTMLResponse(page.format(title="Link not valid", text="This unsubscribe link is invalid."), status_code=400)
    lead = await get_db().agent_leads.find_one({"_id": ObjectId(l)})
    email = (lead or {}).get("fields", {}).get("email")
    if email:
        await get_db().agent_unsubscribes.update_one({"_id": f"{lead['agent_id']}:{email.lower()}"},
                                                     {"$set": {"agent_id": lead["agent_id"], "created_at": now()}}, upsert=True)
    return HTMLResponse(page.format(title="You're unsubscribed", text="You won't receive more emails about this inquiry."))


# ---------------------------------------------------------------- scheduled jobs

async def send_report(agent: dict, period_days: int) -> str:
    db = get_db()
    since = now() - timedelta(days=period_days)
    _, headers, rows = await leads_for_export(agent, None)
    recent = [r for r in rows if r[0] >= since.strftime("%Y-%m-%d %H:%M")]
    to = await owner_address(agent)
    if not to:
        return "skipped"
    label = "today" if period_days == 1 else "this week"
    xlsx = await asyncio.to_thread(build_xlsx, f"{agent['business_name']} leads", headers, rows,
                                   (agent.get("settings") or {}).get("color", "#ff6a2b"))
    color = (agent.get("settings") or {}).get("color", "#ff6a2b")
    body = (f"<p><b>{len(recent)}</b> new lead{'s' if len(recent) != 1 else ''} {label} for <b>{escape(agent['business_name'])}</b>.</p>"
            f"<p>The attached Excel file has all {len(rows)} leads, with status and notes.</p>")
    status = await deliver(agent, None, to, "report", f"{agent['business_name']}: {len(recent)} new leads {label}",
                           email_html("Your lead report 📊", body, color, "Change or turn off reports in Zenoxi → Website Agents → Emails."),
                           f"{len(recent)} new leads {label}. All leads attached.",
                           attachments=[(f"{safe_filename(agent['business_name'])}_leads.xlsx", xlsx,
                                         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")])
    await db.agents.update_one({"_id": agent["_id"]}, {"$set": {"last_report_at": now()}})
    return status


async def run_due_jobs(source: str = "loop") -> dict:
    """Send due lead reports and follow-up emails. Safe to call often."""
    done = await _run_due_jobs()
    await get_db().system_status.update_one({"_id": "jobs"}, {"$set": {"last_run": now(), "result": done, "source": source}},
                                            upsert=True)
    return done


async def _run_due_jobs() -> dict:
    db = get_db()
    done = {"reports": 0, "followups": 0}
    async for agent in db.agents.find({}):
        if agent.get("disabled"):
            continue
        emails = (agent.get("settings") or {}).get("emails") or {}
        period = {"daily": 1, "weekly": 7}.get(emails.get("report"))
        last = aware(agent.get("last_report_at")) or aware(agent.get("created_at"))
        if period and now() - last >= timedelta(days=period):
            if await send_report(agent, period) in ("sent", "logged"):
                done["reports"] += 1
        fu = emails.get("followup") or {}
        if fu.get("enabled"):
            cutoff = now() - timedelta(days=int(fu.get("days", 3)))
            async for lead in db.agent_leads.find({"agent_id": agent["_id"], "consent": True}):
                email = lead.get("fields", {}).get("email")
                if (not email or lead.get("followup_sent_at") or lead.get("preview")
                        or lead.get("status", "new") not in ("new", "contacted") or aware(lead["created_at"]) > cutoff):
                    continue
                if await db.agent_unsubscribes.find_one({"_id": f"{agent['_id']}:{email.lower()}"}):
                    continue
                values = lead_values(agent, lead)
                subject, body = fill(fu.get("subject", ""), values), fill(fu.get("body", ""), values)
                unsub = f"{settings.public_api_url.rstrip('/')}/api/public/unsubscribe?l={lead['_id']}&t={unsubscribe_token(lead['_id'])}"
                status = await deliver(agent, lead["_id"], email, "followup", subject,
                                       email_html(subject, text_to_html(body), (agent.get("settings") or {}).get("color", "#ff6a2b"),
                                                  f'<a href="{unsub}" style="color:#8a8178">Unsubscribe</a>'),
                                       body + f"\n\nUnsubscribe: {unsub}", reply_to=await owner_address(agent))
                await db.agent_leads.update_one({"_id": lead["_id"]}, {"$set": {"followup_sent_at": now()}})
                if status in ("sent", "logged"):
                    done["followups"] += 1
    return done


@cron_router.post("/run")
async def cron_run(x_cron_secret: str | None = Header(None)):
    """For an external scheduler (e.g. a free cron service) when the server sleeps between requests."""
    if not settings.cron_secret or not x_cron_secret or not hmac.compare_digest(settings.cron_secret, x_cron_secret):
        raise HTTPException(status_code=403, detail="Forbidden")
    return await run_due_jobs(source="cron")


@owner_x.post("/{agent_id}/report/send")
async def send_report_now(agent_id: str, user: dict = Depends(current_user)):
    agent = await owned_agent(agent_id, user)
    status = await send_report(agent, 7)
    if status == "failed":
        raise HTTPException(status_code=502, detail="Couldn't send the email. Check the email service settings.")
    return {"status": status}


async def claim_slot(name: str, minutes: int = 30) -> bool:
    """Only one server instance wins each time slot (safe behind a load balancer with many replicas)."""
    from pymongo.errors import DuplicateKeyError
    slot = int(now().timestamp() // (minutes * 60))
    try:
        await get_db().job_locks.insert_one({"_id": f"{name}:{slot}", "created_at": now()})
        return True
    except DuplicateKeyError:
        return False


async def background_loop() -> None:
    """Runs scheduled jobs every 30 minutes while the server is awake (once per slot across replicas)."""
    while True:
        await asyncio.sleep(1800)
        try:
            if await claim_slot("jobs"):
                await run_due_jobs()
        except Exception:
            logger.exception("Scheduled jobs failed")
