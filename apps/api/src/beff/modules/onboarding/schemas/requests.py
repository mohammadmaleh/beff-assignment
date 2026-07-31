"""Inbound onboarding payloads."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

__all__ = ["SaveProgressRequest"]

# The wizard has five steps and a handful of answers. A cap this far above what
# the client can produce is not a limit on the feature; it is a limit on how
# much JSONB an authenticated caller can push into a row.
MAX_ANSWERS = 50
MAX_ANSWER_LENGTH = 500


class SaveProgressRequest(BaseModel):
    """Where the user is, and what they have answered so far."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    current_step: Annotated[str, Field(max_length=40)]
    answers: Annotated[dict[str, Any], Field(max_length=MAX_ANSWERS)] = Field(default_factory=dict)

    @property
    def truncated_answers(self) -> dict[str, Any]:
        """Answers with every string clipped to what the columns can hold.

        The step's own validation is in the service. This is the shape guard:
        `answers` is JSONB with no per-value length constraint, so without it
        one request could store a megabyte of text per key.
        """
        return {
            key: value[:MAX_ANSWER_LENGTH] if isinstance(value, str) else value
            for key, value in self.answers.items()
        }
