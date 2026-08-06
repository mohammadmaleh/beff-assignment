"""Unit tests for the handlers that turn every failure into RFC 9457.

The domain errors are covered where they are raised. What is under test here is
the *other* three doors out of the application — a raw `HTTPException`, a
Pydantic validation failure, and something nobody planned for — because those
are the ones no feature test exercises deliberately and the ones a client still
has to be able to parse.

The 500 handler carries the assertion that matters most: an exception message
can hold a connection string, a SQL fragment or another user's data, and none of
that belongs in a response body. It is asserted here rather than trusted,
because the code that would leak it is one `str(exc)` away and reads as helpful.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from beff.core.config import Settings
from beff.core.problems import install_problem_handlers

SECRET = "postgresql://beff:hunter2@db.internal:5432/beff"

PROBLEM_JSON = "application/problem+json"


class Body(BaseModel):
    email: str = Field(min_length=3)
    lines: list[str] = Field(default_factory=list)


def build_app(*, environment: str = "test") -> FastAPI:
    settings = Settings(
        environment=environment,
        jwt_secret="a-secret-with-enough-entropy-for-rfc-7518-hs256",
        ip_hash_salt="salt",
        database_url="postgresql+asyncpg://unused/unused",
    )
    app = FastAPI()
    install_problem_handlers(app, settings)

    @app.get("/teapot")
    async def teapot() -> None:
        raise HTTPException(status_code=418, detail="I am a teapot")

    @app.get("/guarded")
    async def guarded() -> None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.get("/structured-detail")
    async def structured_detail() -> None:
        # `detail` is typed as `Any` and libraries do pass dicts.
        raise HTTPException(status_code=409, detail={"why": "conflict"})

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError(f"could not connect to {SECRET}")

    @app.post("/submit")
    async def submit(body: Body) -> dict[str, str]:
        return {"email": body.email}

    return app


async def request(
    app: FastAPI, method: str, path: str, **kwargs: Any
) -> tuple[int, dict[str, Any], dict[str, str]]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.request(method, path, **kwargs)
    return response.status_code, response.json(), dict(response.headers)


# ─────────────────────────────────────────────────────────────────────────────
# Raw HTTPException — FastAPI's own 404s and 405s, and anything a library raises
# ─────────────────────────────────────────────────────────────────────────────


async def test_an_http_exception_leaves_as_a_problem_document() -> None:
    status_code, body, headers = await request(build_app(), "GET", "/teapot")

    assert status_code == 418
    assert headers["content-type"].startswith(PROBLEM_JSON)
    assert body["status"] == 418
    assert body["detail"] == "I am a teapot"
    assert body["instance"] == "/teapot"


async def test_a_status_with_no_name_still_gets_a_stable_code() -> None:
    """`code` is the translation key, so it can never be absent.

    418 is not in the table; the fallback keeps the contract — a client
    switching on `code` gets *something* to switch on rather than a missing key
    and a crash in the error renderer.
    """
    _, body, _ = await request(build_app(), "GET", "/teapot")

    assert body["code"] == "http_418"


async def test_a_known_status_gets_its_documented_code() -> None:
    _, body, _ = await request(build_app(), "GET", "/nowhere")

    assert body["status"] == 404
    assert body["code"] == "not_found"


async def test_a_wrong_method_is_a_problem_too() -> None:
    _, body, _ = await request(build_app(), "POST", "/teapot")

    assert body["status"] == 405
    assert body["code"] == "method_not_allowed"


async def test_a_401_keeps_its_www_authenticate_header() -> None:
    """A 401 without `WWW-Authenticate` is a protocol violation.

    FastAPI puts the header on the *exception*, not on a response, so a handler
    that builds its own response drops it silently — and the client sees an
    authentication challenge that does not say how to authenticate.
    """
    status_code, body, headers = await request(build_app(), "GET", "/guarded")

    assert status_code == 401
    assert headers["www-authenticate"] == "Bearer"
    assert body["code"] == "unauthenticated"


async def test_a_non_string_detail_does_not_reach_the_client_verbatim() -> None:
    """`detail` is `Any`, and `title` is a string in the schema.

    Passing a dict straight through would produce a document that does not match
    the OpenAPI the client was generated from — which fails at parse time, far
    from here.
    """
    _, body, _ = await request(build_app(), "GET", "/structured-detail")

    assert body["title"] == "Request failed."
    assert isinstance(body["detail"], str)


# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────


async def test_a_validation_failure_points_at_the_field_that_failed() -> None:
    """The pointer is what lets the form render the message next to the input.

    A banner at the top of a five-field form is the difference between fixing
    the mistake and re-reading every field to find it.
    """
    _, body, _ = await request(build_app(), "POST", "/submit", json={"email": "a"})

    assert body["status"] == 422
    assert body["code"] == "validation_error"
    assert body["errors"] == [
        {
            "pointer": "/email",
            "field": "email",
            "code": "string_too_short",
            "detail": body["errors"][0]["detail"],
        }
    ]


async def test_a_nested_field_gets_a_json_pointer_through_the_index() -> None:
    _, body, _ = await request(
        build_app(), "POST", "/submit", json={"email": "someone", "lines": [1]}
    )

    assert [e["pointer"] for e in body["errors"]] == ["/lines/0"]
    assert [e["field"] for e in body["errors"]] == ["lines.0"]


async def test_a_missing_body_points_at_the_document_root() -> None:
    """RFC 6901 spells the root as the empty string.

    Pydantic reports this one as `("body",)` — the whole document is missing, so
    there is no field to blame, and stripping the leading segment leaves
    nothing. Inventing a field here would put the message next to an input at
    random.
    """
    _, body, _ = await request(build_app(), "POST", "/submit")

    assert body["status"] == 422
    assert [e["pointer"] for e in body["errors"]] == [""]
    assert [e["field"] for e in body["errors"]] == ["body"]


async def test_malformed_json_is_located_by_offset() -> None:
    """Pydantic reports the byte position rather than a field, because there is
    no parsed document to have fields. The pointer is still well-formed, which
    is what stops the client's error renderer from crashing on it."""
    _, body, _ = await request(
        build_app(),
        "POST",
        "/submit",
        content=b"{not json",
        headers={"content-type": "application/json"},
    )

    assert body["status"] == 422
    assert body["errors"]
    assert all(e["pointer"].startswith("/") for e in body["errors"])


# ─────────────────────────────────────────────────────────────────────────────
# The unplanned
# ─────────────────────────────────────────────────────────────────────────────


async def test_an_unhandled_exception_becomes_a_generic_500() -> None:
    status_code, body, headers = await request(build_app(), "GET", "/boom")

    assert status_code == 500
    assert headers["content-type"].startswith(PROBLEM_JSON)
    assert body["code"] == "internal_error"
    assert body["title"] == "Server error"
    assert body["instance"] == "/boom"


async def test_production_never_puts_the_exception_message_in_the_response() -> None:
    """An exception message can carry a connection string, a SQL fragment or
    another user's data, and none of it belongs in a response body.

    Asserted against the whole serialised document rather than against `detail`,
    because the leak that matters is the one somebody adds to a *different* field
    while debugging. The message used here is a connection string with a password
    in it, which is exactly the shape of the thing that escapes.
    """
    _, body, _ = await request(build_app(environment="production"), "GET", "/boom")

    assert SECRET not in str(body)
    assert "hunter2" not in str(body)
    assert body["detail"] == "The server encountered an unexpected condition."


@pytest.mark.parametrize("environment", ["development", "test"])
async def test_outside_production_the_message_is_exposed_on_purpose(environment: str) -> None:
    """Stack traces belong in the response only where a human is debugging.

    This is pinned rather than left implicit because the switch is a single
    `!= "production"`: if the environment setting were ever mis-defaulted, the
    behaviour asserted above would silently become this one, and a test that
    only covered production would still be green. `Settings.environment` is a
    `Literal`, so these two are the whole of the non-production world.
    """
    _, body, _ = await request(build_app(environment=environment), "GET", "/boom")

    assert body["detail"].startswith("RuntimeError:")
    assert body["code"] == "internal_error"
