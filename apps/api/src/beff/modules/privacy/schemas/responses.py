"""Outbound privacy payloads."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

__all__ = ["ConsentStateResponse", "ExportJobResponse"]


class ConsentStateResponse(BaseModel):
    """Current consent per manageable purpose.

    The *state*, derived from the append-only log. The log itself is not exposed
    - it is evidence held for accountability, not something the profile screen
    needs to render, and the full history is available through an export.
    """

    analytics: bool
    marketing: bool


class ExportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    requested_at: datetime
    completed_at: datetime | None
    # A path, not a URL. The API does not know what hostname the browser reached
    # it on, and guessing wrong points the download at `localhost` in production.
    download_path: str | None
