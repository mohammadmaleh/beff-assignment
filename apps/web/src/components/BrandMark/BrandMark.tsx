import Image from 'next/image';

/** The asset's intrinsic size. Declared so the box is reserved before it loads. */
const INTRINSIC = { width: 132, height: 52 } as const;

/**
 * Beff's wordmark, as shipped by Beff.
 *
 * This is the one place on the page where the visual system is not ours. Every
 * heading is Archivo at `wdth 125`; the logo is a different face entirely, and
 * that mismatch is correct — a company's mark is not a heading style, and
 * re-setting someone's logo in your own typeface is a thing you do to a brand,
 * not for it.
 *
 * `alt="Beff"` rather than "Beff logo": a screen reader already announces the
 * role, so "logo" is the word "image" said twice. Inside the header link it also
 * makes the link's accessible name "Beff", which is what a reader looking for
 * the way home is listening for.
 *
 * The `brand-mark` class is the seam for dark mode. A raster asset cannot be
 * re-coloured by a semantic token the way every other colour on this page is, so
 * `globals.css` applies a monochrome treatment under the same two selectors the
 * token sheet uses. Its navy sits at roughly 2:1 against Graphite — legible as a
 * shape, not as a mark, which is the case a white silhouette exists for.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/beff-wordmark.png"
      alt="Beff"
      width={INTRINSIC.width}
      height={INTRINSIC.height}
      // Above the fold in the header, and the only image on the marketing
      // surface, so it is worth preloading rather than lazy.
      priority
      className={['brand-mark w-auto', className].filter(Boolean).join(' ')}
    />
  );
}
