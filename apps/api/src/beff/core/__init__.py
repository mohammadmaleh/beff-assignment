"""Cross-cutting infrastructure shared by every domain module.

Nothing in here knows about a specific domain. Domain modules depend on `core`;
`core` never depends on a domain module.
"""

__all__: list[str] = []
