"""Waitlist - pre-launch signups from the landing page.

A waitlist entry is **not a user** (CONTEXT.md): no credentials, no access, its
own table. The legal basis is consent, so the policy version is stored with the
address.

Public API of the module. `main.py` wires what this barrel exports.
"""

from beff.modules.waitlist.models import WaitlistEntry
from beff.modules.waitlist.router import router as waitlist_router

__all__ = ["WaitlistEntry", "waitlist_router"]
