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
    street: NullableText = None
    city: NullableText = None
    state_or_region: NullableText = None
    postal_code: NullableIdentifier = None
    country: NullableText = None


class PassportExtraction(StrictModel):
    full_name: NullableText = None
    surname: NullableText = None
    given_names: NullableText = None
    passport_number: NullableIdentifier = None
    nationality: NullableText = None
    date_of_birth: NullableDate = None
    sex: NullableText = None
    place_of_birth: NullableText = None
    date_of_issue: NullableDate = None
    date_of_expiry: NullableDate = None
    issuing_authority: NullableText = None


class DriverLicenseExtraction(StrictModel):
    full_name: NullableText = None
    license_number: NullableIdentifier = None
    address: Address | None = None
    date_of_birth: NullableDate = None
    sex: NullableText = None
    issue_date: NullableDate = None
    expiration_date: NullableDate = None
    issuing_jurisdiction: NullableText = None
    license_class: NullableIdentifier = None
    restrictions: NullableText = None


class GreenCardExtraction(StrictModel):
    full_name: NullableText = None
    surname: NullableText = None
    given_name: NullableText = None
    uscis_number: NullableIdentifier = None
    category: NullableIdentifier = None
    country_of_birth: NullableText = None
    date_of_birth: NullableDate = None
    sex: NullableText = None
    card_expires: NullableDate = None
    resident_since: NullableDate = None


class OciExtraction(StrictModel):
    full_name: NullableText = None
    oci_number: NullableIdentifier = None
    passport_number: NullableIdentifier = None
    nationality: NullableText = None
    date_of_birth: NullableDate = None
    place_of_birth: NullableText = None
    date_of_issue: NullableDate = None
    place_of_issue: NullableText = None
    visa_type: NullableIdentifier = None


class InsuranceExtraction(StrictModel):
    plan_name: NullableText = None
    insurer_name: NullableText = None
    member_name: NullableText = None
    member_id: NullableIdentifier = None
    group_number: NullableIdentifier = None
    plan_type: NullableText = None
    effective_date: NullableDate = None
    expiration_date: NullableDate = None
    rx_bin: NullableIdentifier = None
    rx_pcn: NullableIdentifier = None
    rx_group: NullableIdentifier = None
    payer_phone: NullableIdentifier = None


class EyePrescription(StrictModel):
    sphere: NullableIdentifier = None
    cylinder: NullableIdentifier = None
    axis: NullableIdentifier = None
    add: NullableIdentifier = None
    prism: NullableIdentifier = None


class VisionExtraction(StrictModel):
    patient_name: NullableText = None
    provider_name: NullableText = None
    prescription_date: NullableDate = None
    expiration_date: NullableDate = None
    right_eye: EyePrescription | None = None
    left_eye: EyePrescription | None = None
    pupillary_distance: NullableIdentifier = None


class Medication(StrictModel):
    name: NullableText = None
    strength: NullableIdentifier = None
    directions: NullableText = None


class MedicalExtraction(StrictModel):
    patient_name: NullableText = None
    record_type: NullableText = None
    provider_name: NullableText = None
    facility_name: NullableText = None
    date_of_service: NullableDate = None
    diagnoses: Annotated[list[str], Field(max_length=30)] = Field(default_factory=list)
    medications: Annotated[list[Medication], Field(max_length=30)] = Field(default_factory=list)
    allergies: Annotated[list[str], Field(max_length=30)] = Field(default_factory=list)


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
