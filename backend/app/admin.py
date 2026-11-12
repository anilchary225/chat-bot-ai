"""Platform admin API (only for emails in ADMIN_EMAILS).

  GET    /api/admin/overview                 totals, today, 14-day activity
  GET    /api/admin/users?q=&skip=            users with chat/agent counts
  GET    /api/admin/users/{id}                one user: usage, chats, agents
  POST   /api/admin/users/{id}/block          {blocked}: block sign-in and pause their agents
  DELETE /api/admin/users/{id}                delete an account and all its data
  GET    /api/admin/agents?q=&status=         every agent with usage
  POST   /api/admin/agents/{id}/status        {disabled}
  GET    /api/admin/emails?status=            platform email log
  GET    /api/admin/system                    configuration health, scheduled jobs
  POST   /api/admin/jobs/run                  run due reports and follow-ups now
"""
import logging
import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .agents import AdminStatus, admin_user, aware, is_admin, now, oid
from .config import settings
from .db import get_db

logger = logging.getLogger("zenoxi.admin")
admin_router = APIRouter(prefix="/api/admin")

AGENT_COLLECTIONS = ("agent_sources", "agent_leads", "agent_messages", "agent_conversations", "agent_files",
                     "agent_emails", "agent_unanswered", "agent_unsubscribes", "agent_cache")


def iso(value):
    return aware(value).isoformat() if value else None


def search_filter(q: str | None, *fields: str) -> dict:
    q = (q or "").strip()[:80]
    if not q:
        return {}
    pattern = {"$regex": re.escape(q), "$options": "i"}
    return {"$or": [{f: pattern} for f in fields]}


def matches(doc: dict, q: str | None, *fields: str) -> bool:
    """Same search in Python (keeps results right even where $regex isn't available)."""
    q = (q or "").strip().lower()
    return not q or any(q in str(doc.get(f) or "").lower() for f in fields)


def day_keys(days: int) -> list[str]:
    today = now().date()
    return [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


# ---------------------------------------------------------------- overview

@admin_router.get("/overview")
async def overview(user: dict = Depends(admin_user)):
    db = get_db()
    days = day_keys(14)
    since = now() - timedelta(days=14)
    start_today = now().replace(hour=0, minute=0, second=0, microsecond=0)
    series = {d: {"day": d, "users": 0, "chat_messages": 0, "visitor_messages": 0, "free_answers": 0, "leads": 0}
              for d in days}

    async for u in db.users.find({"created_at": {"$gte": since}}, {"created_at": 1}):
        d = iso(u.get("created_at"))
        if d and d[:10] in series:
            series[d[:10]]["users"] += 1
    async for m in db.messages.find({"role": "user", "created_at": {"$gte": since}}, {"created_at": 1}):
        d = iso(m.get("created_at"))
        if d and d[:10] in series:
            series[d[:10]]["chat_messages"] += 1
    async for u in db.agent_usage.find({"day": {"$in": days}}):
        row = series.get(u.get("day"))
        if row:
            row["visitor_messages"] += u.get("messages", 0)
            row["free_answers"] += u.get("cached", 0)
            row["leads"] += u.get("leads", 0)

    today = series[days[-1]]
    visitor_14 = sum(r["visitor_messages"] for r in series.values())
    free_14 = sum(r["free_answers"] for r in series.values())
    active_today = await db.users.count_documents({"last_login": {"$gte": start_today}})
    return {
        "users": await db.users.count_documents({}),
        "users_blocked": await db.users.count_documents({"blocked": True}),
        "users_today": today["users"],
        "active_today": active_today,
        "chats": await db.chats.count_documents({}),
        "chat_messages_today": today["chat_messages"],
        "agents": await db.agents.count_documents({}),
        "agents_live": await db.agents.count_documents({"status": "live"}),
        "agents_disabled": await db.agents.count_documents({"disabled": True}),
        "leads_total": await db.agent_leads.count_documents({}),
        "leads_today": today["leads"],
        "messages_today": today["visitor_messages"],
        "free_answers_today": today["free_answers"],
        "saved_percent_14d": round(100 * free_14 / visitor_14) if visitor_14 else 0,
        "emails_failed_today": await db.agent_emails.count_documents({"status": "failed", "created_at": {"$gte": start_today}}),
        "daily_message_limit": settings.agent_daily_messages,
        "series": list(series.values()),
    }


# ---------------------------------------------------------------- users

async def user_row(db, u: dict) -> dict:
    return {
        "id": str(u["_id"]), "email": u["email"], "name": u.get("name") or u["email"].split("@")[0],
        "picture": u.get("picture"), "created_at": iso(u.get("created_at")), "last_login": iso(u.get("last_login")),
        "blocked": bool(u.get("blocked")), "is_admin": is_admin(u), "google": bool(u.get("google_sub")),
        "chats": await db.chats.count_documents({"owner_id": u["_id"]}),
        "agents": await db.agents.count_documents({"owner_id": u["_id"]}),
    }


@admin_router.get("/users")
async def users(q: str | None = Query(None, max_length=80), skip: int = Query(0, ge=0),
                user: dict = Depends(admin_user)):
    db = get_db()
    found = [u async for u in db.users.find(search_filter(q, "email", "name")).sort("created_at", -1).limit(skip + 50)]
    found = [u for u in found if matches(u, q, "email", "name")][skip:skip + 50]
    return {"users": [await user_row(db, u) for u in found],
            "total": await db.users.count_documents(search_filter(q, "email", "name")) if q else await db.users.count_documents({})}


async def find_user(user_id: str) -> dict:
    found = await get_db().users.find_one({"_id": oid(user_id)})
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    return found


@admin_router.get("/users/{user_id}")
async def user_detail(user_id: str, user: dict = Depends(admin_user)):
    db = get_db()
    u = await find_user(user_id)
    chats = [c async for c in db.chats.find({"owner_id": u["_id"]}).sort("updated_at", -1).limit(10)]
    agents = [a async for a in db.agents.find({"owner_id": u["_id"]})]
    chat_ids = [c["_id"] async for c in db.chats.find({"owner_id": u["_id"]}, {"_id": 1})]
    return {
        **await user_row(db, u),
        "messages": await db.messages.count_documents({"chat_id": {"$in": chat_ids}}) if chat_ids else 0,
        "documents": await db.documents.count_documents({"chat_id": {"$in": chat_ids}}) if chat_ids else 0,
        "sessions": await db.sessions.count_documents({"user_id": u["_id"]}),
        "recent_chats": [{"id": str(c["_id"]), "title": c.get("title") or "New chat", "channels": c.get("channels", []),
                          "updated_at": iso(c.get("updated_at"))} for c in chats],
        "agent_list": [{"id": str(a["_id"]), "name": a["name"], "business_name": a["business_name"],
                        "status": a.get("status"), "disabled": bool(a.get("disabled")),
                        "leads": await db.agent_leads.count_documents({"agent_id": a["_id"]})} for a in agents],
    }


class BlockPayload(BaseModel):
    blocked: bool


def protect(target: dict, admin: dict) -> None:
    if target["_id"] == admin["_id"]:
        raise HTTPException(status_code=400, detail="You can't do this to your own account.")
    if is_admin(target):
        raise HTTPException(status_code=400, detail="Remove this email from ADMIN_EMAILS first.")


@admin_router.post("/users/{user_id}/block")
async def block_user(user_id: str, payload: BlockPayload, user: dict = Depends(admin_user)):
    db = get_db()
    target = await find_user(user_id)
    protect(target, user)
    await db.users.update_one({"_id": target["_id"]}, {"$set": {"blocked": payload.blocked, "blocked_at": now() if payload.blocked else None}})
    if payload.blocked:
        await db.sessions.delete_many({"user_id": target["_id"]})  # signs them out everywhere
        async for a in db.agents.find({"owner_id": target["_id"]}):
            if not a.get("disabled"):
                await db.agents.update_one({"_id": a["_id"]}, {"$set": {"disabled": True, "disabled_reason": "owner_blocked"}})
    else:
        async for a in db.agents.find({"owner_id": target["_id"]}):
            if a.get("disabled_reason") == "owner_blocked":
                await db.agents.update_one({"_id": a["_id"]}, {"$set": {"disabled": False, "disabled_reason": None}})
    logger.warning("Admin %s set user %s blocked=%s", user["email"], target["email"], payload.blocked)
    return {"ok": True, "blocked": payload.blocked}


@admin_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(admin_user)):
    """Deletes the account with its chats, documents, agents and sessions (for deletion requests)."""
    db = get_db()
    target = await find_user(user_id)
    protect(target, user)
    removed = {"chats": 0, "agents": 0}
    async for c in db.chats.find({"owner_id": target["_id"]}, {"_id": 1}):
        for coll in ("messages", "documents", "channel_links", "link_codes"):
            await getattr(db, coll).delete_many({"chat_id": c["_id"]})
        removed["chats"] += 1
    await db.chats.delete_many({"owner_id": target["_id"]})
    async for a in db.agents.find({"owner_id": target["_id"]}, {"_id": 1}):
        for coll in AGENT_COLLECTIONS:
            await getattr(db, coll).delete_many({"agent_id": a["_id"]})
        removed["agents"] += 1
    await db.agents.delete_many({"owner_id": target["_id"]})
    await db.sessions.delete_many({"user_id": target["_id"]})
    await db.email_codes.delete_one({"_id": target["email"]})
    await db.users.delete_one({"_id": target["_id"]})
    logger.warning("Admin %s deleted user %s (%s)", user["email"], target["email"], removed)
    return {"deleted": True, **removed}


# ---------------------------------------------------------------- agents

@admin_router.get("/agents")
async def agents(q: str | None = Query(None, max_length=80), status: str | None = Query(None, pattern="^(live|draft|disabled)$"),
                 user: dict = Depends(admin_user)):
    db = get_db()
    query = search_filter(q, "name", "business_name", "allowed_domains")
    if status == "disabled":
        query["disabled"] = True
    elif status:
        query["status"] = status
    days = day_keys(7)
    rows = []
    owners: dict = {}
    async for a in db.agents.find(query).sort("created_at", -1).limit(500):
        if not matches({**a, "allowed_domains": " ".join(a.get("allowed_domains", []))}, q, "name", "business_name", "allowed_domains"):
            continue
        if status == "disabled" and not a.get("disabled"):
            continue
        if status in ("live", "draft") and a.get("status") != status:
            continue
        if a.get("owner_id") not in owners:
            owners[a.get("owner_id")] = (await db.users.find_one({"_id": a.get("owner_id")}) or {}).get("email")
        week = [u async for u in db.agent_usage.find({"agent_id": a["_id"], "day": {"$in": days}})]
        week = [u for u in week if u.get("day") in days]
        today = next((u for u in week if u.get("day") == days[-1]), {})
        rows.append({
            "id": str(a["_id"]), "name": a["name"], "business_name": a["business_name"], "owner_email": owners[a.get("owner_id")],
            "owner_id": str(a.get("owner_id")) if a.get("owner_id") else None, "public_key": a.get("public_key"),
            "status": a.get("status"), "disabled": bool(a.get("disabled")), "disabled_reason": a.get("disabled_reason"),
            "allowed_domains": a.get("allowed_domains", []), "own_ai_key": bool(a.get("ai_key")),
            "messages_today": today.get("messages", 0), "messages_7d": sum(u.get("messages", 0) for u in week),
            "free_7d": sum(u.get("cached", 0) for u in week), "emails_today": today.get("emails", 0),
            "leads": await db.agent_leads.count_documents({"agent_id": a["_id"]}),
            "created_at": iso(a.get("created_at")),
        })
    return rows


@admin_router.post("/agents/{agent_id}/status")
async def agent_status(agent_id: str, payload: AdminStatus, user: dict = Depends(admin_user)):
    result = await get_db().agents.update_one({"_id": oid(agent_id)},
                                              {"$set": {"disabled": payload.disabled, "disabled_reason": "admin" if payload.disabled else None,
                                                        "updated_at": now()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Agent not found")
    logger.warning("Admin %s set agent %s disabled=%s", user["email"], agent_id, payload.disabled)
    return {"ok": True, "disabled": payload.disabled}


# ---------------------------------------------------------------- emails

@admin_router.get("/emails")
async def emails(status: str | None = Query(None, pattern="^(sent|logged|failed|skipped)$"), user: dict = Depends(admin_user)):
    db = get_db()
    names: dict = {}
    rows = []
    async for e in db.agent_emails.find({"status": status} if status else {}).sort("created_at", -1).limit(200):
        if status and e.get("status") != status:
            continue
        if e.get("agent_id") not in names:
            names[e.get("agent_id")] = (await db.agents.find_one({"_id": e.get("agent_id")}) or {}).get("business_name", "Deleted agent")
        rows.append({"id": str(e["_id"]), "agent": names[e.get("agent_id")], "to": e.get("to"), "kind": e.get("kind"),
                     "subject": e.get("subject"), "status": e.get("status"), "error": e.get("error") or "",
                     "created_at": iso(e.get("created_at"))})
    return rows


# ---------------------------------------------------------------- system

@admin_router.get("/system")
async def system(user: dict = Depends(admin_user)):
    db = get_db()
    jobs = await db.system_status.find_one({"_id": "jobs"}) or {}
    mail = "brevo" if settings.brevo_api_key else "smtp" if settings.smtp_host else None
    checks = [
        {"name": "AI (OpenRouter)", "ok": bool(settings.openrouter_api_key), "detail": settings.openrouter_model},
        {"name": "Email", "ok": bool(mail), "detail": f"{mail} · from {settings.mail_from or 'not set'}" if mail else "Not configured: codes and emails are only logged"},
        {"name": "Sign-in secret", "ok": bool(settings.auth_secret), "detail": "AUTH_SECRET set" if settings.auth_secret else "AUTH_SECRET missing"},
        {"name": "Google sign-in", "ok": bool(settings.google_client_id), "detail": "Configured" if settings.google_client_id else "Not configured"},
        {"name": "Web search", "ok": True, "detail": "Tavily" if settings.tavily_api_key else "Free fallback engines (no Tavily key)"},
        {"name": "WhatsApp", "ok": bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id),
         "detail": settings.whatsapp_display_number or ("Configured" if settings.whatsapp_access_token else "Not configured")},
        {"name": "Instagram", "ok": bool(settings.instagram_access_token),
         "detail": f"@{settings.instagram_username}" if settings.instagram_username else ("Configured" if settings.instagram_access_token else "Not configured")},
        {"name": "Scheduled jobs", "ok": bool(settings.background_jobs or settings.cron_secret),
         "detail": ("Background loop on" if settings.background_jobs else "Background loop off")
                   + (" · cron secret set" if settings.cron_secret else " · no CRON_SECRET")},
    ]
    return {
        "checks": checks,
        "jobs": {"last_run": iso(jobs.get("last_run")), "result": jobs.get("result") or {}, "source": jobs.get("source")},
        "limits": {"agent_daily_messages": settings.agent_daily_messages,
                   "agent_daily_messages_own_key": settings.agent_daily_messages_own_key,
                   "agent_daily_emails": settings.agent_daily_emails},
        "admins": [e.strip() for e in (settings.admin_emails or "").split(",") if e.strip()],
        "version": "0.5.0",
    }


@admin_router.post("/jobs/run")
async def run_jobs(user: dict = Depends(admin_user)):
    from .agent_extras import run_due_jobs  # local import: agent_extras imports agents
    result = await run_due_jobs(source="admin")
    return {"ok": True, "result": result}
