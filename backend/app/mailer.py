"""Sends verification-code emails.

Order of preference:
  1. Brevo HTTP API (BREVO_API_KEY): free tier, works on hosts that block SMTP ports.
  2. SMTP (SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD), e.g. Gmail with an app password.
  3. Nothing configured: the code is written to the server log (local development only).
"""
import asyncio
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from string import Template
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from .config import settings

logger = logging.getLogger("zenoxi.mail")


class MailError(Exception):
    pass


TEMPLATES = Path(__file__).parent / "templates"
COPY = {
    "signup": ("Confirm your email", "Welcome to Zenoxi! Enter this code to finish creating your account."),
    "signin": ("Your sign-in code", "Enter this code to sign in to Zenoxi."),
}
CODE_MINUTES = 10


def _box(digit: str) -> str:
    return (
        '<td style="padding:0 4px;"><div style="width:44px;height:54px;line-height:54px;text-align:center;'
        "background:#faf7f2;border:1.5px solid #f3c7a6;border-radius:12px;font-family:Menlo,Consolas,monospace;"
        f'font-size:26px;font-weight:700;color:#1c1714;">{digit}</div></td>'
    )


def _content(code: str, purpose: str, to: str = "", name: str = "") -> tuple[str, str, str]:
    """Render templates/verification.html and .txt ($placeholders, string.Template)."""
    title, intro = COPY.get(purpose, COPY["signin"])
    subject = f"{code} is your Zenoxi {'sign-up' if purpose == 'signup' else 'sign-in'} code"
    app_url = settings.public_frontend_url.rstrip("/")
    first = (name or "").strip().split(" ")[0]
    values = {
        "subject": subject,
        "title": title,
        "intro": intro,
        "greeting": f"Hi {first}," if first else "Hi,",
        "code": code,
        "minutes": CODE_MINUTES,
        "app_url": app_url,
        "app_host": app_url.split("://", 1)[-1],
        "logo_url": f"{app_url}/zenoxi-logo.png",
        "email": to,
        "year": datetime.now(timezone.utc).year,
        "preheader": f"Your Zenoxi code is {code}. It expires in {CODE_MINUTES} minutes.",
    }
    safe = {k: escape(str(v)) for k, v in values.items()}  # HTML-escape user-provided text
    safe["code_boxes"] = "".join(_box(d) for d in code)
    html = Template((TEMPLATES / "verification.html").read_text(encoding="utf-8")).safe_substitute(safe)
    text = Template((TEMPLATES / "verification.txt").read_text(encoding="utf-8")).safe_substitute(values)
    return subject, text, html


async def _brevo(to: str, subject: str, text: str, html: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
            json={
                "sender": {"name": settings.mail_from_name, "email": settings.mail_from},
                "to": [{"email": to}],
                "subject": subject,
                "textContent": text,
                "htmlContent": html,
            },
        )
        if response.status_code >= 400:
            logger.error("Brevo rejected the email: %s %s", response.status_code, response.text[:300])
            raise MailError("The email service rejected the message.")


def _smtp(to: str, subject: str, text: str, html: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.mail_from_name, settings.mail_from or settings.smtp_username))
    message["To"] = to
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    context = ssl.create_default_context()
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, 465, context=context, timeout=20) as server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            server.starttls(context=context)
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)


def mail_configured() -> bool:
    return bool((settings.brevo_api_key and settings.mail_from) or (settings.smtp_host and settings.smtp_username and settings.smtp_password))


async def send_code(to: str, code: str, purpose: str, name: str = "") -> None:
    subject, text, html = _content(code, purpose, to, name)
    if settings.brevo_api_key and settings.mail_from:
        await _brevo(to, subject, text, html)
    elif settings.smtp_host and settings.smtp_username and settings.smtp_password:
        try:
            await asyncio.to_thread(_smtp, to, subject, text, html)
        except Exception as exc:
            logger.exception("SMTP send failed")
            raise MailError("Couldn't send the email.") from exc
    else:
        # Development fallback: no email service configured.
        logger.warning("No email service configured. Verification code for %s: %s", to, code)
