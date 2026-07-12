import json

import pytest
from pydantic import ValidationError

from sleeve_extractor.normalization import extract_json_object, normalize_values, validate_extraction
from sleeve_extractor.schemas import DocumentType, EXTRACTION_MODELS, ExtractionRequest


def test_all_document_types_have_distinct_strict_schemas() -> None:
    assert set(EXTRACTION_MODELS) == set(DocumentType)
    assert len(set(EXTRACTION_MODELS.values())) == len(DocumentType)
    for model in EXTRACTION_MODELS.values():
        assert model.model_config["extra"] == "forbid"


def test_normalizes_whitespace_empty_values_and_date() -> None:
    assert normalize_values(
        {"full_name": "  Ada   Lovelace ", "date_of_birth": "10/12/1815", "sex": "  "}
    ) == {
        "full_name": "Ada Lovelace",
        "date_of_birth": "1815-10-12",
        "sex": None,
    }


def test_extract_json_object_accepts_bounded_model_wrappers() -> None:
    assert extract_json_object('```json\n{"member_id":"123"}\n```') == {"member_id": "123"}
    assert extract_json_object('result: {"member_id":"123"}') == {"member_id": "123"}


def test_sparse_passport_output_defaults_missing_fields_to_none() -> None:
    extraction = validate_extraction(
        DocumentType.PASSPORT,
        '{"full_name":"Ada Lovelace","passport_number":"REDACTED"}',
    )

    assert extraction.full_name == "Ada Lovelace"
    assert extraction.passport_number == "REDACTED"
    assert extraction.date_of_expiry is None


def test_passport_schema_rejects_unknown_fields() -> None:
    payload = {
        "full_name": "Ada Lovelace",
        "surname": "Lovelace",
        "given_names": "Ada",
        "passport_number": "REDACTED",
        "nationality": "British",
        "date_of_birth": "1815-12-10",
        "sex": None,
        "place_of_birth": "London",
        "date_of_issue": None,
        "date_of_expiry": None,
        "issuing_authority": None,
        "unexpected": "not allowed",
    }
    with pytest.raises(ValueError, match="did not match"):
        validate_extraction(DocumentType.PASSPORT, json.dumps(payload))


def test_request_rejects_data_uri_and_unsupported_content_type() -> None:
    with pytest.raises(ValidationError):
        ExtractionRequest(
            document_type=DocumentType.PASSPORT,
            mime_type="application/pdf",
            image_base64="data:image/png;base64,AAAA",
        )
