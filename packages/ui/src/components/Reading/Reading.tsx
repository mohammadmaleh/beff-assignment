import { cx } from '../../lib/cx/index';
import { Display } from '../Display/index';

import type { ReactNode } from 'react';

export interface ReadingListProps {
  children: ReactNode;
  className?: string;
}

/**
 * The container a `Reading` belongs in.
 *
 * A `<dl>`, because each tile is a term and its description and that pairing is
 * the only thing telling a screen reader which figure the label belongs to. It
 * exists as a component rather than a note in a doc comment so the correct
 * markup is the easy thing to write.
 *
 * It supplies no layout. How many columns a set of readings wants depends on
 * how many there are and what surface they sit on, and a default grid here
 * would be a guess that ships.
 */
export function ReadingList({ children, className }: ReadingListProps) {
  return <dl className={cx('m-0', className)}>{children}</dl>;
}

export interface ReadingProps {
  label: string;
  /** Pre-formatted. The library does not know the page's locale. */
  value: string;
  /** What the figure is measured against, or what it is a count of. */
  note?: string;
  className?: string;
}

/**
 * A stated figure - one that has neither a specification window nor a direction
 * of travel.
 *
 * ## Why this is a third primitive and not a variant of the other two
 *
 * `SpecBand` is a measurement against a limit. `Metric` is a measurement with a
 * direction of travel. Some of the most important readings on a dashboard are
 * neither, and dressing them as either is a lie about the reading rather than a
 * cosmetic choice:
 *
 * - "€47 200 of committed value lost" has no specification window, and no
 *   meaningful previous-period arrow - it scales with how much the line ran.
 * - "2.3 pp below the cohort median" is a *reference*, not a measurement. A
 *   pilot line at 71.8% is comfortably inside a 40–80% window and still behind
 *   its peers, and those two facts lead to different decisions.
 *
 * So the figure is stated plainly, with a sentence saying what it is. The note
 * is what separates this from a bare number: a benchmark rendered without its
 * sample size reads as a measurement of something, and with it reads as what it
 * is.
 *
 * ## Where the markup came from
 *
 * `apps/web`'s `KpiRow`, which had carried it since the dashboard was built -
 * along with a doc comment arguing at length why these readings are neither
 * `Metric` nor `SpecBand`. That argument was right and was the case for this
 * component: the only place deciding how a stated figure looks was an app file,
 * so the next one would have been styled from scratch.
 */
export function Reading({ label, value, note, className }: ReadingProps) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <dt className="text-text-muted text-[length:var(--type-ui-size-sm)]">{label}</dt>
      {/* `m-0` because a UA stylesheet indents `dd` by 40px, which would set
          every figure off its own label. */}
      <dd className="m-0 flex flex-col gap-1">
        {/* `Display`, not a class string, so the figure sits on the one type
            scale rather than on a spelling of it that can drift. */}
        <Display as="span" size="xl" className="text-text-default tabular-nums">
          {value}
        </Display>
        {note ? (
          <span className="text-text-muted text-[length:var(--type-ui-size-sm)]">{note}</span>
        ) : null}
      </dd>
    </div>
  );
}
