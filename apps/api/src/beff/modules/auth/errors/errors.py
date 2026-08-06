"""The failures the auth module can produce.

Note what these do *not* say. `InvalidCredentialsError` covers both "no such
account" and "wrong password", with one message, because distinguishing them
hands an attacker a free account-enumeration oracle — and the same reasoning is
why the service burns equivalent CPU time on the missing-user path.
"""

from __future__ import annotations

from beff.core.errors import AuthenticationError, ConflictError, DomainValidationError

__all__ = [
    "AccessTokenInvalidError",
    "EmailAlreadyRegisteredError",
    "EmailAlreadyVerifiedError",
    "InvalidCredentialsError",
    "RefreshTokenExpiredError",
    "RefreshTokenInvalidError",
    "RefreshTokenMissingError",
    "RefreshTokenReusedError",
    "VerificationTokenExpiredError",
    "VerificationTokenInvalidError",
]


class InvalidCredentialsError(AuthenticationError):
    """Wrong password, or no such account. Deliberately indistinguishable."""

    code = "auth.invalid_credentials"
    title = "Incorrect email or password"

    def __init__(self, detail: str = "Incorrect email or password.") -> None:
        super().__init__(detail)


class EmailAlreadyRegisteredError(ConflictError):
    """Registration collided with a live account.

    This one *does* leak that an address is registered, which is unavoidable:
    the alternative is silently not creating the account. The mitigation is at
    the transport layer (rate limiting), not by lying to the caller.
    """

    code = "auth.email_already_registered"
    title = "Email already registered"

    def __init__(self, detail: str = "That email address is already registered.") -> None:
        super().__init__(detail)


class RefreshTokenMissingError(AuthenticationError):
    """No refresh cookie was presented at all."""

    code = "auth.refresh_token_missing"
    title = "No session"

    def __init__(self, detail: str = "No refresh token was presented.") -> None:
        super().__init__(detail)


class RefreshTokenInvalidError(AuthenticationError):
    """The token is unknown, or its family has already been revoked."""

    code = "auth.refresh_token_invalid"
    title = "Session is no longer valid"

    def __init__(self, detail: str = "The refresh token is not valid.") -> None:
        super().__init__(detail)


class RefreshTokenExpiredError(AuthenticationError):
    """The token was genuine and has aged out. Sign in again."""

    code = "auth.refresh_token_expired"
    title = "Session expired"

    def __init__(self, detail: str = "The refresh token has expired.") -> None:
        super().__init__(detail)


class RefreshTokenReusedError(AuthenticationError):
    """A spent token was presented again, and the family has been revoked.

    Distinct from `RefreshTokenInvalidError` on purpose. The client cannot
    recover by refreshing and must sign in again, and the frontend should say
    so — "you were signed out for your security" rather than a generic error.
    """

    code = "auth.refresh_token_reused"
    title = "Session revoked"

    def __init__(
        self,
        detail: str = (
            "This session was ended because an already-used refresh token was "
            "presented again. Sign in again."
        ),
    ) -> None:
        super().__init__(detail)


class VerificationTokenInvalidError(DomainValidationError):
    """The verification link is unknown, malformed or already spent.

    One error for three causes, deliberately. Distinguishing "no such token"
    from "already used" tells anyone holding a guessed token whether they got
    close, and there is nothing the legitimate holder of a spent link can do
    differently on being told which it was — the answer in both cases is to ask
    for a new one.

    A 422 rather than a 401: the caller is not failing to authenticate, they are
    presenting a value that is not acceptable. Verification never signs anyone
    in.
    """

    code = "auth.verification_token_invalid"
    title = "This link is no longer valid"

    def __init__(
        self,
        detail: str = ("This confirmation link is not valid or has already been used."),
    ) -> None:
        super().__init__(detail)


class VerificationTokenExpiredError(DomainValidationError):
    """The link was genuine and has aged out.

    Distinct from invalid, and the distinction is safe to make: expiry is a
    property of a token the holder demonstrably had, so it reveals nothing a
    guesser could use. It is worth making because the recovery is different —
    "ask for a new one", not "check the link you followed".
    """

    code = "auth.verification_token_expired"
    title = "This link has expired"

    def __init__(
        self,
        detail: str = "This confirmation link has expired. Request a new one.",
    ) -> None:
        super().__init__(detail)


class EmailAlreadyVerifiedError(ConflictError):
    """A resend was asked for by someone who does not need one.

    Only ever raised for the *authenticated* caller's own address, so it leaks
    nothing: they can already see their own verification state.
    """

    code = "auth.email_already_verified"
    title = "Already confirmed"

    def __init__(self, detail: str = "That address has already been confirmed.") -> None:
        super().__init__(detail)


class AccessTokenInvalidError(AuthenticationError):
    """The bearer token is missing, malformed, expired or wrongly signed."""

    code = "auth.access_token_invalid"
    title = "Not authenticated"

    def __init__(self, detail: str = "The access token is missing or not valid.") -> None:
        super().__init__(detail)
