"""The onboarding SQL, against a real PostgreSQL.

`OnboardingService` is unit-tested against a fake, which covers the step machine.
What it cannot cover is the pair of guarantees underneath it:

- `uq_onboarding_progress_user_id` — one row per user, enforced by the database
  rather than by `upsert` remembering to look first.
- `first_line_for_user`, which reaches the user through `plants` and is therefore
  the query where a missing filter is easiest to write and hardest to see. It is
  also the default the dashboard opens on, so a wrong answer here is somebody
  else's production line on your screen.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from beff.modules.auth.models import User
from beff.modules.onboarding.models import Line, OnboardingProgress, Plant
from beff.modules.onboarding.repository import (
    PostgresOnboardingRepository,
    PostgresSetupRepository,
)

pytestmark = pytest.mark.integration

NOW = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)


async def make_user(session: AsyncSession, email: str = "operator@beff.example") -> User:
    user = User(email=email, password_hash="x", display_name="Operator", role="member")
    session.add(user)
    await session.flush()
    return user


async def test_progress_starts_absent_and_is_read_back_after_upsert(
    db_session: AsyncSession,
) -> None:
    user = await make_user(db_session)
    repository = PostgresOnboardingRepository(db_session)

    assert await repository.get_for_user(user.id) is None

    await repository.upsert(
        OnboardingProgress(
            user_id=user.id, current_step="plant", answers={"role": "quality_engineer"}
        )
    )

    stored = await repository.get_for_user(user.id)
    assert stored is not None
    assert stored.current_step == "plant"
    assert stored.answers == {"role": "quality_engineer"}
    assert stored.completed_at is None


async def test_upserting_a_row_already_in_the_session_updates_it(
    db_session: AsyncSession,
) -> None:
    """The second call is an `UPDATE`, not a second `INSERT`.

    `upsert` adds only when the instance is not already tracked; a wrong check
    there produces a unique-violation on the ordinary path of somebody
    advancing one step.
    """
    user = await make_user(db_session)
    repository = PostgresOnboardingRepository(db_session)
    progress = await repository.upsert(
        OnboardingProgress(user_id=user.id, current_step="plant", answers={})
    )

    progress.current_step = "review"
    progress.completed_at = NOW
    await repository.upsert(progress)

    stored = await repository.get_for_user(user.id)
    assert stored is not None
    assert stored.id == progress.id
    assert stored.current_step == "review"
    assert stored.completed_at == NOW


async def test_a_user_cannot_have_two_progress_rows(db_session: AsyncSession) -> None:
    """`uq_onboarding_progress_user_id` is what actually guarantees it — the
    check inside `upsert` is the courtesy that keeps the common path off the
    error handler."""
    user = await make_user(db_session)
    db_session.add(OnboardingProgress(user_id=user.id, current_step="plant", answers={}))
    await db_session.flush()

    db_session.add(OnboardingProgress(user_id=user.id, current_step="lines", answers={}))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_progress_is_scoped_to_its_own_user(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    other = await make_user(db_session, email="other@beff.example")
    repository = PostgresOnboardingRepository(db_session)
    await repository.upsert(OnboardingProgress(user_id=other.id, current_step="review", answers={}))

    assert await repository.get_for_user(user.id) is None


async def test_a_plant_and_its_lines_are_persisted_with_their_identifiers(
    db_session: AsyncSession,
) -> None:
    user = await make_user(db_session)
    repository = PostgresSetupRepository(db_session)

    plant = await repository.add_plant(Plant(user_id=user.id, name="Werk Süd", country_code="DE"))
    assert plant.id is not None

    line = await repository.add_line(
        Line(plant_id=plant.id, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=True)
    )
    assert line.id is not None
    assert line.plant_id == plant.id


async def test_the_first_line_is_the_first_one_set_up(db_session: AsyncSession) -> None:
    """Ordered by id, so the answer is "the first line they set up" rather than
    "whichever row the planner returned first". An unordered `LIMIT 1` is a bug
    that only appears once the table is big enough to be scanned differently."""
    user = await make_user(db_session)
    repository = PostgresSetupRepository(db_session)
    plant = await repository.add_plant(Plant(user_id=user.id, name="Werk Süd", country_code="DE"))
    first = await repository.add_line(
        Line(plant_id=plant.id, name="Pilotlinie 1", cell_format="pouch", is_pilot_line=True)
    )
    await repository.add_line(
        Line(plant_id=plant.id, name="Serienlinie 2", cell_format="prismatic", is_pilot_line=False)
    )

    found = await repository.first_line_for_user(user.id)

    assert found is not None
    assert found.id == first.id


async def test_the_first_line_is_never_another_accounts(db_session: AsyncSession) -> None:
    """`lines` has no `user_id` — it reaches the account through `plants`.

    That join is the filter, and dropping it hands the dashboard somebody else's
    production line as its default view.
    """
    user = await make_user(db_session)
    stranger = await make_user(db_session, email="stranger@beff.example")
    repository = PostgresSetupRepository(db_session)
    foreign_plant = await repository.add_plant(
        Plant(user_id=stranger.id, name="Fremdes Werk", country_code="PL")
    )
    await repository.add_line(
        Line(
            plant_id=foreign_plant.id,
            name="Fremde Linie",
            cell_format="cylindrical",
            is_pilot_line=False,
        )
    )

    assert await repository.first_line_for_user(user.id) is None
    assert await repository.first_line_for_user(uuid4()) is None
