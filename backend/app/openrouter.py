"""OpenRouter completions with ordered key failover and per-worker cooldowns."""
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import httpx
from .config import settings

logger = logging.getLogger("zenoxi.openrouter")
# No raw keys in cooldown state or logs.
_cooldowns: dict[str, tuple[float, int]] = {}
_RETRYABLE = {401, 402, 403, 404, 408, 429}


def _fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _error(status: int, data: dict | None = None) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", f"{settings.openrouter_base_url.rstrip('/')}/chat/completions")
    response = httpx.Response(status, json=data or {"error": {"code": status}}, request=request)
    return httpx.HTTPStatusError(f"OpenRouter request failed (HTTP {status})", request=request, response=response)


def _available_keys(api_key: str | None) -> list[str]:
    # Private agent keys stay isolated from the shared platform key pool.
    configured = [api_key] if api_key else [settings.openrouter_api_key, settings.openrouter_api_key_2,
                                          settings.openrouter_api_key_3]
    keys = list(dict.fromkeys(k.strip() for k in configured if k and k.strip()))
    available, blocked = [], []
    for key in keys:
        fingerprint = _fingerprint(key)
        cooldown = _cooldowns.get(fingerprint)
        if cooldown and cooldown[0] > time.time():
            blocked.append(cooldown[1])
        else:
            _cooldowns.pop(fingerprint, None)
            available.append(key)
    if not available:
        raise _error(429 if 429 in blocked else blocked[-1] if blocked else 401)
    return available


def _retryable(exc: Exception) -> bool:
    return isinstance(exc, httpx.RequestError) or (
        isinstance(exc, httpx.HTTPStatusError)
        and (exc.response.status_code in _RETRYABLE or exc.response.status_code >= 500)
    )


def _cool_down(key: str, exc: Exception):
    status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else 503
    wait = 60 if status in (402, 429) else 300 if status in (401, 403) else 15
    if isinstance(exc, httpx.HTTPStatusError):
        response = exc.response
        try:
            try:
                error = response.json().get("error") or {}
            except (ValueError, AttributeError):
                error = {}
            metadata = error.get("metadata") or {}
            headers = {k.lower(): v for k, v in {**dict(response.headers), **metadata.get("headers", {})}.items()}
            retry = headers.get("retry-after")
            if retry:
                try:
                    wait = float(retry)
                except ValueError:
                    wait = parsedate_to_datetime(retry).timestamp() - time.time()
            reset = headers.get("x-ratelimit-reset")
            if status == 429 and reset:
                stamp = float(reset)
                wait = (stamp / 1000 if stamp > 1e11 else stamp) - time.time()
            elif status == 429 and (metadata.get("limit_source") == "openrouter_free_tier_daily"
                                   or "free-models-per-day" in str(error.get("message", ""))):
                tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                wait = tomorrow.timestamp() - time.time()
        except (ValueError, TypeError, AttributeError, OverflowError):
            pass
    _cooldowns[_fingerprint(key)] = (time.time() + max(1, min(wait, 86400)), status)
    logger.warning("OpenRouter key unavailable (HTTP %s); trying the next configured key", status)


def _check_data(data: dict):
    error = data.get("error")
    if error:
        try:
            status = int(error.get("code", 502))
        except (AttributeError, TypeError, ValueError):
            status = 502
        raise _error(status if 400 <= status <= 599 else 502, data)
    for choice in data.get("choices") or []:
        if choice.get("finish_reason") == "error":
            raise _error(502)


def _headers(key: str) -> dict:
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "HTTP-Referer": "https://zenoxi.vercel.app", "X-Title": "Zenoxi"}


def _parse(raw: str) -> dict:
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Expected an object")
        return data
    except ValueError:
        raise _error(502) from None


async def stream_chat(messages: list[dict], api_key: str | None = None, max_tokens: int | None = None):
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    payload = {"model": settings.openrouter_model, "messages": messages, "stream": True, "temperature": 0.7,
               **({"max_tokens": max_tokens} if max_tokens else {})}
    timeout = httpx.Timeout(connect=10.0, read=180.0, write=30.0, pool=10.0)
    last_error = None
    for key in _available_keys(api_key):
        sent = False
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", url, json=payload, headers=_headers(key)) as response:
                    if response.is_error:
                        await response.aread()  # Keep quota reset metadata available.
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            break
                        data = _parse(raw)
                        _check_data(data)
                        choices = data.get("choices") or []
                        token = (choices[0].get("delta") or {}).get("content") if choices else None
                        if token:
                            sent = True
                            yield token
            if not sent:
                raise _error(502)
            return
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            if not _retryable(exc):
                raise
            _cool_down(key, exc)
            # Switching after output begins would splice two different replies together.
            if sent:
                raise
            last_error = exc
    raise last_error


async def complete_chat(messages: list[dict], temperature: float = 0.3, max_tokens: int = 4000,
                        api_key: str | None = None) -> str:
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    payload = {"model": settings.openrouter_model, "messages": messages,
               "temperature": temperature, "max_tokens": max_tokens}
    timeout = httpx.Timeout(connect=10.0, read=240.0, write=30.0, pool=10.0)
    last_error = None
    for key in _available_keys(api_key):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload, headers=_headers(key))
                response.raise_for_status()
                data = _parse(response.text)
                _check_data(data)
                answer = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
                if not answer.strip():
                    raise _error(502)
                return answer
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            if not _retryable(exc):
                raise
            _cool_down(key, exc)
            last_error = exc
    raise last_error
