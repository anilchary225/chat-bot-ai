"""Token savers for Website Agents.

1. FAQ instant answers: a visitor question that closely matches one of the owner's FAQs is answered
   straight from the FAQ, with no AI call at all.
2. Answer cache: the same (normalized) question to the same agent reuses a recent answer while the
   agent's knowledge hasn't changed.
Both are counted as "answered free" in analytics.
"""
import hashlib
import re
from datetime import timedelta

from .db import get_db

CACHE_TTL = timedelta(days=7)
FAQ_THRESHOLD = 0.72
STOP = set("""a an and are as at be by can could do does for from have how i if in is it me my of on or our please
so tell than that the their them there these this to us was we what when where which who why will with you your
hi hello hey pls plz""".split())
SYNONYMS = {"fees": "fee", "price": "fee", "prices": "fee", "cost": "fee", "costs": "fee", "charges": "fee",
            "timing": "hours", "timings": "hours", "time": "hours", "open": "hours", "opening": "hours",
            "classes": "class", "courses": "course", "batches": "batch", "located": "location", "address": "location",
            "where": "location", "refunds": "refund", "weekends": "weekend", "saturday": "weekend", "sunday": "weekend"}


def terms(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    out = set()
    for w in words:
        if w in STOP or len(w) < 2:
            continue
        w = SYNONYMS.get(w, w)
        if len(w) > 4 and w.endswith("s"):  # light stemming: "questions" -> "question"
            w = w[:-1]
        out.add(w)
    return out


def non_latin(text: str) -> bool:
    """True when the question has letters outside English (Telugu, Hindi, Tamil, ...).
    Saved FAQ and cached answers are matched on English words only, so such questions always go to the AI,
    which replies in the visitor's language."""
    return any(ch.isalpha() and ord(ch) > 127 for ch in text or "")


def similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    overlap = len(a & b)
    return overlap / max(len(a), len(b)) if overlap else 0.0


def faq_answer(agent: dict, question: str) -> str | None:
    """Best FAQ answer if the question clearly matches one; None otherwise."""
    q = terms(question)
    if len(q) == 0 or non_latin(question):
        return None
    best, score = None, 0.0
    for faq in (agent.get("profile") or {}).get("faqs", []):
        s = similarity(q, terms(faq.get("q", "")))
        if s > score:
            best, score = faq, s
    return best["a"] if best and score >= FAQ_THRESHOLD else None


def knowledge_version(agent: dict) -> str:
    stamp = agent.get("updated_at")
    return str(stamp.timestamp() if hasattr(stamp, "timestamp") else stamp)


def cache_key(agent: dict, question: str) -> str:
    norm = " ".join(sorted(terms(question)))
    digest = hashlib.sha1(f"{knowledge_version(agent)}|{norm}".encode()).hexdigest()[:20]
    return f"{agent['_id']}:{digest}"


async def cached_answer(agent: dict, question: str, now) -> str | None:
    if len(terms(question)) == 0 or non_latin(question):
        return None
    doc = await get_db().agent_cache.find_one({"_id": cache_key(agent, question)})
    if doc and doc.get("expires_at") and doc["expires_at"].replace(tzinfo=now.tzinfo) > now:
        return doc["answer"]
    return None


async def store_answer(agent: dict, question: str, answer: str, now) -> None:
    if len(terms(question)) == 0 or non_latin(question) or not answer or len(answer) > 4000:
        return
    await get_db().agent_cache.update_one(
        {"_id": cache_key(agent, question)},
        {"$set": {"agent_id": agent["_id"], "answer": answer, "expires_at": now + CACHE_TTL}},
        upsert=True,
    )


async def clear_cache(agent_id) -> None:
    await get_db().agent_cache.delete_many({"agent_id": agent_id})
