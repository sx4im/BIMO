"""User, profile, usage, and conversation management routes for Bimo."""

from __future__ import annotations

import logging
import os

from flask import Blueprint, jsonify, request

from .. import store
from ..auth import auth_diagnostics, require_user
from ..config import KNOWN_MODEL_IDS, UI_MODELS
from .helpers import bad_request, friendly_error, get_usage_status

logger = logging.getLogger("bimo.routes.user")

user_bp = Blueprint("user_routes", __name__)


# ---------- Profile & Account ----------

@user_bp.get("/me")
@require_user
def me(user):
    profile = None
    try:
        profile = store.upsert_profile(user)
    except Exception:
        pass
    body = user.to_public()
    body["onboarding_seen"] = bool(profile and profile.get("onboarding_seen"))
    body["birthday"] = profile.get("birthday") if profile else None
    body["role"] = profile.get("role") if profile else None
    if os.environ.get("DEBUG_AUTH") == "1":
        body["debug"] = auth_diagnostics()
    return jsonify(body)


@user_bp.post("/onboarding")
@require_user
def onboarding(user):
    data = request.get_json(silent=True) or {}
    birthday = (data.get("birthday") or "").strip() or None
    role = (data.get("role") or "").strip() or None
    try:
        store.set_onboarding(user.id, birthday=birthday, role=role, seen=True)
    except Exception as exc:  # noqa: BLE001
        return bad_request(f"Could not save your responses. {friendly_error(exc)}", 500)
    return jsonify({"status": "ok"})


@user_bp.get("/usage")
@require_user
def usage(user):
    return jsonify(get_usage_status(user.id))


@user_bp.delete("/me")
@require_user
def delete_me(user):
    try:
        store.delete_all_user_data(user.id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("delete_me data wipe failed for user=%s: %s", user.id, exc)
        return bad_request(f"Could not delete account. {friendly_error(exc)}", 500)
    auth_row_deleted = False
    try:
        store.delete_auth_user(user.id)
        auth_row_deleted = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("delete_me admin.delete_user failed for user=%s: %s", user.id, exc)
    return jsonify({"status": "deleted", "auth_row_deleted": auth_row_deleted})


@user_bp.get("/auth-debug")
def auth_debug():
    if os.environ.get("DEBUG_AUTH") != "1":
        return jsonify({"detail": "auth debug disabled"}), 404
    from ..auth import _bearer_token, _decode_with_diagnostics
    token = _bearer_token()
    payload, err = (None, None)
    if token:
        payload, err = _decode_with_diagnostics(token)
    body = auth_diagnostics()
    body["decode_ok"] = bool(payload)
    body["decode_error"] = err
    if payload:
        body["payload_sub"] = payload.get("sub")
        body["payload_aud"] = payload.get("aud")
        body["payload_exp"] = payload.get("exp")
        body["payload_iss"] = payload.get("iss")
    return jsonify(body)


# ---------- Models Catalog ----------

@user_bp.get("/models")
@require_user
def list_models(user):  # noqa: ARG001
    return jsonify({"models": UI_MODELS, "default": "fast"})


# ---------- Conversations ----------

@user_bp.get("/conversations")
@require_user
def list_conversations(user):
    return jsonify(store.list_conversations(user.id))


@user_bp.get("/conversations/<conversation_id>/messages")
@require_user
def conversation_messages(user, conversation_id):
    convo = store.get_conversation(conversation_id, user.id)
    if not convo:
        return bad_request("conversation not found", 404)
    messages = store.get_messages(conversation_id)
    feedback_map = store.message_feedback_map(user.id)
    for m in messages:
        if m["id"] in feedback_map:
            m["feedback"] = feedback_map[m["id"]]
    return jsonify({"conversation": convo, "messages": messages})


@user_bp.delete("/conversations/<conversation_id>")
@require_user
def delete_conversation(user, conversation_id):
    if not store.delete_conversation(conversation_id, user.id):
        return bad_request("conversation not found", 404)
    return jsonify({"status": "deleted"})


@user_bp.patch("/conversations/<conversation_id>")
@require_user
def patch_conversation(user, conversation_id):
    payload = request.get_json(silent=True) or {}
    for key in ("title", "model", "system_prompt"):
        if key in payload and payload[key] is not None and not isinstance(payload[key], str):
            return bad_request(f"{key} must be a string", 422)
    if "pinned" in payload and not isinstance(payload["pinned"], bool):
        return bad_request("pinned must be a boolean", 422)
    if payload.get("model") and payload["model"] not in KNOWN_MODEL_IDS:
        return bad_request("unknown model", 422)
    if payload.get("title") and len(payload["title"]) > 120:
        return bad_request("title too long (max 120 chars)", 422)
    if payload.get("system_prompt") and len(payload["system_prompt"]) > 8000:
        return bad_request("system prompt too long (max 8000 chars)", 422)
    convo = store.update_conversation(conversation_id, user.id, payload)
    if not convo:
        return bad_request("conversation not found", 404)
    return jsonify(convo)
