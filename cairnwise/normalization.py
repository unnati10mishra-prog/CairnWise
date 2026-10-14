"""Deterministic, inspectable normalization helpers.

The comparison helpers deliberately do less than a full Unicode security
implementation.  They preserve the original value at the call site, apply
NFC and case-folding for comparison, and expose a small mixed-script
diagnostic.  The script heuristic is useful triage evidence, but it is only a
partial diagnostic and is **not** a UTS #39 confusable/skeleton
implementation.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterator
from posixpath import normpath
from urllib.parse import urlsplit, urlunsplit


NORMALIZATION_VERSION = "cw-normalize-0.2.0"


def normalize_text(value: str | None) -> str:
    """Return a conservative NFC/case-folded comparison form.

    Punctuation, separators, accents, and scripts are intentionally retained
    here.  Callers that need a compact name use :func:`compact_name` and can
    still compare this form to explain spacing or punctuation changes.
    """

    if not isinstance(value, str) or not value:
        return ""
    return unicodedata.normalize("NFC", value).casefold().strip()


def compact_name(value: str | None) -> str:
    """Remove only non-alphanumeric characters from the safe text form.

    No transliteration or confusable folding is performed.  As a result,
    visually similar characters remain distinguishable and can be surfaced as
    diagnostics instead of being silently treated as equal.
    """

    return "".join(char for char in normalize_text(value) if char.isalnum())


def tokens(value: str | None) -> list[str]:
    """Return Unicode letter/number tokens with underscore as a separator."""

    return re.findall(r"[^\W_]+", normalize_text(value), flags=re.UNICODE)


def canonical_url(value: str | None) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    parsed = urlsplit(value.strip())
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must use http or https and include a host")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL credentials are not supported")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("URL host is required")

    # Keep URL comparison stable across equivalent default-port spellings.
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("URL port is invalid") from error
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        host = f"{host}:{port}"

    path = parsed.path or "/"
    path = re.sub(r"/{2,}", "/", path)
    # ``normpath`` is used only for dot segments; it does not decode or
    # rewrite percent-encoded content.  Preserve a leading slash and the
    # conventional root representation.
    path = normpath(path)
    if not path.startswith("/"):
        path = f"/{path}"
    if path == ".":
        path = "/"
    if len(path) > 1:
        path = path.rstrip("/")
    return urlunsplit((scheme, host, path, parsed.query, ""))


def script_families(value: str | None) -> set[str]:
    families: set[str] = set()
    for char in normalize_text(value):
        if not char.isalpha():
            continue
        name = unicodedata.name(char, "")
        for family in ("LATIN", "CYRILLIC", "GREEK", "DEVANAGARI", "ARABIC", "HEBREW", "HIRAGANA", "KATAKANA", "HANGUL"):
            if family in name:
                families.add(family)
                break
        else:
            families.add("OTHER")
    return families


def mixed_script(value: str | None) -> bool:
    families = script_families(value)
    return len(families) > 1


def unicode_script_diagnostics(value: str | None) -> dict[str, object]:
    """Return a partial, inspectable mixed-script diagnostic.

    This intentionally reports only broad script families recognized by the
    local Unicode character names.  It does not compute a UTS #39 skeleton,
    confusable mappings, restriction levels, or spoofing verdicts.
    """

    families = sorted(script_families(value))
    return {
        "families": families,
        "mixed_script": len(families) > 1,
        "status": "partial",
        "method": "unicode_character_name_family_heuristic",
    }


def is_character_swap(left: str | None, right: str | None) -> bool:
    a = list(normalize_text(left))
    b = list(normalize_text(right))
    if len(a) != len(b) or a == b:
        return False
    differences = [index for index, (x, y) in enumerate(zip(a, b)) if x != y]
    if len(differences) != 2:
        return False
    first, second = differences
    return a[first] == b[second] and a[second] == b[first]


def contains_added_risk_word(value: str | None) -> str | None:
    for word in risk_words(value):
        return word
    return None


def risk_words(value: str | None) -> Iterator[str]:
    """Return known look-alike/support words in deterministic order."""

    present = set(tokens(value))
    for word in ("support", "official", "help", "login", "care", "secure", "verify"):
        if word in present:
            yield word
