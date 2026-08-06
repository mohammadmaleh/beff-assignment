"""The failures onboarding can produce."""

from __future__ import annotations

from beff.core.errors import ConflictError, DomainValidationError

__all__ = [
    "OnboardingAlreadyCompleteError",
    "OnboardingIncompleteError",
    "UnknownStepError",
]


class UnknownStepError(DomainValidationError):
    """A step name the wizard does not have.

    The steps are a closed set in the schema (`current_step_allowed`), so this
    is caught before the database has to reject it - the CHECK constraint would
    otherwise surface as an opaque 500.
    """

    code = "onboarding.unknown_step"
    title = "Unknown onboarding step"

    def __init__(self, step: str, allowed: tuple[str, ...]) -> None:
        super().__init__(
            f"`{step}` is not an onboarding step.",
            extra={"step": step, "allowed": list(allowed)},
        )


class OnboardingIncompleteError(DomainValidationError):
    """Finishing was attempted with required answers still missing.

    The `extra` names them, so the client can send the user back to the right
    step instead of showing a generic failure on the last screen of a wizard
    they thought they had finished.
    """

    code = "onboarding.incomplete"
    title = "Onboarding is not finished"

    def __init__(self, missing: list[str]) -> None:
        super().__init__(
            "Some required answers are still missing.",
            extra={"missing": missing},
        )


class OnboardingAlreadyCompleteError(ConflictError):
    """Finishing twice.

    Not silently ignored: re-running completion would create a second plant and
    line from the same answers, and duplicate setup is worse than an error.
    """

    code = "onboarding.already_complete"
    title = "Onboarding is already finished"

    def __init__(self) -> None:
        super().__init__("Onboarding has already been completed.")
