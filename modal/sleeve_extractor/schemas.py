from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


NullableText = Annotated[str | None, Field(max_length=500)]
NullableIdentifier = Annotated[str | None, Field(max_length=120)]
NullableDate = Annotated[str | None, Field(max_length=10)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_max_length=500)


class DocumentType(StrEnum):
    PASSPORT = "passport"
    DRIVER_LICENSE = "driver_license"
    GREEN_CARD = "green_card"
    OCI = "oci"
    INSURANCE = "insurance"
    VISION = "vision"
    MEDICAL = "medical"


class Address(StrictModel):
    street: NullableText
    city: NullableText
    state_or_region: NullableText
    postal_code: NullableIdentifier
    country: NullableText


class PassportExtraction(StrictModel):
    full_name: NullableText
    surname: NullableText
    given_names: NullableText
    passport_number: NullableIdentifier
    nationality: NullableText
    date_of_birth: NullableDate
    sex: NullableText
    place_of_birth: NullableText
    date_of_issue: NullableDate
    date_of_expiry: NullableDate
    issuing_authority: NullableText


class DriverLicenseExtraction(StrictModel):
    full_name: NullableText
    license_number: NullableIdentifier
    address: Address
    date_of_birth: NullableDate
    sex: NullableText
    issue_date: NullableDate
    expiration_date: NullableDate
    issuing_jurisdiction: NullableText
    license_class: NullableIdentifier
    restrictions: NullableText


class GreenCardExtraction(StrictModel):
    full_name: NullableText
    surname: NullableText
    given_name: NullableText
    uscis_number: NullableIdentifier
    category: NullableIdentifier
    country_of_birth: NullableText
    date_of_birth: NullableDate
    sex: NullableText
    card_expires: NullableDate
    resident_since: NullableDate


class OciExtraction(StrictModel):
    full_name: NullableText
    oci_number: NullableIdentifier
    passport_number: NullableIdentifier
    nationality: NullableText
    date_of_birth: NullableDate
    place_of_birth: NullableText
    date_of_issue: NullableDate
    place_of_issue: NullableText
    visa_type: NullableIdentifier


class InsuranceExtraction(StrictModel):
    plan_name: NullableText
    insurer_name: NullableText
    member_name: NullableText
    member_id: NullableIdentifier
    group_number: NullableIdentifier
    plan_type: NullableText
    effective_date: NullableDate
    expiration_date: NullableDate
    rx_bin: NullableIdentifier
    rx_pcn: NullableIdentifier
    rx_group: NullableIdentifier
    payer_phone: NullableIdentifier


class EyePrescription(StrictModel):
    sphere: NullableIdentifier
    cylinder: NullableIdentifier
    axis: NullableIdentifier
    add: NullableIdentifier
    prism: NullableIdentifier


class VisionExtraction(StrictModel):
    patient_name: NullableText
    provider_name: NullableText
    prescription_date: NullableDate
    expiration_date: NullableDate
    right_eye: EyePrescription
    left_eye: EyePrescription
    pupillary_distance: NullableIdentifier


class Medication(StrictModel):
    name: NullableText
    strength: NullableIdentifier
    directions: NullableText


class MedicalExtraction(StrictModel):
    patient_name: NullableText
    record_type: NullableText
    provider_name: NullableText
    facility_name: NullableText
    date_of_service: NullableDate
    diagnoses: Annotated[list[str], Field(max_length=30)]
    medications: Annotated[list[Medication], Field(max_length=30)]
    allergies: Annotated[list[str], Field(max_length=30)]


Extraction = (
    PassportExtraction
    | DriverLicenseExtraction
    | GreenCardExtraction
    | OciExtraction
    | InsuranceExtraction
    | VisionExtraction
    | MedicalExtraction
)


EXTRACTION_MODELS: dict[DocumentType, type[Extraction]] = {
    DocumentType.PASSPORT: PassportExtraction,
    DocumentType.DRIVER_LICENSE: DriverLicenseExtraction,
    DocumentType.GREEN_CARD: GreenCardExtraction,
    DocumentType.OCI: OciExtraction,
    DocumentType.INSURANCE: InsuranceExtraction,
    DocumentType.VISION: VisionExtraction,
    DocumentType.MEDICAL: MedicalExtraction,
}


class ExtractionRequest(StrictModel):
    document_type: DocumentType
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    image_base64: Annotated[str, Field(min_length=4, max_length=14_000_000)]


class ExtractionResponse(StrictModel):
    document_type: DocumentType
    model: Literal["zai-org/GLM-OCR"] = "zai-org/GLM-OCR"
    requires_human_confirmation: Literal[True] = True
    fields: dict[str, object]
