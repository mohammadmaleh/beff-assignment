"""RFC 9457 Problem Details for HTTP APIs.

Every error this API returns - a domain failure, a raw `HTTPException`, a
Pydantic `RequestValidationError`, or an unhandled crash - leaves as
`application/problem+json` with the same five members RFC 9457 defines, plus two
extensions the frontend needs:

* ``code`` - a stable, namespaced identifier. This, not the English ``title`` or
  ``detail``, is the translation key. EN and DE strings are chosen client-side
  by switching on it, so prose can be rewritten without breaking a locale.
* ``errors`` - a per-field breakdown on validation failures, each entry carrying
  a JSON Pointer to the offending value and its own code, so the form can render
  the message next to the input it belongs to instead of a banner at the top.
"""

from beff.core.problems.handlers import install_problem_handlers
from beff.core.problems.problem import (
    FieldProblem,
    Problem,
    problem_response,
    status_for,
)

__all__ = [
    "FieldProblem",
    "Problem",
    "install_problem_handlers",
    "problem_response",
    "status_for",
]
