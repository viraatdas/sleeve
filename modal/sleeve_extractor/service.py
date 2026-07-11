from __future__ import annotations

import base64
import binascii
import hmac
import io
import json
import os
import tempfile
from pathlib import Path

import modal
from fastapi import HTTPException, Request, status

from .normalization import validate_extraction
from .schemas import EXTRACTION_MODELS, ExtractionRequest, ExtractionResponse


MODEL_ID = "zai-org/GLM-OCR"
MODEL_DIR = "/models/glm-ocr"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MAX_NEW_TOKENS = 1_500

model_volume = modal.Volume.from_name("sleeve-glm-ocr-models", create_if_missing=True)
runtime_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "accelerate==1.12.0",
    "fastapi[standard]==0.128.0",
    "pillow==12.1.0",
    "pydantic==2.12.5",
    "safetensors==0.8.0",
    "torch==2.9.1",
    "transformers==5.13.0",
)
api_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "fastapi[standard]==0.128.0",
    "pydantic==2.12.5",
)

app = modal.App("sleeve-glm-ocr", image=runtime_image)


def _decode_image(request: ExtractionRequest):
    from PIL import Image, UnidentifiedImageError

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        image_bytes = base64.b64decode(request.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid image encoding") from exc
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("image exceeds the size limit")

    expected_format = {
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/webp": "WEBP",
    }[request.mime_type]
    try:
        with Image.open(io.BytesIO(image_bytes)) as candidate:
            candidate.verify()
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("invalid image") from exc
    if image.format != expected_format:
        image.close()
        raise ValueError("image content does not match its MIME type")
    return image.convert("RGB")


def _prompt_for(request: ExtractionRequest) -> str:
    schema = EXTRACTION_MODELS[request.document_type].model_json_schema()
    return (
        "Extract only values visibly present in this document. "
        "Do not infer or complete missing values. Use null for missing scalar values "
        "and [] for missing lists. Dates must be YYYY-MM-DD when unambiguous. "
        "Return only one JSON object that exactly matches this JSON Schema, with no "
        "Markdown or commentary:\n" + json.dumps(schema, separators=(",", ":"))
    )


@app.cls(
    gpu="L4",
    region=["us-west"],
    routing_region="us-west",
    cpu=4,
    memory=16_384,
    timeout=180,
    max_containers=2,
    min_containers=0,
    scaledown_window=300,
    volumes={"/models": model_volume},
)
@modal.concurrent(max_inputs=1)
class GlmOcrService:
    @modal.enter()
    def load_model(self) -> None:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        model_path = Path(MODEL_DIR)
        source = str(model_path) if (model_path / "config.json").exists() else MODEL_ID
        self.processor = AutoProcessor.from_pretrained(source)
        self.model = AutoModelForImageTextToText.from_pretrained(
            source,
            torch_dtype=torch.bfloat16,
            device_map="cuda",
        ).eval()
        if source == MODEL_ID:
            self.processor.save_pretrained(MODEL_DIR)
            self.model.save_pretrained(MODEL_DIR)
            model_volume.commit()

    @modal.method()
    def extract(self, request_data: dict):
        request = ExtractionRequest.model_validate(request_data)
        try:
            image = _decode_image(request)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The document image could not be processed",
            ) from None

        temporary_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temporary:
                temporary_path = temporary.name
            image.save(temporary_path, format="PNG", optimize=True)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "url": temporary_path},
                        {"type": "text", "text": _prompt_for(request)},
                    ],
                }
            ]
            inputs = self.processor.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_dict=True,
                return_tensors="pt",
            ).to(self.model.device)
            inputs.pop("token_type_ids", None)
            generated = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                do_sample=False,
            )
            output = self.processor.decode(
                generated[0][inputs["input_ids"].shape[1] :],
                skip_special_tokens=True,
            )
            fields = validate_extraction(request.document_type, output)
            return ExtractionResponse(
                document_type=request.document_type,
                fields=fields.model_dump(mode="json"),
            ).model_dump(mode="json")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Document extraction failed",
            ) from None
        finally:
            image.close()
            if temporary_path:
                Path(temporary_path).unlink(missing_ok=True)


@app.function(
    image=api_image,
    region=["us-west"],
    routing_region="us-west",
    timeout=190,
    secrets=[modal.Secret.from_name("sleeve-extraction-auth")],
)
@modal.fastapi_endpoint(method="POST", docs=False)
def extract_endpoint(request: ExtractionRequest, raw_request: Request):
    """Authenticate on inexpensive CPU capacity before starting any GPU work."""
    configured_token = os.environ.get("EXTRACTION_BEARER_TOKEN", "")
    authorization = raw_request.headers.get("authorization", "")
    supplied_token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    if not configured_token or not supplied_token or not hmac.compare_digest(configured_token, supplied_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        return GlmOcrService().extract.remote(request.model_dump(mode="json"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Document extraction failed",
        ) from None
