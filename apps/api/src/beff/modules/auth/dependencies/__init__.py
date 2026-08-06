"""FastAPI dependencies for the auth module."""

from beff.modules.auth.dependencies.limits import (
    LOGIN_LIMIT,
    REGISTER_LIMIT,
    RESEND_VERIFICATION_LIMIT,
    login_rate_limit,
    register_rate_limit,
    resend_verification_rate_limit,
)
from beff.modules.auth.dependencies.locale import (
    FALLBACK_EMAIL_LOCALE,
    negotiate_email_locale,
    resolve_email_locale,
)
from beff.modules.auth.dependencies.providers import (
    CurrentUser,
    Service,
    VerificationService,
    get_auth_service,
    get_current_user,
    get_verification_service,
)

__all__ = [
    "FALLBACK_EMAIL_LOCALE",
    "LOGIN_LIMIT",
    "REGISTER_LIMIT",
    "RESEND_VERIFICATION_LIMIT",
    "CurrentUser",
    "Service",
    "VerificationService",
    "get_auth_service",
    "get_current_user",
    "get_verification_service",
    "login_rate_limit",
    "negotiate_email_locale",
    "register_rate_limit",
    "resend_verification_rate_limit",
    "resolve_email_locale",
]
