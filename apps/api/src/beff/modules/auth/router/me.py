"""`GET /me` - the signed-in user."""

from __future__ import annotations

from fastapi import APIRouter, status

from beff.modules.auth.dependencies import CurrentUser
from beff.modules.auth.schemas import UserResponse

__all__ = ["router"]

router = APIRouter()


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    response_model=UserResponse,
    summary="The signed-in user",
    responses={401: {"description": "Missing, malformed or expired access token."}},
)
async def me(user: CurrentUser) -> UserResponse:
    """Resolve the bearer token to the account behind it.

    The frontend calls this once on load, after refreshing, to decide whether to
    render the app or the login page. It hits the database rather than trusting
    the JWT's claims, which is what makes an erased account stop working before
    its access token would have expired on its own.
    """
    return UserResponse.model_validate(user)
