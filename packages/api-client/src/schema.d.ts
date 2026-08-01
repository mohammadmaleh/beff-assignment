/**
 * GENERATED FILE — do not edit.
 *
 * Produced from the API's own OpenAPI document by
 * `pnpm --filter @beff/api-client generate`. CI runs `check:drift`, so both
 * editing this by hand and forgetting to regenerate fail the build.
 */

/**
 * A grant or a withdrawal.
 *
 * One purpose per request, because consent must be *specific* (Art. 4(11)). A
 * payload that accepted a list would let a client send one "I agree" covering
 * everything, which is exactly the shape the law rejects.
 */
export type ConsentRequest = {
  granted: boolean;
  purpose: string;
};

/**
 * Current consent per manageable purpose.
 *
 * The *state*, derived from the append-only log. The log itself is not exposed
 * — it is evidence held for accountability, not something the profile screen
 * needs to render, and the full history is available through an export.
 */
export type ConsentStateResponse = {
  analytics: boolean;
  marketing: boolean;
};

export type ExportJobResponse = {
  completed_at: string | null;
  download_path: string | null;
  id: string;
  requested_at: string;
  status: string;
};

export type HTTPValidationError = {
  detail?: ValidationError[];
};

/**
 * A pre-launch signup.
 *
 * The field names match what the landing form posts, and the validation errors
 * come back keyed by them so the client can render an inline message against
 * the right input.
 */
export type JoinWaitlistRequest = {
  company: string;
  email: string;
};

/**
 * An existing account.
 */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * Everything the dashboard renders, in one request.
 *
 * One round trip rather than four: the four headline tiles, the breakdown and
 * the bands are read together or not at all, and splitting them would put
 * three extra waterfalls in front of the first paint for no reuse.
 */
export type MetricsOverviewResponse = {
  capacity_retention_pct: number;
  co2_intensity_kg_per_kwh: number;
  first_pass_yield_delta_pp: number;
  first_pass_yield_pct: number;
  line_kind: string;
  line_name: string;
  scrap_by_step: ScrapByStepResponse[];
  scrap_rate_delta_pp: number;
  scrap_rate_pct: number;
  spec_bands: SpecBandResponse[];
  window_days: number;
};

/**
 * The whole wizard state, in one shape the client can render from cold.
 *
 * `steps` and `missing` are sent rather than hard-coded in the client so that
 * adding a step is a backend change. A client with its own copy of the step
 * list is a client that disagrees with the server about where the user is.
 */
export type OnboardingResponse = {
  answers: Record<string, unknown>;
  completed_at: string | null;
  current_step: string;
  missing?: string[];
  steps?: string[];
};

/**
 * A new account.
 */
export type RegisterRequest = {
  display_name: string;
  email: string;
  password: string;
};

/**
 * Where the user is, and what they have answered so far.
 */
export type SaveProgressRequest = {
  answers?: Record<string, unknown>;
  current_step: string;
};

export type ScrapByStepResponse = {
  committed_value_eur: number;
  process_step: string;
  scrap_rate_pct: number;
};

/**
 * What register, login and refresh all return.
 */
export type SessionResponse = {
  access_token: string;
  /** Access-token lifetime in seconds. */
  expires_in: number;
  /** Always `bearer`, per RFC 6750. */
  token_type?: string;
  user: UserResponse;
};

export type SpecBandResponse = {
  lower_limit: number;
  parameter: string;
  target: number | null;
  unit: string;
  upper_limit: number;
  value: number;
};

/**
 * A user as the owner of that account sees themselves.
 *
 * No `password_hash`, and no `deleted_at` — the first is a credential and the
 * second is internal bookkeeping.
 */
export type UserResponse = {
  created_at: string;
  display_name: string;
  email: string;
  id: string;
  role: string;
};

export type ValidationError = {
  ctx?: Record<string, unknown>;
  input?: unknown;
  loc: (string | number)[];
  msg: string;
  type: string;
};

/**
 * Confirmation that the signup landed.
 *
 * The email is echoed back so the client can show *which* address it was sent
 * to, which is the one thing someone who mistyped needs to see. Nothing else
 * about the row is exposed — the id is internal and there is no endpoint that
 * takes it.
 */
export type WaitlistEntryResponse = {
  company: string;
  created_at: string;
  email: string;
};

export type ApiPathName =
  | "/api/v1/auth/login"
  | "/api/v1/auth/logout"
  | "/api/v1/auth/me"
  | "/api/v1/auth/refresh"
  | "/api/v1/auth/register"
  | "/api/v1/metrics/overview"
  | "/api/v1/onboarding"
  | "/api/v1/onboarding/complete"
  | "/api/v1/privacy/consent"
  | "/api/v1/privacy/erasure"
  | "/api/v1/privacy/export"
  | "/api/v1/privacy/export/{job_id}/download"
  | "/api/v1/waitlist"
  | "/healthz"
  | "/readyz";

export interface components {
  schemas: {
    ConsentRequest: ConsentRequest;
    ConsentStateResponse: ConsentStateResponse;
    ExportJobResponse: ExportJobResponse;
    HTTPValidationError: HTTPValidationError;
    JoinWaitlistRequest: JoinWaitlistRequest;
    LoginRequest: LoginRequest;
    MetricsOverviewResponse: MetricsOverviewResponse;
    OnboardingResponse: OnboardingResponse;
    RegisterRequest: RegisterRequest;
    SaveProgressRequest: SaveProgressRequest;
    ScrapByStepResponse: ScrapByStepResponse;
    SessionResponse: SessionResponse;
    SpecBandResponse: SpecBandResponse;
    UserResponse: UserResponse;
    ValidationError: ValidationError;
    WaitlistEntryResponse: WaitlistEntryResponse;
  };
}
