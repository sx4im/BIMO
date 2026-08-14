"""Content-safety guard for image-generation prompts.

A deterministic, server-side blocklist that rejects prompts asking for sexual,
explicit, exploitative, or gratuitously violent imagery *before* we ever spend
an NVIDIA image call. This is a backstop the client cannot bypass — the image
models have their own filters, but we never want to forward an obviously unsafe
prompt, and a hard local check gives us a clear, consistent refusal.

``check_prompt`` returns a short user-facing refusal string when the prompt is
disallowed, or ``None`` when it is fine to generate.
"""

from __future__ import annotations

import re
from typing import Optional

# Generic refusal shown to the user. Deliberately brief and non-preachy.
_REFUSAL = (
    "I can't create that image. I won't generate sexual, explicit, or other "
    "unsafe content. Try a different prompt and I'll be glad to help."
)
_REFUSAL_CSAM = (
    "I can't create that image. Requests that sexualize minors are never "
    "allowed. I won't generate this."
)

# Explicit sexual / nudity terms. Word-boundary anchored so they don't fire on
# innocuous substrings (e.g. "anal" won't match "analysis", "cum" won't match
# "cumulative"). Multi-word phrases are matched as written.
_SEXUAL_TERMS = [
    r"porn", r"pornographic", r"pornography", r"\bxxx\b", r"hentai",
    r"\brule\s?34\b", r"\br34\b", r"\bnsfw\b", r"\blewd", r"ahegao",
    r"\bnude", r"\bnaked\b", r"nudity", r"topless", r"bottomless",
    r"\berotic", r"erotica", r"camgirl", r"onlyfans",
    r"\bsex\b", r"sexual", r"sexually", r"sexting", r"\bintercourse\b",
    r"\bgenital", r"genitalia", r"\bpenis\b", r"\bvagina\b", r"\bvulva\b",
    r"clitoris", r"testicl", r"scrotum", r"\banus\b", r"\banal\s+sex",
    r"\bnipple", r"areola", r"\bboobs?\b", r"\btits?\b", r"titties",
    r"\bcum\b", r"cumshot", r"ejaculat", r"\bblowjob\b", r"\bhandjob\b",
    r"deepthroat", r"masturbat", r"\borgasm", r"fellatio", r"cunnilingus",
    r"fingering", r"\bdildo\b", r"\bstrapon\b", r"strap-on", r"fleshlight",
    r"\bbdsm\b", r"bondage", r"\bfetish", r"\bprostitut", r"\bescort\b",
    r"\bcameltoe\b", r"upskirt", r"underboob", r"\bsexy\s+nud",
]

# Hard, non-negotiable block: any explicit CSAM term.
_CSAM_TERMS = [
    r"\bcsam\b", r"child\s*porn", r"childporn", r"\bcp\b", r"\bloli\b",
    r"lolicon", r"\bshota\b", r"shotacon", r"pedophil", r"\bpedo\b",
    r"jailbait",
]

# Minor + sexual co-occurrence is also CSAM even without an explicit term.
_MINOR_TERMS = [
    r"\bchild\b", r"\bchildren\b", r"\bkid\b", r"\bkids\b", r"\bminor\b",
    r"\btoddler\b", r"\binfant\b", r"\bbaby\b", r"\bpreteen\b",
    r"\bpre-teen\b", r"\bunderage\b", r"\bteen\b", r"\bteenage\b",
    r"\bschoolgirl\b", r"\bschoolboy\b", r"\b(?:1[0-7]|[1-9])\s*[- ]?year[- ]?old\b",
]

# Gratuitous gore / extreme violence.
_GORE_TERMS = [
    r"\bgore\b", r"\bgory\b", r"beheading", r"decapitat", r"dismember",
    r"mutilat", r"\bdisembowel", r"\bcorpse", r"\bgraphic\s+violence\b",
    r"\bsnuff\b",
]


def _compile(terms: list[str]) -> re.Pattern:
    return re.compile("|".join(terms), re.IGNORECASE)


_SEXUAL_RE = _compile(_SEXUAL_TERMS)
_CSAM_RE = _compile(_CSAM_TERMS)
_MINOR_RE = _compile(_MINOR_TERMS)
_GORE_RE = _compile(_GORE_TERMS)


def check_prompt(prompt: str) -> Optional[str]:
    """Return a refusal string if the prompt is disallowed, else ``None``."""
    text = (prompt or "").strip()
    if not text:
        return None

    # Highest-priority hard block first.
    if _CSAM_RE.search(text):
        return _REFUSAL_CSAM
    sexual = bool(_SEXUAL_RE.search(text))
    if sexual and _MINOR_RE.search(text):
        return _REFUSAL_CSAM
    if sexual:
        return _REFUSAL
    if _GORE_RE.search(text):
        return _REFUSAL
    return None
