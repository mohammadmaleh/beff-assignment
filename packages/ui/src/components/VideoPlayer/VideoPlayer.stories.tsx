import { VideoPlayer } from './VideoPlayer';

import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * A plain, accessible `<video>`.
 *
 * Native `controls` rather than a custom player: keyboard operation, the
 * scrubber, volume, playback rate and every assistive-technology announcement
 * arrive free and correct. This is the clearest case in the library of the
 * project's "native HTML before ARIA" rule - the native element is not merely
 * sufficient here, it is better than anything we would build.
 *
 * ## Two things it will not do
 *
 * **It never autoplays.** Unasked audio is a `prefers-reduced-motion` failure
 * and, in a hero, the page's largest contentful paint.
 *
 * **It ships no `<track>`.** Nothing in this repo has a `.vtt` yet, so a video
 * with an audio track is WCAG 1.2.2 (A) and 1.2.5 (AA) unmet. The lint rule is
 * suppressed at one call site inside the component rather than in the eslint
 * config, so the exception stays visible in review.
 *
 * ## `label` is required, with no default
 *
 * A `<video>` has no intrinsic accessible name - unlabelled it is announced as
 * "video" and nothing else. The label is therefore the element's entire
 * identity to a screen reader, and a default would be an English string
 * shipping onto the German page with nothing to catch it: axe is indifferent to
 * which language a well-formed string is in, and so is every screenshot.
 */
const meta = {
  title: 'Media/VideoPlayer',
  component: VideoPlayer,
  args: {
    src: '/media/beff-intro.mp4',
    poster: '/media/beff-intro-poster.png',
    label: 'Beff company introduction film',
    width: 640,
    height: 360,
  },
} satisfies Meta<typeof VideoPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At the master's own size. Anything wider is an upscale of these pixels. */
export const Default: Story = {};

/**
 * The same element with its accessible name in German - the case the required
 * prop exists to force. Inspect it in the a11y panel: the name is the only
 * thing a screen reader has to go on.
 */
export const German: Story = {
  args: { label: 'Beff Unternehmensfilm' },
};

/**
 * Without a poster the element is a black rectangle until someone presses play.
 * On a hero that is the largest thing on the page, saying nothing.
 */
export const NoPoster: Story = {
  args: { poster: undefined },
};
