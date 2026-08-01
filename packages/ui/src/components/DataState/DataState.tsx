import type { ReactNode } from 'react';

import { Alert, type AlertPrefixes } from '../Alert/index';

export interface DataStateProps {
  status: 'loading' | 'error' | 'ready';
  /** True when the request succeeded but there is nothing to show. */
  empty?: boolean;
  loadingLabel: string;
  /**
   * Every one of these is required and none has a default. The empty and error
   * titles used to fall back to English, which meant a German panel read
   * correctly right up until the request failed — the one moment the user most
   * needs to understand what happened.
   */
  emptyTitle: string;
  emptyBody?: ReactNode;
  errorTitle: string;
  errorBody?: ReactNode;
  /** Passed through to the {@link Alert} this renders in its error and empty states. */
  alertPrefixes: AlertPrefixes;
  /** Rendered only when the data is ready and non-empty. */
  children: ReactNode;
}

/**
 * Every data surface ships loading, empty, error and partial. Leaving them to
 * each screen is how three of the four quietly go missing — this makes the set
 * a type error to forget.
 *
 * The skeleton is a live region rather than a silent shimmer: a screen reader
 * user gets told the panel is loading, then told what arrived.
 */
export function DataState({
  status,
  empty = false,
  loadingLabel,
  emptyTitle,
  emptyBody,
  errorTitle,
  errorBody,
  alertPrefixes,
  children,
}: DataStateProps) {
  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        <span className="sr-only">{loadingLabel}</span>
        {/* Three bars, not a spinner — the shape hints at what is arriving. */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="bg-surface-sunken rounded-chamfer h-4 motion-safe:animate-pulse"
            style={{ inlineSize: `${String(100 - i * 18)}%` }}
          />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Alert tone="danger" title={errorTitle} prefixes={alertPrefixes}>
        {errorBody}
      </Alert>
    );
  }

  if (empty) {
    // Announced, because this replaces the loading live region. A successful
    // request with no rows is not an error — telling the user it is teaches
    // them to distrust every error the app shows.
    return (
      <Alert tone="info" announce title={emptyTitle} prefixes={alertPrefixes}>
        {emptyBody}
      </Alert>
    );
  }

  return <>{children}</>;
}
