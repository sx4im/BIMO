"""WhatsApp Cloud API integration for Bimo.

Provides Webhook endpoints for Meta WhatsApp Cloud API to allow users to chat
directly with Bimo (Aeon 2.0 model) over WhatsApp.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import threading
import requests
from flask import Blueprint, jsonify, request

from . import nvidia_client
from .config import get_stanza_model
from .prompts import WHATSAPP_SYSTEM_PROMPT

logger = logging.getLogger("bimo.whatsapp")

whatsapp_bp = Blueprint("whatsapp", __name__)

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "").strip()
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "").strip()
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "bimo_whatsapp_verify_token_2026").strip()
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "").strip()


def get_graph_url() -> str:
    phone_id = os.getenv("WHATSAPP_PHONE_ID", WHATSAPP_PHONE_ID).strip()
    return f"https://graph.facebook.com/v18.0/{phone_id}/messages"


def is_whatsapp_configured() -> bool:
    token = os.getenv("WHATSAPP_TOKEN", WHATSAPP_TOKEN).strip()
    phone_id = os.getenv("WHATSAPP_PHONE_ID", WHATSAPP_PHONE_ID).strip()
    return bool(token and phone_id)


def verify_meta_signature(raw_payload: bytes, signature_header: str | None) -> bool:
    """Validate Meta's X-Hub-Signature-256 HMAC-SHA256 against WHATSAPP_APP_SECRET."""
    secret = os.getenv("WHATSAPP_APP_SECRET", WHATSAPP_APP_SECRET).strip()
    if not secret:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_sig = signature_header.split("sha256=", 1)[1].strip()
    computed_sig = hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, computed_sig)


def format_for_whatsapp(text: str) -> str:
    """Converts standard Markdown into WhatsApp syntax."""
    if not text:
        return ""
    # Convert markdown links [label](url) to plain URL for WhatsApp native link rendering
    def _clean_link(match: re.Match) -> str:
        label, url = match.group(1).strip(), match.group(2).strip()
        if label == url or label.startswith("http"):
            return url
        return f"{label}: {url}"

    formatted = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _clean_link, text)
    # Convert **bold** to *bold*
    formatted = re.sub(r"\*\*(.*?)\*\*", r"*\1*", formatted)
    # Convert __italic__ to _italic_
    formatted = re.sub(r"__(.*?)__", r"_\1_", formatted)
    return formatted


def send_whatsapp_message(to_phone: str, text: str) -> bool:
    """Sends a text message reply to a WhatsApp user via Meta Graph API."""
    token = os.environ.get("WHATSAPP_TOKEN", WHATSAPP_TOKEN).strip()
    if not token:
        logger.error("Cannot send WhatsApp message: WHATSAPP_TOKEN is missing.")
        return False

    # Clean phone number: Meta API requires digits only without leading '+'
    clean_phone = re.sub(r"\D", "", to_phone)
    if not clean_phone:
        logger.error("Invalid recipient phone number: %s", to_phone)
        return False

    url = get_graph_url()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Split message into chunks if it exceeds WhatsApp's 3900 character limit
    max_len = 3900
    chunks = [text[i:i + max_len] for i in range(0, len(text), max_len)] if text else [""]

    success = True
    for chunk in chunks:
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {"body": chunk},
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code not in (200, 201):
                logger.error("WhatsApp API error (%d) for %s: %s", resp.status_code, clean_phone, resp.text)
                success = False
            else:
                logger.info("Successfully sent WhatsApp reply to %s", clean_phone)
        except Exception as exc:
            logger.exception("Failed to send WhatsApp message to %s: %s", clean_phone, exc)
            success = False
    return success


def _process_and_reply_async(sender_phone: str, user_prompt: str) -> None:
    """Worker function running in a background thread to process the AI model response."""
    try:
        model_id = get_stanza_model()
        messages = [
            {"role": "system", "content": WHATSAPP_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        logger.info("Processing WhatsApp query for %s using Stanza 2.5 model (%s)", sender_phone, model_id)
        
        response_chunks = []
        for chunk in nvidia_client.iter_response_with_fallback(messages, model=model_id, thinking=False):
            chunk_type = chunk.get("type")
            if chunk_type == "delta":
                response_chunks.append(chunk.get("data", ""))
            elif chunk_type == "done" and not response_chunks:
                response_chunks.append(chunk.get("content", ""))

        raw_reply = "".join(response_chunks).strip()
        if not raw_reply:
            raw_reply = "I received your message! How can I help you today?"

        formatted_reply = format_for_whatsapp(raw_reply)
        send_whatsapp_message(sender_phone, formatted_reply)
    except Exception as exc:
        logger.exception("Error processing WhatsApp message for %s: %s", sender_phone, exc)
        send_whatsapp_message(
            sender_phone,
            "Sorry, Bimo encountered an issue while generating a response. Please try again in a moment."
        )


# ---------- Flask Routes ----------

@whatsapp_bp.get("/api/whatsapp/webhook")
def verify_webhook():
    """Meta Webhook verification handshake (GET)."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    expected_verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", WHATSAPP_VERIFY_TOKEN).strip()

    if mode == "subscribe" and token == expected_verify_token:
        logger.info("WhatsApp webhook verified successfully!")
        return challenge, 200

    logger.warning("WhatsApp webhook verification failed. Token mismatch or invalid mode.")
    return jsonify({"error": "Verification token mismatch"}), 403


@whatsapp_bp.post("/api/whatsapp/webhook")
def handle_incoming_message():
    """Receives incoming message events from Meta (POST) with HMAC-SHA256 signature verification."""
    raw_data = request.get_data()
    sig_header = request.headers.get("X-Hub-Signature-256")
    if not verify_meta_signature(raw_data, sig_header):
        logger.warning("Rejected WhatsApp webhook POST with invalid X-Hub-Signature-256 signature.")
        return jsonify({"error": "Invalid signature"}), 403

    data = request.get_json(silent=True) or {}
    
    # Meta webhook payloads contain an 'entry' array
    entries = data.get("entry", [])
    if not entries:
        return jsonify({"status": "ignored"}), 200

    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])

            for msg in messages:
                sender_phone = msg.get("from")
                msg_type = msg.get("type")

                if not sender_phone:
                    continue

                if msg_type == "text":
                    body = msg.get("text", {}).get("body", "").strip()
                    if body:
                        logger.info("Received WhatsApp message from %s: '%s'", sender_phone, body)
                        # Spawn background thread so Webhook responds 200 OK immediately to Meta
                        threading.Thread(
                            target=_process_and_reply_async,
                            args=(sender_phone, body),
                            daemon=True,
                        ).start()

    return jsonify({"status": "received"}), 200
