import httpx
from .config import settings

async def stream_chat(messages: list[dict]):
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key or ''}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zenoxi.vercel.app",
        "X-Title": "Zenoxi",
    }
    payload = {
        "model": settings.openrouter_model,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
    }
    timeout = httpx.Timeout(connect=10.0, read=180.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                import json
                data_line = line[5:].strip()
                if data_line == "[DONE]":
                    break
                data = json.loads(data_line)
                token = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if token:
                    yield token
