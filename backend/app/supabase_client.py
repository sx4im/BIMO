"""Server-side Supabase admin client.

Uses the service-role key, so it can bypass RLS to perform DB and Storage
operations on behalf of any authenticated user. JWT verification (auth.py)
ensures the caller is actually who they claim to be before this layer is
reached, and queries are always scoped by `user_id` in store.py.
"""

from __future__ import annotations

import os

# Eagerly import httpcore/httpx so their lazy internal import can't race under
# gunicorn -k gthread cold starts, where a fresh worker building its first
# create_client() crashed with "partially initialized module 'httpcore' has no
# attribute 'ConnectionPool'". Importing here forces them fully loaded at boot.
import httpcore  # noqa: F401
import httpx  # noqa: F401
from supabase import Client, create_client


def attachments_bucket() -> str:
    return os.getenv("SUPABASE_STORAGE_BUCKET", "bimo-attachments")


def is_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables "
            "are required. Set them in backend/.env or your Render dashboard."
        )
    return create_client(url, key)
