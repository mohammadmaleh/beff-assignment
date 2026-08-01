import type {
  ApiPathName,
  ConsentRequest,
  ConsentStateResponse,
  ExportJobResponse,
  JoinWaitlistRequest,
  LoginRequest,
  MetricsOverviewResponse,
  OnboardingResponse,
  RegisterRequest,
  SaveProgressRequest,
  ScrapByStepResponse,
  SessionResponse,
  SpecBandResponse,
  UserResponse,
  WaitlistEntryResponse,
} from './schema.js';

/**
 * Named aliases over the generated schema.
 *
 * The generated file is regenerated wholesale, so anything hand-written has to
 * live outside it. This module is the seam: the app imports these names, and a
 * backend rename shows up as a type error *here*, in one file, rather than in
 * twenty components at once.
 *
 * The aliases also translate transport names into app names —
 * `MetricsOverviewResponse` is what the wire calls it; `MetricsOverview` is what
 * the dashboard calls it.
 */
export type MetricsOverview = MetricsOverviewResponse;
export type ScrapByStep = ScrapByStepResponse;
export type SpecBandReading = SpecBandResponse;

export type OnboardingProgress = OnboardingResponse;
export type SaveProgress = SaveProgressRequest;

export type ConsentState = ConsentStateResponse;
export type ConsentChange = ConsentRequest;
export type ExportJob = ExportJobResponse;

export type Session = SessionResponse;
export type SessionUser = UserResponse;
export type Credentials = LoginRequest;
export type Registration = RegisterRequest;

export type WaitlistSignup = JoinWaitlistRequest;
export type WaitlistEntry = WaitlistEntryResponse;

/**
 * Every path the API serves, as a literal union.
 *
 * Narrowing a fetch helper to this makes a typo in a URL a compile error rather
 * than a 404 a user finds.
 */
export type ApiPath = ApiPathName;
