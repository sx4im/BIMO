"""NVIDIA Riva text-to-speech (magpie-tts-multilingual) over gRPC.

magpie-tts-multilingual is served through Riva TTS over gRPC at
``grpc.nvcf.nvidia.com:443`` with a per-model ``function-id`` — the same
transport the ASR whisper model uses in ``riva_transcribe.py``. This module
wraps the official ``nvidia-riva-client`` so the gateway can synthesize speech
for the voice assistant.

The model returns raw mono LINEAR_PCM (16-bit) audio. We wrap it in a minimal
WAV container here so the browser can decode it directly (via the Web Audio
API), which keeps the frontend simple and avoids any extra client-side codec.
"""

from __future__ import annotations

import io
import logging
import os
import wave

logger = logging.getLogger("bimo.riva_tts")

# Public function-id for nvidia/magpie-tts-multilingual on build.nvidia.com.
# Overridable in case NVIDIA rotates it or a different TTS model is pinned.
MAGPIE_TTS_FUNCTION_ID = os.getenv(
    "MAGPIE_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969"
)
RIVA_TTS_SERVER = os.getenv("RIVA_TTS_SERVER", os.getenv("RIVA_SERVER", "grpc.nvcf.nvidia.com:443"))

# Default voice/language. magpie-tts-multilingual voice names follow
# "Magpie-Multilingual.{LOCALE}.{Speaker}" (e.g. EN-US.Aria / Jason / Leo).
DEFAULT_VOICE = os.getenv("TTS_VOICE", "Magpie-Multilingual.EN-US.Aria")
DEFAULT_LANGUAGE = os.getenv("TTS_LANGUAGE", "en-US")
MAX_TTS_CHARS = 4000


def _sample_rate() -> int:
    try:
        return int(os.getenv("TTS_SAMPLE_RATE", "44100"))
    except (TypeError, ValueError):
        return 44100


def tts_available() -> bool:
    """True when an NVIDIA key is present and the riva client import works."""
    if not os.getenv("NVIDIA_API_KEY"):
        return False
    try:
        import riva.client  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def synthesize_wav(text: str, *, voice: str | None = None, language: str | None = None) -> bytes:
    """Synthesize ``text`` to a mono 16-bit WAV via Riva magpie-tts-multilingual.

    Raises RuntimeError with a readable message on any failure so the caller
    can surface it to the client.
    """
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is not set")

    clean = (text or "").strip()
    if not clean:
        raise RuntimeError("empty text")
    if len(clean) > MAX_TTS_CHARS:
        clean = clean[:MAX_TTS_CHARS]

    try:
        import riva.client
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"nvidia-riva-client not installed: {exc}") from exc

    # NVCF requires the function-id + bearer token as gRPC metadata.
    metadata = [
        ["function-id", MAGPIE_TTS_FUNCTION_ID],
        ["authorization", f"Bearer {api_key}"],
    ]
    rate = _sample_rate()

    try:
        auth = riva.client.Auth(
            None,  # no SSL cert path — use system roots
            True,  # use_ssl
            RIVA_TTS_SERVER,
            metadata,
        )
        service = riva.client.SpeechSynthesisService(auth)
        resp = service.synthesize(
            text=clean,
            voice_name=voice or DEFAULT_VOICE,
            language_code=language or DEFAULT_LANGUAGE,
            sample_rate_hz=rate,
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Riva TTS synthesis failed: %s", exc)
        raise RuntimeError(f"TTS synthesis failed: {exc}") from exc

    pcm = getattr(resp, "audio", None)
    if not pcm:
        raise RuntimeError("TTS returned empty audio")

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()
