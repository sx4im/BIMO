"""Central configuration and constants for Bimo.

Holds internal model mappings, quotas, upload allowlists, and environment
defaults. Eliminates circular imports across gateways and client wrappers.
"""

from __future__ import annotations

import os

# Default foundation models
DEFAULT_STANZA_MODEL = "meta/muse-glimmer-30b"
DEFAULT_NEXOS_MODEL = "thinkingmachines/inkling"
DEFAULT_VISION_MODEL = "google/diffusiongemma-26b-a4b-it"
DEFAULT_AEON_MODEL = "google/diffusiongemma-26b-a4b-it"
DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.2-klein-4b"
DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_IMAGE_BASE_URL = "https://ai.api.nvidia.com/v1/genai"
DEFAULT_MODEL = "meta/muse-glimmer-30b"

# Internal model catalog
IMAGE_MODEL_ID = "image"
AEON_MODEL_ID = "aeon"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "openai/whisper-large-v3")


def get_stanza_model() -> str:
    return os.getenv("NVIDIA_STANZA_MODEL", DEFAULT_STANZA_MODEL).strip()


def get_nexos_model() -> str:
    return os.getenv("NVIDIA_NEXOS_MODEL", DEFAULT_NEXOS_MODEL).strip()


def get_vision_model() -> str:
    return os.getenv("NVIDIA_VISION_MODEL", DEFAULT_VISION_MODEL).strip()


def get_aeon_model() -> str:
    return os.getenv("NVIDIA_AEON_MODEL", DEFAULT_AEON_MODEL).strip()


def get_internal_models() -> list[dict]:
    return [
        {"id": "thinking", "label": "Stanza 2.5", "real_id": get_stanza_model()},
        {"id": "deep", "label": "Nexos 3.0", "real_id": get_nexos_model()},
        {"id": "aeon", "label": "Aeon Voice", "real_id": get_aeon_model()},
    ]


def get_real_id_map() -> dict[str, str]:
    return {m["id"]: m["real_id"] for m in get_internal_models()}


def get_known_model_ids() -> set[str]:
    # Returns the set of models shown in UI catalog
    return {"thinking", "deep", IMAGE_MODEL_ID}


def get_all_valid_model_ids() -> set[str]:
    # Returns all valid models accepted by the server
    return set(get_real_id_map().keys()) | {IMAGE_MODEL_ID}


# Module-level aliases
_INTERNAL_MODELS = get_internal_models()
REAL_ID_MAP = get_real_id_map()
KNOWN_MODEL_IDS = get_known_model_ids()
ALL_VALID_MODEL_IDS = get_all_valid_model_ids()
VISION_MODEL = DEFAULT_VISION_MODEL

# Frontend presentation catalog (Aeon is excluded from UI dropdown)
UI_MODELS = [
    {"id": "thinking", "label": "Stanza 2.5", "description": "All-round help"},
    {"id": "deep", "label": "Nexos 3.0", "description": "Deep reasoning", "note": "This may take longer than usual."},
    {"id": "image", "label": "Iris 1.0", "description": "Image generation", "kind": "image"},
]

# Usage limits and quotas
USAGE_WEIGHTS = {"thinking": 1.0, "deep": 5.0, "image": 5.0, "aeon": 1.0}
IMAGE_USAGE_TOKENS = 1500
SESSION_WINDOW_S = 5 * 3600
WEEKLY_WINDOW_S = 7 * 24 * 3600
SESSION_LIMIT = 100_000     # weighted tokens / 5h
WEEKLY_LIMIT = 1_000_000    # weighted tokens / week

# Upload allowlists
ALLOWED_UPLOAD_EXTS = {
    "png", "jpg", "jpeg", "gif", "webp", "bmp",
    "pdf", "docx", "xlsx", "pptx", "zip",
}
ALLOWED_UPLOAD_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
}

# Magic-byte signatures for uploads
MAGIC_SIGNATURES = (
    b"\x89PNG\r\n\x1a\n",   # png
    b"\xff\xd8\xff",         # jpeg
    b"GIF87a", b"GIF89a",    # gif
    b"BM",                   # bmp
    b"%PDF-",                # pdf
    b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08",  # zip / docx / xlsx / pptx
)


def upload_type_allowed(filename: str, content_type: str) -> bool:
    """Server-side MIME + extension allowlist for direct uploads."""
    ext = (os.path.splitext(filename or "")[1] or "").lower().lstrip(".")
    mime = (content_type or "").lower().split(";")[0].strip()
    if ext in ALLOWED_UPLOAD_EXTS:
        return True
    if mime in ALLOWED_UPLOAD_MIMES:
        return True
    if mime.startswith("image/") and mime != "image/svg+xml":
        return True
    return False


def upload_magic_ok(data: bytes) -> bool:
    if not data:
        return False
    if any(data.startswith(sig) for sig in MAGIC_SIGNATURES):
        return True
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True
    return False


def cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "https://bimo.qzz.io,http://localhost:5500,http://127.0.0.1:5500",
    ).strip()
    return [o.strip() for o in raw.split(",") if o.strip()]
