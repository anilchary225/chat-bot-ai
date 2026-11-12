"""Reads a business website (a few pages) as plain text for an agent's knowledge base.

Safety: only http/https, never private/loopback/link-local addresses (blocks SSRF into the
server's own network), redirects re-checked hop by hop, size and time limits, robots.txt honoured.
"""
import asyncio
import ipaddress
import logging
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger("zenoxi.webreader")

MAX_PAGES = 8
MAX_BYTES = 1_500_000
MAX_PAGE_CHARS = 20_000
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
USER_AGENT = "ZenoxiAgentBot/1.0 (+https://zenoxi.vercel.app)"
PRIORITY_WORDS = ("about", "service", "pricing", "price", "fees", "course", "product", "menu", "contact",
                  "faq", "policy", "refund", "shipping", "booking", "admission", "team", "location")
SKIP_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf", ".zip", ".mp4", ".mp3", ".css", ".js", ".ico")


class WebReadError(Exception):
    """User-facing problem reading a website."""


def _host_is_public(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise WebReadError("Enter a website address.")
    if "://" in url and not re.match(r"^https?://", url, re.I):
        raise WebReadError("Use a normal website address (http or https).")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise WebReadError("That doesn't look like a website address.")
    return urldefrag(url)[0]


async def _fetch(client: httpx.AsyncClient, url: str) -> tuple[str, str] | None:
    """GET a page safely; returns (final_url, html) or None for non-HTML/blocked pages."""
    for _ in range(4):  # follow up to 3 redirects, checking each hop
        host = urlparse(url).hostname or ""
        if not await asyncio.to_thread(_host_is_public, host):
            raise WebReadError("That address isn't a public website.")
        async with client.stream("GET", url) as response:
            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                url = urljoin(url, response.headers["location"])
                continue
            if response.status_code >= 400:
                return None
            if "html" not in response.headers.get("content-type", "html"):
                return None
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_BYTES:
                    break
                chunks.append(chunk)
            return str(response.url), b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    return None


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template", "iframe", "head"}
    BLOCK = {"p", "div", "section", "article", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "header",
             "footer", "nav", "main", "aside", "table", "ul", "ol", "dd", "dt", "blockquote"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.links, self.title = [], [], ""
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)
        if tag in self.BLOCK:
            self.parts.append("\n")
        if tag in ("h1", "h2", "h3"):
            self.parts.append("## ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if not self._skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"[ \t\r\f\v]+", " ", text)
        text = re.sub(r"\n\s*\n\s*(\n\s*)+", "\n\n", text)
        lines = [line.strip() for line in text.split("\n")]
        return "\n".join(line for line in lines if line and line != "##").strip()


async def _robots(client: httpx.AsyncClient, base: str) -> RobotFileParser:
    parser = RobotFileParser()
    try:
        result = await _fetch(client, urljoin(base, "/robots.txt"))
        parser.parse(result[1].splitlines() if result else [])
    except Exception:
        parser.parse([])
    return parser


def _rank(link: str) -> int:
    path = urlparse(link).path.lower()
    score = sum(5 for word in PRIORITY_WORDS if word in path)
    return -score + path.count("/")


async def read_website(url: str, max_pages: int = MAX_PAGES) -> list[dict]:
    """Return [{"url", "title", "text"}] for the start page and a few important same-site pages."""
    start = normalize_url(url)
    host = urlparse(start).hostname
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": USER_AGENT}) as client:
        robots = await _robots(client, start)
        try:
            first = await _fetch(client, start)
        except httpx.HTTPError as exc:
            raise WebReadError("Couldn't open that website. Check the address and try again.") from exc
        if not first:
            raise WebReadError("Couldn't read that website (it may block bots or not be a normal web page).")
        pages, queue, seen = [], [first], {start, first[0]}
        candidates: list[str] = []
        while queue and len(pages) < max_pages:
            page_url, html = queue.pop(0)
            parser = _TextExtractor()
            try:
                parser.feed(html)
            except Exception:
                continue
            text = parser.text()[:MAX_PAGE_CHARS]
            if len(text) > 80:
                pages.append({"url": page_url, "title": (parser.title or page_url).strip()[:120], "text": text})
            for href in parser.links:
                link = urldefrag(urljoin(page_url, href))[0].rstrip("/")
                parsed = urlparse(link)
                if parsed.scheme in ("http", "https") and parsed.hostname == host and link not in seen \
                        and not parsed.path.lower().endswith(SKIP_EXT) and robots.can_fetch(USER_AGENT, link):
                    seen.add(link)
                    candidates.append(link)
            if not queue and candidates and len(pages) < max_pages:
                candidates.sort(key=_rank)
                batch, candidates = candidates[: max_pages - len(pages)], candidates[max_pages - len(pages):]
                results = await asyncio.gather(*(_fetch(client, link) for link in batch), return_exceptions=True)
                queue.extend(r for r in results if isinstance(r, tuple))
        if not pages:
            raise WebReadError("That website didn't have readable text (it may load everything with JavaScript).")
        return pages
