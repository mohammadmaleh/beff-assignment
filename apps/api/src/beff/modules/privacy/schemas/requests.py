"""Inbound privacy payloads."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

__all__ = ["ConsentRequest"]


class ConsentRequest(BaseModel):
    """A grant or a withdrawal.

    One purpose per request, because consent must be *specific* (Art. 4(11)). A
    payload that accepted a list would let a client send one "I agree" covering
    everything, which is exactly the shape the law rejects.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    purpose: Annotated[str, Field(max_length=40)]
    granted: bool
