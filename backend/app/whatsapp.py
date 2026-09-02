"""WhatsApp Cloud API integration for Bimo.

Provides Webhook endpoints for Meta WhatsApp Cloud API to allow users to chat
directly with Bimo (Stanza 2.5 model) over WhatsApp.
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
from typing import Optional

from openai import OpenAI

from . import nvidia_client
from .config import DEFAULT_GROQ_BASE_URL, get_aeon_model, get_stanza_model
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


def verify_meta_signature(raw_payload: bytes, signature_header: Optional[str]) -> bool:
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
    """Format markdown reply for clean display on WhatsApp."""
    if not text:
        return ""
    # Strip markdown headings e.g. '### Heading' -> '*Heading*'
    text = re.sub(r"^#{1,6}\s*(.+)$", r"*\1*", text, flags=re.MULTILINE)
    # Strip code block backticks if any
    text = re.sub(r"```[a-zA-Z]*\n([\s\S]*?)\n```", r"```\n\1\n```", text)
    # Clean up double blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def send_whatsapp_message(to_phone: str, message_text: str) -> bool:
    """Send an outbound text message via Meta Graph API."""
    token = os.getenv("WHATSAPP_TOKEN", WHATSAPP_TOKEN).strip()
    url = get_graph_url()

    if not token or not url:
        logger.warning("WhatsApp message not sent: WHATSAPP_TOKEN or WHATSAPP_PHONE_ID is not configured.")
        return False

    clean_phone = re.sub(r"[^\d]", "", to_phone)
    if not clean_phone:
        logger.error("Invalid recipient phone number: %s", to_phone)
        return False

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Split into multiple messages if length exceeds WhatsApp 4096 char limit
    chunks = [message_text[i:i + 4000] for i in range(0, len(message_text), 4000)] or [message_text]
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


def _generate_groq_reply(model_id: str, messages: list[dict], groq_key: str) -> str:
    """Generate a chat completion using Groq's low-latency API."""
    base_url = os.getenv("GROQ_BASE_URL", DEFAULT_GROQ_BASE_URL).strip()
    client = OpenAI(api_key=groq_key, base_url=base_url, timeout=20.0)
    resp = client.chat.completions.create(
        model=model_id,
        messages=messages,
        max_tokens=400,
        temperature=0.7,
    )
    if resp.choices and resp.choices[0].message:
        return resp.choices[0].message.content or ""
    return ""


def _process_and_reply_async(sender_phone: str, user_prompt: str) -> None:
    """Worker function running in a background thread to process the AI model response."""
    try:
        model_id = get_aeon_model()
        messages = [
            {"role": "system", "content": WHATSAPP_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        logger.info("Processing WhatsApp query for %s using Aeon model (%s)", sender_phone, model_id)

        raw_reply = ""
        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        if groq_key:
            try:
                logger.info("Executing Groq chat completion for WhatsApp (%s)", model_id)
                raw_reply = _generate_groq_reply(model_id, messages, groq_key)
                if raw_reply:
                    logger.info("Successfully generated reply via Groq (%d chars)", len(raw_reply))
            except Exception as exc:
                logger.warning("Groq inference failed for WhatsApp (%s), falling back to NVIDIA: %s", model_id, exc)
        else:
            logger.info("GROQ_API_KEY not set, falling back to NVIDIA for WhatsApp")

        if not raw_reply:
            response_chunks = []
            for chunk in nvidia_client.iter_response_with_fallback(
                messages,
                model=model_id,
                thinking=False,
                max_tokens=400,
            ):
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
