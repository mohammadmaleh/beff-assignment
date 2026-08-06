/**
 * GENERATED FILE - do not edit.
 *
 * Produced from the API's own OpenAPI document by
 * `pnpm --filter @beff/api-client generate`. CI runs `check:drift`, so both
 * editing this by hand and forgetting to regenerate fail the build.
 */

/**
 * What comparable lines achieve.
 *
 * `sample_size` is part of the contract, not decoration. A benchmark rendered
 * without its n reads as a measurement of something; the UI states "34 pilot
 * lines" beside it so it reads as what it is.
 */
export type CohortReferenceResponse = {
  co2_intensity_p50_kg_per_kwh: number;
  first_pass_yield_p50_pct: number;
  first_pass_yield_p90_pct: number;
  line_kind: string;
  sample_size: number;
  scrap_rate_p50_pct: number;
};

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
 * - it is evidence held for accountability, not something the profile screen
 * needs to render, and the full history is available through an export.
 */
export type ConsentStateResponse = {
  analytics: boolean;
  marketing: boolean;
};

/**
 * The outcome of redeeming a link.
 *
 * Carries the user, so the profile screen can update without a second round
 * trip - and so a caller who was already signed in when they followed the link
 * sees the new state immediately rather than after the next refresh.
 */
export type EmailVerificationResponse = {
  user: UserResponse;
  /** Always `true`; a failure is a problem response, not this. */
  verified: boolean;
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
 * The series behind the charts, in one request.
 *
 * Separate from the overview by design - see `MetricsTrend`. The overview is
 * what the page needs for its first useful pixel; this is sixty batches, and
 * putting it in the same payload would make the headline wait on data it does
 * not use.
 */
export type MetricsTrendResponse = {
  benchmark: CohortReferenceResponse;
  best_batch_code: string | null;
  line_kind: string;
  line_name: string;
  parameters: ParameterSeriesResponse[];
  points: TrendPointResponse[];
  total_cells_passed: number;
  total_cells_scrapped: number;
  total_cells_started: number;
  total_committed_value_lost_eur: number;
  window_days: number;
  window_first_pass_yield_pct: number;
  worst_batch_code: string | null;
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

export type ParameterPointResponse = {
  started_at: string;
  value: number;
};

export type ParameterSeriesResponse = {
  lower_limit: number;
  parameter: string;
  points: ParameterPointResponse[];
  target: number | null;
  unit: string;
  upper_limit: number;
};

/**
 * A new account.
 */
export type RegisterRequest = {
  display_name: string;
  email: string;
  /** Language for the confirmation email. Negotiated from Accept-Language if omitted. */
  locale?: "en" | "de" | null;
  password: string;
};

/**
 * Ask for another confirmation link.
 *
 * No email field: the address is the authenticated caller's own. Taking one
 * from the body would make this an oracle that reports, to anyone with any
 * account, whether a *given* address is registered and unconfirmed.
 */
export type ResendVerificationRequest = {
  /** Language for the confirmation email. Negotiated from Accept-Language if omitted. */
  locale?: "en" | "de" | null;
};

/**
 * Acknowledgement that a message is queued.
 *
 * Not "sent". The outbox is drained by a worker, so the API cannot honestly
 * claim delivery at the moment it answers - and a client that shows "sent"
 * against a queue that later dead-letters has told the user something false.
 */
export type ResendVerificationResponse = {
  /** Always `true`; the message is on the queue, not yet sent. */
  queued: boolean;
  /** The address it will go to - the caller's own. */
  recipient: string;
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

export type TrendPointResponse = {
  batch_code: string;
  capacity_retention_pct: number;
  cells_passed: number;
  cells_scrapped: number;
  cells_started: number;
  co2_intensity_kg_per_kwh: number;
  committed_value_lost_eur: number;
  first_pass_yield_pct: number;
  scrap_rate_pct: number;
  started_at: string;
};

/**
 * A user as the owner of that account sees themselves.
 *
 * No `password_hash`, and no `deleted_at` - the first is a credential and the
 * second is internal bookkeeping.
 */
export type UserResponse = {
  created_at: string;
  display_name: string;
  email: string;
  email_verified_at?: string | null;
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
 * Redeem a confirmation link.
 *
 * A POST with the token in the body, not a GET with it in the path. Three
 * reasons, and the third is the one that decides it: a GET is retried by
 * proxies and prefetched by mail clients, tokens in a URL end up in server
 * logs and `Referer` headers, and a GET that changes state is wrong anyway.
 * The page reads the token out of the query string and posts it.
 */
export type VerifyEmailRequest = {
  token: string;
};

/**
 * Confirmation that the signup landed.
 *
 * The email is echoed back so the client can show *which* address it was sent
 * to, which is the one thing someone who mistyped needs to see. Nothing else
 * about the row is exposed - the id is internal and there is no endpoint that
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
  | "/api/v1/auth/verify-email"
  | "/api/v1/auth/verify-email/resend"
  | "/api/v1/metrics/overview"
  | "/api/v1/metrics/trend"
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
    CohortReferenceResponse: CohortReferenceResponse;
    ConsentRequest: ConsentRequest;
    ConsentStateResponse: ConsentStateResponse;
    EmailVerificationResponse: EmailVerificationResponse;
    ExportJobResponse: ExportJobResponse;
    HTTPValidationError: HTTPValidationError;
    JoinWaitlistRequest: JoinWaitlistRequest;
    LoginRequest: LoginRequest;
    MetricsOverviewResponse: MetricsOverviewResponse;
    MetricsTrendResponse: MetricsTrendResponse;
    OnboardingResponse: OnboardingResponse;
    ParameterPointResponse: ParameterPointResponse;
    ParameterSeriesResponse: ParameterSeriesResponse;
    RegisterRequest: RegisterRequest;
    ResendVerificationRequest: ResendVerificationRequest;
    ResendVerificationResponse: ResendVerificationResponse;
    SaveProgressRequest: SaveProgressRequest;
    ScrapByStepResponse: ScrapByStepResponse;
    SessionResponse: SessionResponse;
    SpecBandResponse: SpecBandResponse;
    TrendPointResponse: TrendPointResponse;
    UserResponse: UserResponse;
    ValidationError: ValidationError;
    VerifyEmailRequest: VerifyEmailRequest;
    WaitlistEntryResponse: WaitlistEntryResponse;
  };
}
