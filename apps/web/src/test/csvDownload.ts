import { vi } from 'vitest';

/**
 * Capture what a `DataTable` export actually hands the browser.
 *
 * jsdom implements `URL.createObjectURL` and `revokeObjectURL`, but not a real
 * anchor navigation, so all three are spied rather than replaced. Note what is
 * *not* done here: `vi.stubGlobal('URL', { ...URL })` loses the class's
 * non-enumerable statics and leaves something that is no longer constructable,
 * so any unrelated `new URL(...)` in the same test throws far from its cause.
 * Spying on the real object leaves the constructor intact.
 */
export function captureCsvDownload(): {
  /** The exported file's text, BOM already consumed. Throws if nothing was exported. */
  text: () => Promise<string>;
  /** The raw first bytes, so the BOM can be asserted — see below. */
  bytes: () => Promise<Uint8Array>;
  restore: () => void;
} {
  const blobs: Blob[] = [];

  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => {
    blobs.push(object as Blob);
    return 'blob:stub';
  });
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  const only = (): Blob => {
    const blob = blobs[0];
    if (blob === undefined) throw new Error('No CSV was exported.');
    return blob;
  };

  return {
    /*
     * `Blob.text()` decodes via the WHATWG "UTF-8 decode" algorithm, which
     * strips a leading BOM by spec — in a real browser too, not only here. The
     * BOM therefore only survives as raw bytes, which is what `bytes()` is for.
     */
    text: () => only().text(),
    bytes: async () => new Uint8Array(await only().arrayBuffer()),
    restore: () => {
      click.mockRestore();
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    },
  };
}
