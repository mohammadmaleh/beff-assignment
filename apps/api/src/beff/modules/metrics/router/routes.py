"""The metrics HTTP surface."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from beff.modules.auth.dependencies import CurrentUser
from beff.modules.metrics.dependencies import Service
from beff.modules.metrics.schemas import MetricsOverviewResponse

__all__ = ["router"]

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


@router.get(
    "/overview",
    status_code=status.HTTP_200_OK,
    response_model=MetricsOverviewResponse,
    summary="Production overview for the signed-in user's line",
    responses={
        401: {"description": "Missing or invalid access token."},
        422: {
            "description": (
                "The account has no production line yet — code "
                "`metrics.no_line_configured`. Send the user back to onboarding."
            )
        },
    },
)
async def overview(
    user: CurrentUser,
    service: Service,
    window_days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> MetricsOverviewResponse:
    """Headline figures, the scrap breakdown and the tolerance bands.

    Scoped to the signed-in user by `user.id`, never by a client-supplied line
    id. An endpoint that takes the line from the query string is one missing
    ownership check away from letting user A read user B's production data, and
    that check is the kind that gets refactored out.
    """
    return MetricsOverviewResponse.model_validate(
        await service.overview(user.id, window_days=window_days)
    )
