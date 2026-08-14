"""Shared rate limiter instance and key function for Bimo."""

from __future__ import annotations

import os

from flask import has_request_context
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .auth import _bearer_token, current_authenticated_user, user_from_token


def rate_limit_key() -> str:
    """Bucket by verified user id. Limiter runs before @require_user, so decode here."""
    if not has_request_context():
        return "ip:127.0.0.1"
    user = current_authenticated_user()
    if not (user and getattr(user, "id", None)):
        token = _bearer_token()
        user = user_from_token(token) if token else None
    if user and getattr(user, "id", None):
        return f"user:{user.id}"
    return f"ip:{get_remote_address()}"


limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["300 per minute"],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
    strategy="fixed-window",
)
