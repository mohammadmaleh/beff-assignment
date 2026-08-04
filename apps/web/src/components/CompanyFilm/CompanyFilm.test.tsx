import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CompanyFilm } from './CompanyFilm';

/** `<video>` has no implicit ARIA role, so it is queried out of the container. */
function videoIn(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (!video) throw new Error('no <video> rendered');
  return video;
}

describe('CompanyFilm', () => {
  it('plays the film that was actually shipped', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    expect(videoIn(container).querySelector('source')).toHaveAttribute(
      'src',
      '/media/beff-intro.mp4',
    );
  });

  it('carries a poster, so it is not a black rectangle before play', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    expect(videoIn(container)).toHaveAttribute('poster', '/media/beff-intro-poster.png');
  });

  it('never autoplays', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    // 71 seconds of motion with an audio track, unasked. It would also be the
    // page's largest paint and fail `prefers-reduced-motion` in one move.
    expect(videoIn(container)).not.toHaveAttribute('autoplay');
  });

  it('does not pull four megabytes on every visit', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    // `metadata` fetches the header and stops. `auto` would download the whole
    // film for every visitor who scrolled past it without pressing play.
    expect(videoIn(container)).toHaveAttribute('preload', 'metadata');
  });

  it('offers native controls rather than a hand-rolled player', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    // Keyboard operation, the scrubber, volume and the AT announcements all
    // arrive free. Native HTML before ARIA.
    expect(videoIn(container)).toHaveAttribute('controls');
  });

  it('declares its intrinsic size and never scales past it', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    const video = videoIn(container);
    // The master is 640×360. Stretched across a 1440px band it is a 2.25×
    // upscale and visibly soft, so the cap is part of the component, not of
    // whatever page happens to hold it.
    expect(video).toHaveAttribute('width', '640');
    expect(video).toHaveAttribute('height', '360');
    expect(video.className).toContain('max-w-[640px]');
  });

  it('is named, in the reader’s language', () => {
    const { container } = render(<CompanyFilm locale="en" />);
    expect(videoIn(container)).toHaveAttribute('aria-label', 'Beff company introduction film');
  });

  it('is named in German in the German locale', () => {
    const { container } = render(<CompanyFilm locale="de" />);
    expect(videoIn(container).getAttribute('aria-label')).toMatch(/unternehmensfilm/i);
  });

  it('says what the film contains, for everyone who will not watch it', () => {
    render(<CompanyFilm locale="en" />);
    // The film has no captions. A text summary beside it is not a substitute —
    // see the README — but it does mean the section still carries its meaning
    // for a reader who cannot or will not play 71 seconds of video.
    expect(screen.getByRole('heading', { name: /Beff, in about a minute/i })).toBeInTheDocument();
    expect(screen.getByText(/Navigator/)).toBeInTheDocument();
  });
});
