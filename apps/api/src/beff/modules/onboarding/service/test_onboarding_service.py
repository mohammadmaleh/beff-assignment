"""Unit tests for the resumable wizard."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from beff.modules.onboarding.errors import (
    OnboardingAlreadyCompleteError,
    OnboardingIncompleteError,
    UnknownStepError,
)
from beff.modules.onboarding.repository import (
    InMemoryOnboardingRepository,
    InMemorySetupRepository,
)
from beff.modules.onboarding.service import OnboardingService

USER: UUID = uuid4()

COMPLETE_ANSWERS = {
    "role": "process_engineer",
    "plant_name": "Werk Süd",
    "plant_country": "DE",
    "line_name": "Pilotlinie 1",
    "line_kind": "pilot",
    "cell_format": "pouch",
    "unit_system": "metric",
}


@pytest.fixture
def progress() -> InMemoryOnboardingRepository:
    return InMemoryOnboardingRepository()


@pytest.fixture
def setup() -> InMemorySetupRepository:
    return InMemorySetupRepository()


@pytest.fixture
def service(
    progress: InMemoryOnboardingRepository, setup: InMemorySetupRepository
) -> OnboardingService:
    return OnboardingService(progress, setup)


# ── Starting and resuming ────────────────────────────────────────────────────


async def test_a_first_visit_starts_at_the_first_step(service: OnboardingService) -> None:
    state = await service.get(USER)

    assert state.current_step == "role"
    assert state.answers == {}
    assert state.completed_at is None


async def test_getting_twice_does_not_create_a_second_row(
    service: OnboardingService, progress: InMemoryOnboardingRepository
) -> None:
    await service.get(USER)
    await service.get(USER)

    assert len(progress.rows) == 1


async def test_progress_survives_being_reloaded(service: OnboardingService) -> None:
    """The ENG-30 verification, at the service level.

    The server owns the position. A client that remembered its own would resume
    correctly only on the device that recorded it.
    """
    await service.save(USER, current_step="lines", answers={"role": "quality_engineer"})

    resumed = await service.get(USER)

    assert resumed.current_step == "lines"
    assert resumed.answers["role"] == "quality_engineer"


async def test_two_users_do_not_share_progress(service: OnboardingService) -> None:
    other = uuid4()
    await service.save(USER, current_step="plant", answers={"role": "other"})

    assert (await service.get(other)).current_step == "role"


# ── Saving ───────────────────────────────────────────────────────────────────


async def test_answers_are_merged_not_replaced(service: OnboardingService) -> None:
    """A later client sending a partial update must not erase what it does not
    know about."""
    await service.save(USER, current_step="plant", answers={"role": "process_engineer"})

    await service.save(USER, current_step="lines", answers={"plant_name": "Werk Süd"})

    answers = (await service.get(USER)).answers
    assert answers["role"] == "process_engineer"
    assert answers["plant_name"] == "Werk Süd"


async def test_an_unknown_step_is_a_validation_error(service: OnboardingService) -> None:
    """Caught before the database's CHECK constraint, which would surface as an
    opaque 500."""
    with pytest.raises(UnknownStepError):
        await service.save(USER, current_step="not-a-step", answers={})


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("role", "chief_vibes_officer"),
        ("line_kind", "experimental"),
        ("cell_format", "spherical"),
        ("unit_system", "furlongs"),
    ],
)
async def test_an_invalid_enum_answer_is_dropped_not_stored(
    service: OnboardingService, key: str, value: str
) -> None:
    """Dropped rather than raised: one bad enum from a stale client should not
    cost the user the other answers they just typed."""
    await service.save(USER, current_step="lines", answers={key: value, "plant_name": "Werk Süd"})

    answers = (await service.get(USER)).answers
    assert key not in answers
    assert answers["plant_name"] == "Werk Süd"


# ── Completing ───────────────────────────────────────────────────────────────


async def test_completing_creates_the_plant_and_the_line(
    service: OnboardingService, setup: InMemorySetupRepository
) -> None:
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)

    await service.complete(USER)

    assert setup.plants[0].name == "Werk Süd"
    assert setup.plants[0].country_code == "DE"
    assert setup.lines[0].name == "Pilotlinie 1"
    assert setup.lines[0].cell_format == "pouch"


async def test_a_pilot_line_is_recorded_as_one(
    service: OnboardingService, setup: InMemorySetupRepository
) -> None:
    """40-80% first-pass yield is normal on a pilot line and alarming on a
    production one. Without the flag the dashboard cannot read its own number."""
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)

    await service.complete(USER)

    assert setup.lines[0].is_pilot_line is True


async def test_a_production_line_is_not_flagged_as_pilot(
    service: OnboardingService, setup: InMemorySetupRepository
) -> None:
    await service.save(
        USER, current_step="review", answers={**COMPLETE_ANSWERS, "line_kind": "production"}
    )

    await service.complete(USER)

    assert setup.lines[0].is_pilot_line is False


async def test_a_lowercase_country_is_folded_to_the_schema_constraint(
    service: OnboardingService, setup: InMemorySetupRepository
) -> None:
    """`country_code ~ '^[A-Z]{2}$'`. Folding here means a client sending `de`
    gets a plant rather than a 500."""
    await service.save(
        USER, current_step="review", answers={**COMPLETE_ANSWERS, "plant_country": "de"}
    )

    await service.complete(USER)

    assert setup.plants[0].country_code == "DE"


async def test_completing_marks_the_wizard_finished(service: OnboardingService) -> None:
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)

    finished = await service.complete(USER)

    assert finished.completed_at is not None
    assert finished.is_complete


async def test_completing_with_answers_missing_names_them(service: OnboardingService) -> None:
    await service.save(USER, current_step="review", answers={"role": "process_engineer"})

    with pytest.raises(OnboardingIncompleteError) as raised:
        await service.complete(USER)

    # Named, so the client can send the user back to the right step instead of
    # showing a generic failure on the last screen of a wizard they thought they
    # had finished.
    assert raised.value.extra["missing"] == [
        "plant_name",
        "plant_country",
        "line_name",
        "line_kind",
        "cell_format",
        "unit_system",
    ]


async def test_a_blank_answer_counts_as_missing(service: OnboardingService) -> None:
    """Otherwise a plant called `"   "` reaches the `name_not_blank` constraint."""
    await service.save(
        USER, current_step="review", answers={**COMPLETE_ANSWERS, "plant_name": "   "}
    )

    with pytest.raises(OnboardingIncompleteError) as raised:
        await service.complete(USER)

    assert raised.value.extra["missing"] == ["plant_name"]


async def test_completing_twice_is_refused(service: OnboardingService) -> None:
    """Not ignored. Re-running would create a second plant and line from the same
    answers, and duplicate setup is worse than a readable error."""
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)
    await service.complete(USER)

    with pytest.raises(OnboardingAlreadyCompleteError):
        await service.complete(USER)


async def test_completing_twice_creates_nothing_the_second_time(
    service: OnboardingService, setup: InMemorySetupRepository
) -> None:
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)
    await service.complete(USER)

    with pytest.raises(OnboardingAlreadyCompleteError):
        await service.complete(USER)

    assert len(setup.plants) == 1
    assert len(setup.lines) == 1


async def test_a_finished_wizard_cannot_be_edited(service: OnboardingService) -> None:
    await service.save(USER, current_step="review", answers=COMPLETE_ANSWERS)
    await service.complete(USER)

    with pytest.raises(OnboardingAlreadyCompleteError):
        await service.save(USER, current_step="plant", answers={"plant_name": "Somewhere else"})
