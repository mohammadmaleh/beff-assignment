import { describe, expect, it } from 'vitest';

import { csvDelimiter, toCsv } from './csv';

import type { DataColumn } from './types';

interface Row {
  step: string;
  cells: string;
}

const COLUMNS: DataColumn<Row>[] = [
  { key: 'step', header: 'Process step', render: (row) => row.step, text: (row) => row.step },
  { key: 'cells', header: 'Cells', render: (row) => row.cells, text: (row) => row.cells },
];

describe('csvDelimiter', () => {
  it('uses a semicolon for German', () => {
    // German Excel splits on semicolons. A comma-delimited file opens there as
    // one column per row, and reads to the user as a broken export rather than
    // as a locale mismatch.
    expect(csvDelimiter('de')).toBe(';');
  });

  it('uses a comma for English', () => {
    expect(csvDelimiter('en')).toBe(',');
  });
});

describe('toCsv', () => {
  it('writes the headers first, then one line per row', () => {
    const csv = toCsv(COLUMNS, [{ step: 'Coating', cells: '1400' }], ',');

    expect(csv).toBe('Process step,Cells\r\nCoating,1400');
  });

  it('quotes a cell containing the delimiter', () => {
    // English formats a thousand as '1,400'. Unquoted, that one cell becomes
    // two columns and every column after it in the file is shifted.
    const csv = toCsv(COLUMNS, [{ step: 'Coating', cells: '1,400' }], ',');

    expect(csv).toBe('Process step,Cells\r\nCoating,"1,400"');
  });

  it('does not quote a comma when the delimiter is a semicolon', () => {
    const csv = toCsv(COLUMNS, [{ step: 'Beschichtung', cells: '88,3 %' }], ';');

    expect(csv).toBe('Process step;Cells\r\nBeschichtung;88,3 %');
  });

  it('doubles an embedded quote, as RFC 4180 requires', () => {
    const csv = toCsv(COLUMNS, [{ step: 'He said "go"', cells: '1' }], ',');

    expect(csv).toBe('Process step,Cells\r\n"He said ""go""",1');
  });

  it('exports the rows exactly as given, in the order given', () => {
    // The caller passes the *filtered and sorted* rows. Re-deriving them here
    // would export something other than what the user is looking at.
    const csv = toCsv(
      COLUMNS,
      [
        { step: 'B', cells: '2' },
        { step: 'A', cells: '1' },
      ],
      ',',
    );

    expect(csv.split('\r\n').slice(1)).toEqual(['B,2', 'A,1']);
  });
});
