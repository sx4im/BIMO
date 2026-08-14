"""Media, image generation, attachment uploads, voice transcription, TTS, and web search routes."""

from __future__ import annotations

import logging
import os
import re
import time

import requests
from flask import Blueprint, Response, jsonify, request

from .. import image_safety, nvidia_client, riva_transcribe, riva_tts, store
from ..auth import require_user
from ..config import (
    IMAGE_MODEL_ID,
    IMAGE_USAGE_TOKENS,
    WHISPER_MODEL,
    upload_magic_ok,
    upload_type_allowed,
)
from ..limiter import limiter
from .helpers import bad_request, friendly_error

logger = logging.getLogger("bimo.routes.media")

media_bp = Blueprint("media_routes", __name__)


def _rest_transcription_provider():
    base = os.getenv("TRANSCRIBE_BASE_URL")
    key = os.getenv("TRANSCRIBE_API_KEY")
    if base and key:
        return base.rstrip("/"), key, WHISPER_MODEL
    groq = os.getenv("GROQ_API_KEY")
    if groq:
        return "https://api.groq.com/openai/v1", groq, "whisper-large-v3"
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return "https://api.openai.com/v1", openai_key, "whisper-1"
    return None, None, None


# ---------- Image Generation (Iris) ----------

@media_bp.post("/images/generate")
@limiter.limit("10 per minute")
@require_user
def generate_image_route(user):
    payload = request.get_json(silent=True) or {}
    prompt = payload.get("prompt")
    conversation_id = payload.get("conversation_id")
    attachments = payload.get("attachments") or []

    if not isinstance(prompt, str) or not prompt.strip():
        return bad_request("prompt is required", 422)
    prompt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", prompt).strip()
    if not prompt:
        return bad_request("prompt is required", 422)
    if len(prompt) > 2000:
        return bad_request("prompt too long (max 2000 chars)", 422)
    if not isinstance(attachments, list) or not all(isinstance(a, dict) for a in attachments):
        return bad_request("attachments must be a list", 422)
    if conversation_id is not None and not isinstance(conversation_id, str):
        return bad_request("conversation_id must be a string", 422)

    refusal = image_safety.check_prompt(prompt)

    try:
        if conversation_id:
            convo = store.get_conversation(conversation_id, user.id)
            if not convo:
                return bad_request("conversation not found", 404)
            if convo.get("model") != IMAGE_MODEL_ID:
                convo = store.update_conversation(
                    conversation_id, user.id, {"model": IMAGE_MODEL_ID}
                ) or convo
        else:
            convo = store.create_conversation(
                user.id, first_message=prompt, model=IMAGE_MODEL_ID
            )
        user_message = store.add_message(
            convo["id"], user.id, role="user", content=prompt,
            attachments=attachments or None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("images: persistence failed for user=%s: %s", user.id, exc)
        return bad_request(f"Could not save conversation. {friendly_error(exc)}", 500)

    if refusal:
        logger.info("images: blocked unsafe prompt user=%s convo=%s", user.id, convo.get("id"))
        assistant_message = store.add_message(
            convo["id"], user.id, role="assistant", content=refusal,
        )
        return jsonify({
            "conversation": store.get_conversation(convo["id"], user.id) or convo,
            "user_message": user_message,
            "assistant_message": assistant_message,
            "blocked": True,
        })

    try:
        chosen_model = nvidia_client.image_model()
        t_img = time.time()
        png = nvidia_client.generate_image(prompt, model=chosen_model)
        logger.info(
            "images: generated user=%s convo=%s model=%s bytes=%d in %.2fs",
            user.id, convo.get("id"), chosen_model, len(png), time.time() - t_img,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("images: generation failed user=%s: %s", user.id, exc)
        return bad_request(f"Image generation failed. {friendly_error(exc)}", 502)

    try:
        slug = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")[:40] or "image"
        attachment = store.upload_attachment_for_user(
            user.id,
            filename=f"{slug}.png",
            file_bytes=png,
            content_type="image/png",
            expires_in=7 * 24 * 3600,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("images: could not store generated image user=%s: %s", user.id, exc)
        return bad_request(f"Could not save the generated image. {friendly_error(exc)}", 500)

    assistant_message = store.add_message(
        convo["id"], user.id, role="assistant", content="Here's your image.",
        attachments=[attachment],
    )
    try:
        store.record_usage(user.id, "image", IMAGE_USAGE_TOKENS)
    except Exception:
        logger.exception("images: usage recording failed user=%s", user.id)

    return jsonify({
        "conversation": store.get_conversation(convo["id"], user.id) or convo,
        "user_message": user_message,
        "assistant_message": assistant_message,
    })


# ---------- Attachments Upload ----------

@media_bp.post("/attachments")
@limiter.limit("30 per minute")
@require_user
def upload_attachment(user):
    if "file" not in request.files:
        return bad_request("file is required", 422)
    f = request.files["file"]
    if not upload_type_allowed(f.filename or "", f.mimetype or ""):
        return bad_request("unsupported file type", 422)
    data = f.read()
    if not data:
        return bad_request("empty file", 422)
    if len(data) > 50 * 1024 * 1024:
        return bad_request("max attachment size is 50 MB", 413)
    if not upload_magic_ok(data):
        return bad_request("file content does not match a supported type", 422)
    try:
        attachment = store.upload_attachment_for_user(
            user.id,
            filename=f.filename or "file",
            file_bytes=data,
            content_type=f.mimetype or "application/octet-stream",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("attachment upload failed: %s", exc)
        return bad_request("upload failed", 500)
    return jsonify(attachment)


# ---------- Voice Transcription (Whisper / Riva) ----------

@media_bp.post("/transcribe")
@limiter.limit("20 per minute")
@require_user
def transcribe(user):  # noqa: ARG001
    if "audio" not in request.files:
        return bad_request("audio file is required", 422)
    audio_file = request.files["audio"]
    audio_bytes = audio_file.read()
    if not audio_bytes:
        return bad_request("empty audio file", 422)
    if len(audio_bytes) > 25 * 1024 * 1024:
        return bad_request("audio file too large (max 25 MB)", 413)
    _audio_ok = (
        (audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE")
        or audio_bytes[:4] == b"\x1aE\xdf\xa3"
        or audio_bytes[:4] == b"OggS"
        or audio_bytes[:3] == b"ID3"
        or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
        or audio_bytes[4:8] == b"ftyp"
    )
    if not _audio_ok:
        return bad_request("unsupported audio format", 422)

    language = (request.form.get("language") or "en").strip() or "en"

    if riva_transcribe.riva_available():
        try:
            text = riva_transcribe.transcribe_wav(audio_bytes, language)
            return jsonify({"text": text})
        except Exception as exc:  # noqa: BLE001
            logger.warning("Riva transcription failed, trying REST fallback: %s", exc)

    base_url, api_key, model = _rest_transcription_provider()
    if not base_url:
        if os.getenv("NVIDIA_API_KEY"):
            return bad_request(
                "Voice transcription via NVIDIA Riva failed. Check server logs or set GROQ_API_KEY.",
                502,
            )
        return bad_request("Server-side voice transcription is not configured.", 503)

    try:
        resp = requests.post(
            f"{base_url}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (audio_file.filename or "recording.wav", audio_bytes, audio_file.content_type or "audio/wav")},
            data={"model": model, "response_format": "json"},
            timeout=60,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("transcription request failed: %s", exc)
        return bad_request("transcription request failed", 502)

    if not resp.ok:
        return bad_request(f"transcription failed ({resp.status_code})", 502)
    try:
        text = (resp.json().get("text") or "").strip()
    except Exception:
        return bad_request("invalid transcription response", 502)
    return jsonify({"text": text})


# ---------- Text-to-Speech (Riva) ----------

@media_bp.post("/tts")
@limiter.limit("90 per minute")
@require_user
def tts(user):  # noqa: ARG001
    payload = request.get_json(silent=True) or {}
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return bad_request("text is required", 422)
    text = text.strip()
    if len(text) > 4000:
        return bad_request("text too long (max 4000 chars)", 422)
    if not riva_tts.tts_available():
        return bad_request(
            "Text-to-speech is not configured. Set NVIDIA_API_KEY and ensure nvidia-riva-client is installed.",
            503,
        )
    voice = payload.get("voice")
    language = payload.get("language")
    if voice is not None and (not isinstance(voice, str) or len(voice) > 80):
        return bad_request("invalid voice", 422)
    if language is not None and (not isinstance(language, str) or len(language) > 20):
        return bad_request("invalid language", 422)
    try:
        wav = riva_tts.synthesize_wav(text, voice=voice, language=language)
        return Response(wav, mimetype="audio/wav")
    except Exception as exc:  # noqa: BLE001
        logger.warning("TTS failed: %s", exc)
        return bad_request(f"TTS failed: {exc}", 502)


# ---------- Web Search (Tavily) ----------

@media_bp.post("/search")
@limiter.limit("20 per minute")
@require_user
def search(user):  # noqa: ARG001
    payload = request.get_json(silent=True) or {}
    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        return bad_request("query is required", 422)
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return bad_request("web search is not configured", 503)

    q = query.strip()
    lower_q = q.lower()
    is_live = any(
        kw in lower_q for kw in (
            "live", "score", "right now", "now", "today", "tonight",
            "latest", "current", "currently", "this morning", "this evening",
            "breaking", "update", "price", "stock", "weather",
        )
    )
    body = {
        "api_key": api_key,
        "query": q,
        "search_depth": "advanced",
        "max_results": 8 if is_live else 5,
        "include_answer": "advanced",
    }
    if is_live:
        body["topic"] = "news"
        body["days"] = 1
        body["time_range"] = "day"

    def _tavily(p):
        resp = requests.post("https://api.tavily.com/search", json=p, timeout=12)
        resp.raise_for_status()
        return resp.json()

    plain_body = {
        "api_key": api_key,
        "query": q,
        "search_depth": "advanced",
        "max_results": 8,
        "include_answer": "advanced",
    }
    try:
        data = _tavily(body)
        if is_live and not (data.get("results") or []):
            data = _tavily(plain_body)
    except requests.RequestException as exc:
        logger.warning("search: Tavily request failed: %s", exc)
        if is_live and body != plain_body:
            try:
                data = _tavily(plain_body)
            except requests.RequestException as exc2:
                logger.warning("search: Tavily retry failed: %s", exc2)
                return bad_request("web search failed", 502)
        else:
            return bad_request("web search failed", 502)

    results = data.get("results") or []
    top = [
        {
            "title": r.get("title", ""),
            "content": r.get("content", ""),
            "url": r.get("url", ""),
            "published_date": r.get("published_date", ""),
        }
        for r in results[:8]
    ]
    return jsonify({"answer": data.get("answer", ""), "results": top, "live": is_live})
