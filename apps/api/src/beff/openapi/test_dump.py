"""The schema dump is a build artefact the frontend compiles against.

`packages/api-client` is generated from this document, so it is not
documentation - it is a source file with an unusual producer. What matters is
that two runs on two machines produce byte-identical output, because the drift
check is a `git diff`: any instability turns "the API changed" into a signal
nobody can trust, and the usual response to a check that cries wolf is to delete
it.
"""

from __future__ import annotations

import json

from beff.openapi.dump import schema, schema_json


def test_the_schema_is_the_document_fastapi_would_serve() -> None:
    document = schema()

    assert document["info"]["title"] == "Beff API"
    assert "/healthz" in document["paths"]
    assert document["openapi"].startswith("3.")


def test_the_serialisation_is_stable_across_runs() -> None:
    """Byte-for-byte, not merely equivalent.

    `sort_keys` is what makes this true: without it a dict iteration order that
    happens to differ between Python versions reads as an API change and fails a
    build that should have passed.
    """
    assert schema_json() == schema_json()


def test_keys_are_sorted_so_a_diff_means_something() -> None:
    document = json.loads(schema_json())
    rendered = schema_json()

    for section in ("info", "openapi", "paths"):
        assert f'"{section}"' in rendered
    assert list(document["paths"]) == sorted(document["paths"])


def test_the_output_ends_in_a_newline() -> None:
    """Every other file in the repo has one, and its absence would show up as
    noise in every diff of a file nobody edits by hand."""
    assert schema_json().endswith("}\n")


def test_non_ascii_survives_unescaped() -> None:
    """`ensure_ascii=False`. The API's German strings are in this document, and
    `\\u00fc` in a generated client is unreadable in exactly the place a human
    goes to check what a field means."""
    rendered = schema_json()

    assert "\\u" not in rendered
    assert json.loads(rendered) == schema()
