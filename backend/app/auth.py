"""Passwordless accounts: a 6-digit code sent by email, or "Continue with Google".

Codes are stored hashed, expire after 10 minutes and allow 5 attempts. Sessions are
random bearer tokens (stored hashed) valid for 30 days.
"""
import asyncio
import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from .chat_core import now
from .config import settings
from .db import get_db
from .mailer import MailError, send_code

router = APIRouter(prefix="/api/auth")

CODE_TTL = timedelta(minutes=10)
SESSION_TTL = timedelta(days=30)
RESEND_AFTER = timedelta(seconds=60)
MAX_ATTEMPTS = 5
MAX_SENDS_PER_HOUR = 6
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class CodeRequest(BaseModel):
    email: str = Field(max_length=254)
    mode: str = Field(pattern="^(signin|signup)$")
    name: str | None = Field(None, max_length=60)


class VerifyRequest(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6)


class GoogleRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


logger = logging.getLogger("zenoxi.auth")


def _hash(value: str) -> str:
    pepper = (settings.auth_secret or "zenoxi-dev-pepper").encode()
    return hmac.new(pepper, value.encode(), hashlib.sha256).hexdigest()


def _aware(dt):
    return dt.replace(tzinfo=now().tzinfo) if dt is not None and dt.tzinfo is None else dt


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return email


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name") or user["email"].split("@")[0],
        "picture": user.get("picture"),
    }


@router.post("/request-code")
async def request_code(payload: CodeRequest):
    db = get_db()
    email = normalize_email(payload.email)
    user = await db.users.find_one({"email": email})
    if payload.mode == "signin" and not user:
        raise HTTPException(status_code=404, detail="No account with this email yet. Sign up instead.")
    if payload.mode == "signup" and user:
        raise HTTPException(status_code=409, detail="You already have an account. Sign in instead.")
    name = (payload.name or "").strip()
    if payload.mode == "signup" and not name:
        raise HTTPException(status_code=422, detail="Enter your name.")

    existing = await db.email_codes.find_one({"_id": email})
    current = now()
    sends = []
    if existing:
        sent_at = _aware(existing.get("sent_at"))
        if sent_at and current - sent_at < RESEND_AFTER:
            wait = int((RESEND_AFTER - (current - sent_at)).total_seconds()) + 1
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code.")
        sends = [s for s in existing.get("sends", []) if current - _aware(s) < timedelta(hours=1)]
        if len(sends) >= MAX_SENDS_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many codes requested. Try again in an hour.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.email_codes.update_one(
        {"_id": email},
        {"$set": {
            "code_hash": _hash(f"{email}:{code}"), "purpose": payload.mode, "name": name[:60],
            "attempts": 0, "sent_at": current, "expires_at": current + CODE_TTL, "sends": sends + [current],
        }},
        upsert=True,
    )
    try:
        await send_code(email, code, payload.mode, name or (user or {}).get("name", ""))
    except MailError:
        await db.email_codes.delete_one({"_id": email})
        raise HTTPException(status_code=502, detail="Couldn't send the email right now. Try again in a minute.")
    return {"sent": True, "email": email, "resend_after": int(RESEND_AFTER.total_seconds())}


@router.post("/verify")
async def verify(payload: VerifyRequest):
    db = get_db()
    email = normalize_email(payload.email)
    record = await db.email_codes.find_one({"_id": email})
    if not record or _aware(record["expires_at"]) < now():
        raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")
    attempts = int(record.get("attempts", 0))
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many wrong codes. Request a new one.")
    if not hmac.compare_digest(record["code_hash"], _hash(f"{email}:{payload.code.strip()}")):
        attempts += 1
        await db.email_codes.update_one({"_id": email}, {"$set": {"attempts": attempts}})
        left = max(0, MAX_ATTEMPTS - attempts)
        raise HTTPException(status_code=400, detail=f"That code isn't right. {left} {'try' if left == 1 else 'tries'} left." if left else "Too many wrong codes. Request a new one.")
    await db.email_codes.delete_one({"_id": email})

    user = await db.users.find_one({"email": email})
    if not user:
        user = {"email": email, "name": record.get("name") or email.split("@")[0], "created_at": now()}
        result = await db.users.insert_one(user)
        user["_id"] = result.inserted_id
    return await start_session(db, user)


async def start_session(db, user: dict, extra: dict | None = None) -> dict:
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="This account has been blocked. Contact support if this is a mistake.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": now(), "verified": True, **(extra or {})}})
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one({
        "_id": _hash(token), "user_id": user["_id"], "created_at": now(), "expires_at": now() + SESSION_TTL,
    })
    from .agents import is_admin  # local import: agents imports this module
    return {"token": token, "user": {**serialize_user(user), "is_admin": is_admin(user)}}


def verify_google_token(credential: str) -> dict:
    """Check the Google ID token's signature, audience, issuer and expiry (raises ValueError)."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)


@router.post("/google")
async def google_sign_in(payload: GoogleRequest):
    """Sign in or sign up with the ID token from the "Continue with Google" button."""
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in isn't set up on the server yet.")
    try:
        info = await asyncio.to_thread(verify_google_token, payload.credential)
    except Exception as exc:
        logger.warning("Rejected Google token: %s", exc)
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com") or not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Your Google email isn't verified.")

    db = get_db()
    email = normalize_email(info["email"])
    google_id = str(info["sub"])
    # Same person if we've seen this Google account before, or the (Google-verified) email matches.
    user = await db.users.find_one({"google_sub": google_id}) or await db.users.find_one({"email": email})
    if not user:
        user = {"email": email, "name": (info.get("name") or email.split("@")[0])[:60], "created_at": now()}
        result = await db.users.insert_one(user)
        user["_id"] = result.inserted_id
    extra = {"google_sub": google_id}
    if info.get("picture"):
        extra["picture"] = info["picture"]
        user["picture"] = info["picture"]
    return await start_session(db, user, extra)


async def current_user(authorization: str | None = Header(None)) -> dict:
    """FastAPI dependency: the signed-in user, or 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    db = get_db()
    session = await db.sessions.find_one({"_id": _hash(authorization[7:].strip())})
    if not session or _aware(session["expires_at"]) < now():
        raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="This account has been blocked. Contact support if this is a mistake.")
    return user


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    from .agents import is_admin  # local import: agents imports this module
    return {**serialize_user(user), "is_admin": is_admin(user)}


@router.post("/logout")
async def logout(authorization: str | None = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        await get_db().sessions.delete_one({"_id": _hash(authorization[7:].strip())})
    return {"ok": True}
