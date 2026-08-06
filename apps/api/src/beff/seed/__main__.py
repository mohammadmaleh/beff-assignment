"""`python -m beff.seed` - the entry point compose runs after migrating.

Without this file, `python -m beff.seed` fails with "'beff.seed' is a package
and cannot be directly executed": the `if __name__ == "__main__"` guard inside
`seed.py` only fires for `python -m beff.seed.seed`, which is not the command
anyone would guess.
"""

import asyncio

from beff.seed.seed import main

asyncio.run(main())
