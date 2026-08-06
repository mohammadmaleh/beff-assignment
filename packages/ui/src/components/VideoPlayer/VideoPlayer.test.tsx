import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VideoPlayer } from './VideoPlayer';

const FILM = {
  src: '/media/beff-intro.mp4',
  poster: '/media/beff-intro-poster.png',
  label: 'Beff company introduction film',
  width: 640,
  height: 360,
};

describe('VideoPlayer', () => {
  it('carries the accessible name it was given, because it has none of its own', () => {
    // A `<video>` has no intrinsic accessible name. Unlabelled it is announced
    // as "video" and nothing else, so this string is the element's entire
    // identity — which is why the prop is required with no default.
    render(<VideoPlayer {...FILM} />);

    expect(screen.getByLabelText('Beff company introduction film')).toBeInTheDocument();
  });

  it('exposes native controls rather than re-implementing them', () => {
    // Keyboard operation, the scrubber, volume, playback rate and every AT
    // announcement arrive free and correct. This is the clearest case in the
    // library of "native HTML before ARIA": the native element is not merely
    // sufficient here, it is better than anything we would build.
    render(<VideoPlayer {...FILM} />);

    expect(screen.getByLabelText(FILM.label)).toHaveAttribute('controls');
  });

  it('never autoplays, and fetches only the header until asked', () => {
    // Unasked audio is a `prefers-reduced-motion` failure and, on a hero, the
    // page's largest contentful paint. `metadata` costs a few kilobytes for a
    // reader who scrolls straight past.
    render(<VideoPlayer {...FILM} />);
    const video = screen.getByLabelText(FILM.label);

    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('preload', 'metadata');
  });

  it('reserves its box from the master’s intrinsic size', () => {
    // Without both, the element has no aspect ratio until metadata arrives and
    // the column reflows around it — a layout shift, and the most expensive one
    // on the page when this sits in a hero.
    render(<VideoPlayer {...FILM} />);
    const video = screen.getByLabelText(FILM.label);

    expect(video).toHaveAttribute('width', '640');
    expect(video).toHaveAttribute('height', '360');
    expect(video).toHaveAttribute('poster', FILM.poster);
  });

  it('declares the source type, so a browser need not sniff the file', () => {
    const { container } = render(<VideoPlayer {...FILM} />);
    const source = container.querySelector('source');

    expect(source).toHaveAttribute('src', FILM.src);
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  it('takes a different container type when one is passed', () => {
    const { container } = render(<VideoPlayer {...FILM} type="video/webm" />);

    expect(container.querySelector('source')).toHaveAttribute('type', 'video/webm');
  });

  it('ships no caption track, which is a stated gap and not an accident', () => {
    /*
     * A video with an audio track and no captions is WCAG 1.2.2 (A) and 1.2.5
     * (AA) unmet, on a product that otherwise targets 2.2 AA. Asserted rather
     * than left implicit so the gap is visible in the suite too, not only in
     * the README — and so that adding a `.vtt` fails this test and forces the
     * lint suppression in the component to be deleted at the same time.
     */
    const { container } = render(<VideoPlayer {...FILM} />);

    expect(container.querySelector('track')).toBeNull();
  });
});
