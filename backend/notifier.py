"""
FanInsights Notifier — Gmail SMTP email sender.

Usage:
    from notifier import send_email, is_configured
    if is_configured():
        send_email("recipient@example.com", "Subject", "<h1>HTML body</h1>")

Credentials are read from backend/.env:
    SENDER_EMAIL    — Gmail address
    SENDER_PASSWORD — 16-char Gmail App Password (not your login password)
                      Enable at: myaccount.google.com/apppasswords

At scale this module would be replaced by SendGrid / Mailchimp / AWS SES
while keeping the same send_email() interface.
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

# ── load .env if present ──────────────────────────────────────────────────────
_ENV_PATH = Path(__file__).parent / ".env"
if _ENV_PATH.exists():
    for _line in _ENV_PATH.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ── constants ─────────────────────────────────────────────────────────────────
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465

SENDER_EMAIL    = os.environ.get("SENDER_EMAIL", "")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "harvinbirk@gmail.com")
DEMO_FAN        = os.environ.get("FANIQ_DEMO_FAN", "Marcus Thompson")
DEMO_TEAM       = os.environ.get("FANIQ_TEAM", "sf49ers")


def is_configured() -> bool:
    """Return True if SMTP credentials are set."""
    return bool(SENDER_EMAIL and SENDER_PASSWORD and "@" in SENDER_EMAIL)


def redact_email(addr: str) -> str:
    """h***@gmail.com style redaction for UI display."""
    if "@" not in addr:
        return addr
    local, domain = addr.split("@", 1)
    return local[0] + "***@" + domain


def send_email(to: str, subject: str, html_body: str, plain_body: Optional[str] = None) -> dict:
    """
    Send an HTML email via Gmail SMTP SSL.
    Returns {"sent": True/False, "error": str|None}.
    """
    if not is_configured():
        return {"sent": False, "error": "SENDER_EMAIL / SENDER_PASSWORD not set in backend/.env"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"FanIQ Platform <{SENDER_EMAIL}>"
    msg["To"]      = to

    if plain_body:
        msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to, msg.as_string())
        return {"sent": True, "error": None}
    except smtplib.SMTPAuthenticationError:
        return {"sent": False, "error": "Authentication failed — check SENDER_PASSWORD is a Gmail App Password, not your login password"}
    except Exception as e:
        return {"sent": False, "error": str(e)}
