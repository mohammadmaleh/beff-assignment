"""The privacy HTTP surface - consent, export and erasure."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request, Response, status

from beff.modules.auth.dependencies import CurrentUser
from beff.modules.privacy.dependencies import ConsentSvc, ErasureSvc, ExportSvc
from beff.modules.privacy.schemas import (
    ConsentRequest,
    ConsentStateResponse,
    ExportJobResponse,
)

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/privacy", tags=["privacy"])


def _client_ip(request: Request) -> str | None:
    """The caller's address, for hashing.

    `X-Forwarded-For` is trusted only for its first entry, and only because this
    app is always deployed behind a proxy that sets it. It is never stored - it
    goes straight into a salted hash.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return None if request.client is None else request.client.host


@router.get(
    "/consent",
    status_code=status.HTTP_200_OK,
    response_model=ConsentStateResponse,
    summary="Current consent, per purpose",
)
async def get_consent(user: CurrentUser, service: ConsentSvc) -> ConsentStateResponse:
    """Derived from the append-only log, never read from a boolean column."""
    return ConsentStateResponse(**await service.state(user.id))


@router.post(
    "/consent",
    status_code=status.HTTP_200_OK,
    response_model=ConsentStateResponse,
    summary="Grant or withdraw consent",
    responses={422: {"description": "Unknown or non-manageable purpose."}},
)
async def set_consent(
    payload: ConsentRequest,
    request: Request,
    user: CurrentUser,
    service: ConsentSvc,
) -> ConsentStateResponse:
    """POST, never PUT or PATCH.

    The verb is part of the design: this **appends an event**, it does not edit
    a value. Withdrawal is the same endpoint with `granted: false`, because
    Art. 7(3) requires withdrawing to be as easy as giving - and a separate
    endpoint is where "as easy" quietly stops being true.
    """
    state = await service.record(
        user.id,
        purpose=payload.purpose,
        granted=payload.granted,
        ip_address=_client_ip(request),
        country_code=request.headers.get("cf-ipcountry"),
    )
    return ConsentStateResponse(**state)


@router.get(
    "/export",
    status_code=status.HTTP_200_OK,
    response_model=ExportJobResponse | None,
    summary="The user's most recent export job",
)
async def get_export(user: CurrentUser, service: ExportSvc) -> ExportJobResponse | None:
    """`null` when none has ever been requested - not a 404.

    "You have never asked for an export" is a normal state of the profile
    screen, not an error, and modelling it as one would make the client handle a
    failure path for the common case.
    """
    job = await service.latest(user.id)
    return None if job is None else ExportJobResponse.model_validate(job)


@router.post(
    "/export",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ExportJobResponse,
    summary="Request a copy of your data (Art. 15, Art. 20)",
)
async def request_export(user: CurrentUser, service: ExportSvc) -> ExportJobResponse:
    """202, because the work happens on the queue, not in this request.

    Idempotent: an export already in flight is returned rather than a second one
    queued, so a double-click cannot put two workers on the same document.
    """
    return ExportJobResponse.model_validate(await service.request(user.id))


@router.get(
    "/export/{job_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download a finished export",
    responses={
        404: {"description": "No such export - also the answer when it is someone else's."},
        422: {"description": "The export exists but is not ready yet."},
    },
)
async def download_export(job_id: UUID, user: CurrentUser, service: ExportSvc) -> dict[str, Any]:
    """Scoped to the owner inside the query, not by a check afterwards."""
    return await service.document(job_id, user.id)


@router.delete(
    "/erasure",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Erase this account and everything attached to it (Art. 17)",
)
async def erase(user: CurrentUser, service: ErasureSvc, response: Response) -> Response:
    """The brief's mandated offboarding, and Art. 17.

    Not reversible, and deliberately not soft in effect even though it is soft
    in mechanism: the row survives so the partial unique index can free the
    email for re-registration, but every identifying column on it is scrubbed.
    """
    await service.erase(user.id)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
