"""The background worker.

One process, one loop, polling a Postgres table. There is no Redis and no
Celery — at pre-launch volume a table with `SELECT ... FOR UPDATE SKIP LOCKED`
already provides persistence, retries, idempotency and a dead-letter path,
without a second datastore to run, deploy and monitor (ADR-0006).
"""

from beff.worker.runner import WorkerSettings, run_forever, run_once

__all__ = ["WorkerSettings", "run_forever", "run_once"]
