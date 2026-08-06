'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cx } from '../../lib/cx/index';

export interface InfoHintProps {
  /**
   * The trigger's accessible name — required, and with no default.
   *
   * The glyph is `aria-hidden`, so this string is the button's *entire*
   * announced identity. A default here would be an English one, and this
   * package cannot know the page's language: the same rule, for the same
   * reason, as `SpecBand`'s readout and `ChartFigure`'s caption.
   */
  label: string;
  /** The explanation itself. Prose, one or two sentences. */
  children: ReactNode;
  className?: string;
}

/**
 * An explanation that costs the reader nothing until they want it.
 *
 * ## Why the text is always in the DOM
 *
 * The obvious implementation mounts the panel on open and points
 * `aria-describedby` at it. That reference then **dangles** whenever the hint
 * is closed — which is almost always — and a dangling `aria-describedby` is not
 * a weaker description, it is no description at all. The same shape cost this
 * repo a combobox name once already.
 *
 * So the panel is rendered every time and only *visually* hidden, with the
 * 1px-clip `sr-only` form. A screen reader hears the explanation as the
 * button's description whether or not anything is on screen; a sighted reader
 * sees it when they ask. Nobody is reading prose they did not want.
 *
 * ## WCAG 2.2 1.4.13, in three parts
 *
 * Content shown on hover or focus must be **hoverable** (the panel is inside
 * the element that owns the pointer handlers, so moving into it keeps it open),
 * **dismissible** without moving the pointer or focus (Escape), and
 * **persistent** until dismissed or the trigger is left. Click toggles as well,
 * because a touch screen has no hover and `focus` on tap is not reliable across
 * mobile browsers.
 */
export function InfoHint({ label, children, className }: InfoHintProps) {
  const hintId = useId();
  const wrapper = useRef<HTMLSpanElement>(null);

  /*
   * Two states, not one, and the reason is touch.
   *
   * A single `open` toggled by click reads correctly with a mouse and is broken
   * under a finger: mobile browsers emulate `mouseenter` on tap, so the hover
   * handler opens the hint microseconds before the click handler toggles it
   * shut again, and the panel never appears. Splitting "the pointer or focus is
   * here" from "the reader asked for this" makes a tap open it and a second tap
   * close it, without giving up hover for everyone else.
   */
  const [pinned, setPinned] = useState(false);
  const [transient, setTransient] = useState(false);
  const open = pinned || transient;

  const dismiss = (): void => {
    setPinned(false);
    setTransient(false);
  };

  /*
   * Escape is bound to the document, not to the wrapper.
   *
   * 1.4.13 requires the hint be dismissible **without moving the pointer or
   * the focus**, and the common case is a mouse user hovering the icon with
   * focus somewhere else entirely — a `keyDown` on this subtree would never
   * fire for them. Bound only while open, so nothing on the page is listening
   * for a key it has no use for.
   */
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /*
   * Hover is bound to the wrapper element rather than declared as JSX props,
   * and the reason is a lint rule that is right about the general case.
   *
   * `jsx-a11y/no-static-element-interactions` exists to catch a `div` doing a
   * button's job. Here the button *is* a button — the wrapper carries hover
   * only so that the panel, which lives inside it, stays reachable with the
   * pointer, which 1.4.13 requires. Suppressing the rule would train the next
   * reader to suppress it somewhere it matters; attaching the listeners to the
   * node says the same thing without an exemption.
   */
  useEffect(() => {
    const node = wrapper.current;
    if (node === null) return undefined;

    const enter = (): void => {
      setTransient(true);
    };

    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', dismiss);
    return () => {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', dismiss);
    };
  }, []);

  return (
    <span ref={wrapper} className={cx('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-describedby={hintId}
        // No `aria-expanded`. This is a tooltip, not a disclosure: the
        // description is already attached to the button and announcing a
        // collapsed/expanded state on top of it describes the *widget* rather
        // than the reading, which is not what the reader asked about.
        onFocus={() => {
          setTransient(true);
        }}
        onBlur={dismiss}
        onClick={() => {
          // Unpinning clears the hover state too, so a reader who clicks to
          // put the hint away actually gets it put away — otherwise the
          // pointer they clicked with would hold it open.
          if (pinned) dismiss();
          else setPinned(true);
        }}
        className="text-text-muted hover:text-text-default focus-visible:outline-border-focus inline-flex size-5 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="sr-only">{label}</span>
        {/* The glyph carries nothing: the button is named above and described
            by the panel below. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 8.75v5" strokeLinecap="round" />
          <path d="M10 6.1v.9" strokeLinecap="round" />
        </svg>
      </button>

      <span
        id={hintId}
        role="tooltip"
        className={
          open
            ? 'bg-surface-raised border-border-default text-text-default absolute start-0 top-full z-30 mt-2 w-max max-w-[min(22rem,70vw)] border p-3 text-start text-[length:var(--type-ui-size-sm)] leading-snug font-normal whitespace-normal'
            : 'sr-only'
        }
      >
        {children}
      </span>
    </span>
  );
}
