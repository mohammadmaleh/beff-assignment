import { Eyebrow } from '@beff/ui/eyebrow';

import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { PROCESS_STEPS, type ProcessStep } from '@/lib/metrics';

export interface ChainMarkerProps {
  /** The step this section boundary sits at. Its number comes from the order. */
  step: ProcessStep;
  locale: Locale;
}

/**
 * ## The chain as the page's structure
 *
 * A section boundary that says where in the production chain it sits: the step's
 * ordinal, its name, then the rule.
 *
 * The numbering is **earned**, which is the only reason it is here. `01`–`12` on
 * a landing page is usually decoration borrowed from a template, and the design
 * brief says so; here the steps are a real typed sequence where position
 * determines cost, and that sequence is the argument the page is making. The
 * ordinal is derived from `PROCESS_STEPS` rather than written by hand, so it
 * cannot disagree with the order the rest of the product uses.
 *
 * The name is read from the dashboard's own step dictionary - the same strings
 * the authenticated app labels its chart with, so the marketing page and the
 * product cannot describe the same step differently.
 */
export function ChainMarker({ step, locale }: ChainMarkerProps) {
  const t = getDictionary(locale);
  const steps = t.dashboard.steps;
  const ordinal = String(PROCESS_STEPS.indexOf(step) + 1).padStart(2, '0');

  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tabular-nums">
        {ordinal}
      </span>
      <Eyebrow as="span">{translate(steps, step)}</Eyebrow>
      <span className="bg-border-default h-px flex-1" />
    </div>
  );
}
