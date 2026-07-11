from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from pydantic import ValidationError

from .schemas import DocumentType, EXTRACTION_MODELS, Extraction


DATE_KEYS = {
    "card_expires",
    "date_of_birth",
    "date_of_expiry",
    "date_of_issue",
    "date_of_service",
    "effective_date",
    "expiration_date",
    "issue_date",
    "prescription_date",
    "resident_since",
}

DATE_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
)


def _normalize_date(value: str) -> str:
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format).date().isoformat()
        except ValueError:
            continue
    return value


def normalize_values(value: Any, key: str | None = None) -> Any:
    if isinstance(value, dict):
        return {item_key: normalize_values(item, item_key) for item_key, item in value.items()}
    if isinstance(value, list):
        return [normalize_values(item) for item in value]
    if isinstance(value, str):
        normalized = re.sub(r"\s+", " ", value).strip()
        if not normalized:
            return None
        return _normalize_date(normalized) if key in DATE_KEYS else normalized
    return value


def extract_json_object(output: str) -> dict[str, Any]:
    """Decode exactly one JSON object, tolerating only a Markdown code fence."""
    if len(output) > 65_536:
        raise ValueError("model output exceeds the response limit")

    candidate = output.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate, count=1, flags=re.IGNORECASE)
        candidate = re.sub(r"\s*```$", "", candidate, count=1)

    decoded = json.loads(candidate)
    if not isinstance(decoded, dict):
        raise ValueError("model output must be a JSON object")
    return decoded


def validate_extraction(document_type: DocumentType, output: str) -> Extraction:
    payload = normalize_values(extract_json_object(output))
    model = EXTRACTION_MODELS[document_type]
    try:
        return model.model_validate(payload, strict=True)
    except ValidationError as exc:
        raise ValueError("model output did not match the extraction schema") from exc
