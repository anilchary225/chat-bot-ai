"""Web search for up-to-date answers.

Uses Tavily when TAVILY_API_KEY is set (built for LLM apps, has a free tier).
If the key is missing, out of credits or failing, it falls back to free keyless
engines (DuckDuckGo, Bing, ...) via the `ddgs` package.
"""
import asyncio
import logging
import time
from urllib.parse import urlparse

import httpx

from .config import settings

logger = logging.getLogger("zenoxi.search")

TAVILY_URL = "https://api.tavily.com/search"
MAX_QUERY_CHARS = 380
MAX_SNIPPET_CHARS = 700
FALLBACK_ENGINES = "bing, duckduckgo, brave, google, mojeek, yahoo"
FALLBACK_ATTEMPTS = 3

# Tavily status codes that mean "stop using Tavily for a while":
# 432/433 = plan or pay-as-you-go credits used up, 401 = bad key, 429 = rate limited.
QUOTA_COOLDOWN_SECONDS = {432: 3600, 433: 3600, 401: 3600, 429: 60}
_tavily_paused_until = 0.0


class SearchError(Exception):
    """Raised when every search provider failed."""


def _clean(results: list[dict]) -> list[dict]:
    seen, cleaned = set(), []
    for item in results:
        url = (item.get("url") or "").strip()
        if not url.startswith(("http://", "https://")) or url in seen:
            continue
        seen.add(url)
        snippet = " ".join((item.get("snippet") or "").split())
        cleaned.append({
            "title": (item.get("title") or urlparse(url).netloc).strip()[:160],
            "url": url,
            "domain": urlparse(url).netloc.removeprefix("www."),
            "snippet": snippet[:MAX_SNIPPET_CHARS],
        })
    return cleaned


async def _tavily(query: str, limit: int) -> list[dict]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        response = await client.post(
            TAVILY_URL,
            headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
            json={"query": query, "max_results": limit, "search_depth": "basic", "topic": "general"},
        )
        response.raise_for_status()
        data = response.json()
    return [
        {"title": r.get("title"), "url": r.get("url"), "snippet": r.get("content")}
        for r in data.get("results", [])
    ]


def _duckduckgo_sync(query: str, limit: int) -> list[dict]:
    from ddgs import DDGS  # imported lazily so the app still starts without it

    # Free scrapers are flaky (the first request often fails), so try several
    # engines and retry once before giving up.
    last_error = None
    for _ in range(FALLBACK_ATTEMPTS):
        try:
            rows = DDGS(timeout=8).text(query, max_results=limit, backend=FALLBACK_ENGINES) or []
            if rows:
                break
        except Exception as exc:  # ddgs raises when every engine came back empty
            last_error = exc
    else:
        raise last_error or RuntimeError("No results found.")
    return [{"title": r.get("title"), "url": r.get("href"), "snippet": r.get("body")} for r in rows]


async def web_search(query: str, limit: int | None = None) -> list[dict]:
    """Return up to `limit` results as dicts: title, url, domain, snippet."""
    query = " ".join(query.split())[:MAX_QUERY_CHARS]
    limit = limit or settings.web_search_max_results
    if not query:
        return []

    global _tavily_paused_until
    if settings.tavily_api_key and time.monotonic() >= _tavily_paused_until:
        try:
            results = _clean(await _tavily(query, limit))
            if results:
                return results
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            cooldown = QUOTA_COOLDOWN_SECONDS.get(status)
            if cooldown:
                _tavily_paused_until = time.monotonic() + cooldown
                logger.warning(
                    "Tavily returned HTTP %s (limit reached or key rejected); "
                    "using free search engines for the next %s s", status, cooldown
                )
            else:
                logger.exception("Tavily search failed, falling back to free search engines")
        except Exception:
            logger.exception("Tavily search failed, falling back to free search engines")

    try:
        rows = await asyncio.wait_for(asyncio.to_thread(_duckduckgo_sync, query, limit), timeout=30)
        return _clean(rows)
    except Exception as exc:
        logger.exception("DuckDuckGo search failed")
        raise SearchError("Web search is unavailable right now.") from exc


def format_sources(results: list[dict]) -> str:
    """Numbered source block to place in the system prompt."""
    return "\n\n".join(
        f"[{i}] {r['title']}\nURL: {r['url']}\n{r['snippet']}" for i, r in enumerate(results, 1)
    )
