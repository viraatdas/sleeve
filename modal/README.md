# Sleeve GLM-OCR worker

This Modal service runs `zai-org/GLM-OCR` on an L4 GPU in `us-west`, with
request routing anchored in `us-west`. It accepts one JPEG, PNG, or WebP image,
extracts the selected document schema, validates that untrusted model output,
and marks every result as requiring human confirmation.

The public endpoint authenticates on inexpensive CPU capacity before it starts
any GPU container, limiting unauthenticated cost abuse. It does not log payloads or extracted values. Uploaded bytes exist
only in memory and one container-local temporary file for the duration of the
request. Inputs are capped at 10 MiB and 25 megapixels. Modal may route payloads
larger than 2 MiB through its object-storage path; callers that have stricter
residency requirements should rasterize and compress documents below that
threshold before calling.

## Local schema tests

Tests do not import the worker or download model weights:

```sh
cd modal
uv sync --dev
uv run pytest
```

## Configure and deploy

Generate a separate random endpoint token, then create the server-side Modal
secret interactively. Do not put the token in source, shell history, examples,
or client-side Vercel variables.

```sh
modal secret create sleeve-extraction-auth EXTRACTION_BEARER_TOKEN
modal deploy -m sleeve_extractor.service
```

The deployed URL is printed by the Modal CLI. Store that URL and the same token
as server-only Vercel environment variables. The application must call the URL
from an authenticated server route using `Authorization: Bearer <token>`; the
browser must never call Modal directly.

The first container downloads the public model to the persistent
`sleeve-glm-ocr-models` volume. Keep Modal request/body logging disabled and do
not add document contents, prompts, outputs, tokens, or signed URLs to traces.

## Supported document types

- `passport`
- `driver_license`
- `green_card`
- `oci`
- `insurance`
- `vision`
- `medical`

PDFs should be rasterized one page at a time by the trusted server boundary.
Model output is never authoritative: the application must show the extracted
fields for confirmation before saving them.
