import type { DataColumn } from './types';

/**
 * German Excel splits on semicolons, English Excel on commas.
 *
 * Getting this wrong does not produce a subtly wrong file - it produces one
 * column per row, which the user reads as a broken export.
 *
 * The rule underneath is not "German": Excel uses a semicolon wherever the
 * locale's *decimal separator* is a comma, because a comma cannot be both at
 * once. Asking `Intl` which separator the locale uses states that rule directly
 * instead of enumerating locales - so `fr` and `es` are already right, and this
 * component carries no list of the app's locales for the app to keep in step
 * with.
 */
export function csvDelimiter(locale: string): string {
  return new Intl.NumberFormat(locale).format(1.1).includes(',') ? ';' : ',';
}

function escapeCell(value: string, delimiter: string): string {
  const needsQuotes = value.includes(delimiter) || /["\n\r]/.test(value);
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * The rows exactly as the caller passes them - already filtered, already sorted
 * - serialised with each column's `text`, which is the formatted value the user
 * can see rather than the raw float behind it.
 */
export function toCsv<Row>(
  columns: readonly DataColumn<Row>[],
  rows: readonly Row[],
  delimiter: string,
): string {
  const line = (cells: readonly string[]): string =>
    cells.map((cell) => escapeCell(cell, delimiter)).join(delimiter);

  return [
    line(columns.map((column) => column.header)),
    ...rows.map((row) => line(columns.map((column) => column.text(row)))),
    // CRLF, per RFC 4180 and per what Excel expects.
  ].join('\r\n');
}

/**
 * Hand the file to the browser.
 *
 * The leading `U+FEFF` is a UTF-8 BOM - written as an escape rather than the
 * raw glyph, because the raw character is invisible in an editor and trips
 * `no-irregular-whitespace`. Without it Excel reads the file as the system
 * codepage and every German umlaut and every `€` arrives mangled.
 */
export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
