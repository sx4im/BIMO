"""Bimo data layer — wraps the Supabase Postgres tables.

Every helper that mutates data scopes by ``user_id`` even though the gateway
already verifies the JWT, so a leaked token can never reach another user's
rows. Using the service-role client (see ``supabase_client.py``) lets us
update timestamps and run cross-row reports without RLS friction.
"""

from __future__ import annotations

import logging
import secrets
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from .supabase_client import attachments_bucket, supabase

logger = logging.getLogger("bimo.store")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- profiles ----------

def upsert_profile(user) -> dict:
    payload = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "provider": user.provider,
        "updated_at": _now_iso(),
    }
    res = supabase().table("profiles").upsert(payload, on_conflict="id").execute()
    return (res.data or [payload])[0]


def get_profile(user_id: str) -> Optional[dict]:
    res = (
        supabase()
        .table("profiles")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def set_onboarding(user_id: str, *, birthday=None, role=None, seen: bool = True) -> None:
    """Persist the "What's new in Bimo 5" survey answers + mark it seen so the
    modal never re-appears. birthday/role are optional (the user can skip or
    dismiss with "Not now"); only non-empty values are written."""
    payload = {"onboarding_seen": seen, "updated_at": _now_iso()}
    if birthday:
        payload["birthday"] = birthday
    if role:
        payload["role"] = role
    supabase().table("profiles").update(payload).eq("id", user_id).execute()


# ---------- conversations ----------

def list_conversations(user_id: str, *, limit: int = 100) -> list[dict]:
    res = (
        supabase()
        .table("conversations")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    pinned = sorted(
        [c for c in rows if c.get("pinned")],
        key=lambda c: c.get("updated_at") or "",
        reverse=True,
    )
    rest = sorted(
        [c for c in rows if not c.get("pinned")],
        key=lambda c: c.get("updated_at") or "",
        reverse=True,
    )
    return pinned + rest


def get_conversation(conversation_id: str, user_id: str) -> Optional[dict]:
    res = (
        supabase()
        .table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def create_conversation(
    user_id: str,
    *,
    first_message: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> dict:
    title = (first_message or "New conversation").strip().replace("\n", " ")[:80] or "New conversation"
    payload = {
        "user_id": user_id,
        "title": title,
        "model": model,
        "system_prompt": system_prompt,
    }
    res = supabase().table("conversations").insert(payload).execute()
    if not res.data:
        raise RuntimeError("Could not create conversation")
    return res.data[0]


def update_conversation(conversation_id: str, user_id: str, patch: dict) -> Optional[dict]:
    allowed = {k: v for k, v in patch.items() if k in {"title", "model", "system_prompt", "pinned"}}
    if not allowed:
        return get_conversation(conversation_id, user_id)
    allowed["updated_at"] = _now_iso()
    res = (
        supabase()
        .table("conversations")
        .update(allowed)
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    return (res.data or [None])[0]


def touch_conversation(conversation_id: str, user_id: str) -> None:
    supabase().table("conversations").update({"updated_at": _now_iso()}).eq(
        "id", conversation_id
    ).eq("user_id", user_id).execute()


def _attachment_paths(messages: list) -> list[str]:
    """Extract storage paths from message attachment JSONB."""
    paths = []
    for msg in messages:
        for a in msg.get("attachments") or []:
            if isinstance(a, dict) and a.get("path"):
                paths.append(a["path"])
    return paths


def _delete_storage_paths(paths: list[str]) -> None:
    """Best-effort removal from Supabase Storage."""
    if not paths:
        return
    bucket = attachments_bucket()
    try:
        supabase().storage.from_(bucket).remove(paths)
    except Exception:
        logger.warning("storage cleanup failed for %d paths", len(paths), exc_info=True)


def delete_conversation(conversation_id: str, user_id: str) -> bool:
    # SECURITY: verify ownership BEFORE any destructive work. get_messages()
    # is not user-scoped, so without this check a caller could pass another
    # user's conversation id and have that user's attachment files deleted
    # from Storage even though the row delete below would no-op.
    if not get_conversation(conversation_id, user_id):
        return False

    # Clean up attachment files from Supabase Storage before deleting the
    # conversation (messages cascade to messages, but storage objects
    # do not auto-delete on Postgres FK cascade).
    msgs = get_messages(conversation_id)
    paths = _attachment_paths(msgs)
    _delete_storage_paths(paths)

    res = (
        supabase()
        .table("conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


# ---------- messages ----------

def get_messages(conversation_id: str, *, limit: int = 200) -> list[dict]:
    res = (
        supabase()
        .table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return res.data or []


def add_message(
    conversation_id: str,
    user_id: str,
    *,
    role: str,
    content: str,
    attachments: Optional[list] = None,
    reasoning: Optional[str] = None,
) -> dict:
    if not get_conversation(conversation_id, user_id):
        raise PermissionError("conversation not found")
    payload = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "attachments": attachments,
    }
    if reasoning:
        payload["reasoning"] = reasoning
    try:
        res = supabase().table("messages").insert(payload).execute()
    except Exception:
        # If the insert failed because the reasoning column doesn't exist
        # (e.g., migration not yet run), retry without it so the message
        # is not lost.
        if reasoning and "reasoning" in payload:
            payload.pop("reasoning")
            res = supabase().table("messages").insert(payload).execute()
        else:
            raise
    if not res.data:
        raise RuntimeError("Could not insert message")
    msg = res.data[0]
    touch_conversation(conversation_id, user_id)
    return msg


def message_belongs_to_user(message_id: str, user_id: str) -> bool:
    msg = (
        supabase()
        .table("messages")
        .select("conversation_id")
        .eq("id", message_id)
        .limit(1)
        .execute()
    )
    row = (msg.data or [None])[0]
    if not row:
        return False
    convo = get_conversation(row["conversation_id"], user_id)
    return convo is not None


# ---------- feedback ----------

def upsert_feedback(
    user_id: str,
    message_id: str,
    *,
    rating: int,
    correctness: str,
    length: str,
) -> dict:
    existing = (
        supabase()
        .table("feedback")
        .select("id")
        .eq("user_id", user_id)
        .eq("message_id", message_id)
        .limit(1)
        .execute()
    )
    payload = {
        "user_id": user_id,
        "message_id": message_id,
        "rating": rating,
        "correctness": correctness,
        "length": length,
        "updated_at": _now_iso(),
    }
    if existing.data:
        res = (
            supabase()
            .table("feedback")
            .update(payload)
            .eq("id", existing.data[0]["id"])
            .execute()
        )
        return (res.data or [payload])[0]
    res = supabase().table("feedback").insert(payload).execute()
    return (res.data or [payload])[0]


def user_feedback(user_id: str) -> list[dict]:
    res = supabase().table("feedback").select("*").eq("user_id", user_id).execute()
    return res.data or []


def message_feedback_map(user_id: str) -> dict[str, dict]:
    return {row["message_id"]: row for row in user_feedback(user_id)}


# ---------- usage metering ----------

def record_usage(user_id: str, model: str, tokens: int) -> None:
    """Log one completed turn's token use. Best-effort — never raise, because
    metering must not break a chat reply that already streamed to the user."""
    try:
        supabase().table("usage_events").insert(
            {"user_id": user_id, "model": model, "tokens": int(max(0, tokens))}
        ).execute()
    except Exception:
        logger.warning("record_usage failed for user=%s", user_id, exc_info=True)


def recent_usage_events(user_id: str, since_iso: str) -> list[dict]:
    """All of a user's usage rows since ``since_iso`` (the widest window we
    report). The gateway slices the shorter session window in Python."""
    res = (
        supabase()
        .table("usage_events")
        .select("model,tokens,created_at")
        .eq("user_id", user_id)
        .gte("created_at", since_iso)
        .execute()
    )
    return res.data or []


# ---------- analytics ----------

def analytics_summary(user_id: str) -> dict:
    sb = supabase()
    convos = (
        sb.table("conversations")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    convo_count = convos.count or 0
    convo_ids = [c["id"] for c in (convos.data or [])]
    if convo_ids:
        msgs = (
            sb.table("messages")
            .select("id", count="exact")
            .in_("conversation_id", convo_ids)
            .execute()
        )
        msg_count = msgs.count or 0
    else:
        msg_count = 0

    feedback_rows = user_feedback(user_id)
    ratings = [r["rating"] for r in feedback_rows]
    return {
        "conversations": convo_count,
        "messages": msg_count,
        "feedback_count": len(feedback_rows),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
        "correctness": dict(Counter(r["correctness"] for r in feedback_rows)),
        "length": dict(Counter(r["length"] for r in feedback_rows)),
        "rating_distribution": dict(Counter(ratings)),
    }


def all_feedback_dataframe_rows(user_id: Optional[str] = None) -> list[dict]:
    query = supabase().table("feedback").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    res = query.execute()
    return res.data or []


# ---------- account deletion ----------

def delete_all_user_data(user_id: str) -> None:
    """Wipe every row this user owns. Messages cascade with conversations
    via the FK in 0001_init.sql; feedback and profile go separately.
    Storage objects are cleaned up explicitly since there is no FK
    cascade from Postgres to Supabase Storage.
    """
    sb = supabase()

    # 1) Collect attachment paths from all user messages before anything
    # is deleted. We have to walk conversations because messages have no
    # user_id column.
    convos = sb.table("conversations").select("id").eq("user_id", user_id).execute()
    all_paths: list[str] = []
    for row in convos.data or []:
        msgs = get_messages(row["id"])
        all_paths.extend(_attachment_paths(msgs))
    _delete_storage_paths(all_paths)

    # 2) Conversations -> cascades to messages (FK on delete cascade)
    sb.table("conversations").delete().eq("user_id", user_id).execute()
    # 3) Feedback (in case any orphaned rows survived the cascade)
    sb.table("feedback").delete().eq("user_id", user_id).execute()
    # 4) Usage events (FK is on auth.users, so they outlive a data-only wipe)
    sb.table("usage_events").delete().eq("user_id", user_id).execute()
    # 5) Profile row
    sb.table("profiles").delete().eq("id", user_id).execute()


def delete_auth_user(user_id: str) -> None:
    """Delete the auth.users row via the service-role admin API.

    Raises if the configured key isn't admin-capable. Caller should treat
    this as best-effort: data is already gone by the time we reach here.
    """
    supabase().auth.admin.delete_user(user_id)


# ---------- storage / attachments ----------

def download_attachment(path: str, user_id: str) -> bytes:
    """Pull an attachment's raw bytes back out of Supabase Storage.

    Used by /chat to inline images as base64 so NVIDIA's vision model
    doesn't have to fetch our signed URL from its own outbound network.
    Always requires user_id and rejects paths outside that user's prefix.
    """
    if not isinstance(path, str) or not path:
        raise ValueError("Invalid attachment path")
    if not isinstance(user_id, str) or not user_id:
        raise PermissionError("user_id required")
    if ".." in path or path.startswith("/") or "\\" in path:
        raise PermissionError("Path traversal rejected")
    if not path.startswith(f"{user_id}/"):
        raise PermissionError(f"User {user_id} does not own attachment path: {path}")
    return supabase().storage.from_(attachments_bucket()).download(path)



def upload_attachment_for_user(
    user_id: str,
    *,
    filename: str,
    file_bytes: bytes,
    content_type: str,
    expires_in: int = 60 * 60,
) -> dict:
    """Upload to Supabase Storage and return a fresh signed URL.

    Files live under ``<user_id>/<random>/<filename>`` so the storage RLS
    policy in 0001_init.sql can scope them to their owner. ``expires_in`` is the
    signed-URL lifetime in seconds (default 1 hour; generated images pass a much
    longer TTL so they stay viewable well beyond the active session).
    """
    bucket = attachments_bucket()
    safe_name = filename.replace("\\", "_").split("/")[-1] or "file"
    path = f"{user_id}/{secrets.token_hex(8)}/{safe_name}"
    sb = supabase()
    sb.storage.from_(bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "false"},
    )
    signed = sb.storage.from_(bucket).create_signed_url(path, expires_in)
    if isinstance(signed, dict):
        url = signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")
    else:
        url = getattr(signed, "signed_url", None) or getattr(signed, "signedURL", None)
    if not url:
        # Different supabase-py versions return the signed URL under different
        # keys; if we still have nothing, log the shape so we can add the new
        # key. Without a URL the vision model will silently receive no image.
        logger.error(
            "create_signed_url returned no usable URL: type=%s repr=%r",
            type(signed).__name__, signed,
        )
    return {
        "path": path,
        "url": url,
        "content_type": content_type,
        "size": len(file_bytes),
        "filename": safe_name,
    }
