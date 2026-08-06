import { Reading, ReadingList } from './Reading';

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

/*
 * Named rather than inline. An inline decorator makes the inferred type of
 * `meta` reference storybook's internal `csf` module, which TypeScript cannot
 * name in the declaration it emits — TS2742, reported against the meta rather
 * than against the decorator that caused it.
 */
const inList: Decorator = (Story) => (
  <ReadingList>
    <Story />
  </ReadingList>
);

/**
 * A figure that is a **fact about a window** rather than a measurement of the
 * process — the third of this library's three numeric primitives, and the one
 * to reach for when neither of the other two is honest.
 *
 * | Component  | The reading it is for                | Example                        |
 * | ---------- | ------------------------------------ | ------------------------------ |
 * | `SpecBand` | A measurement against a limit        | First-pass yield, 40–80% window |
 * | `Metric`   | A measurement with a direction       | Scrap rate, ▲ +1.4 pp          |
 * | `Reading`  | Neither: a total, a count, a cohort  | €47 200 of committed value lost |
 *
 * Choosing wrongly here is not a cosmetic mistake. A total that scales with how
 * much the line ran has no specification window, and banding it would look
 * consistent with everything around it and be a lie about what the number is.
 *
 * Each `Reading` must sit inside a `ReadingList` — it renders a `<dt>`/`<dd>`
 * pair, and that pairing is the only thing telling a screen reader which figure
 * a label belongs to.
 */
const meta = {
  title: 'Data/Reading',
  component: Reading,
  /*
   * `note` is deliberately not a meta arg. Storybook merges meta args into
   * every story, and there is no way to *unset* one — `note: undefined` is the
   * only spelling available, which `exactOptionalPropertyTypes` correctly
   * rejects. So the story that documents the no-note case would be untypeable.
   * Each story that wants a note supplies its own.
   */
  args: { label: 'Committed value lost', value: '€47 200' },
  decorators: [inList],
} satisfies Meta<typeof Reading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The plain case: a figure, its label, and a sentence saying what it is. */
export const Default: Story = { args: { note: 'Across the selected window' } };

/**
 * The note carries the sample size, and it is not optional detail. A benchmark
 * rendered without its *n* reads as a measurement of something; with it, it
 * reads as what it is — a reference against comparable lines.
 */
export const Benchmark: Story = {
  args: {
    label: 'Versus cohort',
    value: '−2.3 pp',
    note: 'Median 74.1% across 24 comparable pilot lines',
  },
};

/**
 * No note. Nothing renders in its place — an empty line under a figure reads as
 * a value that failed to load.
 */
export const WithoutNote: Story = {
  args: { label: 'Cells passed', value: '18 240' },
};

/**
 * The em dash is a deliberate "nothing to show". A blank cell reads as a
 * rendering failure, and the two are worth distinguishing on a surface whose
 * whole job is to be trusted.
 */
export const NothingToShow: Story = {
  args: { label: 'Worst batch', value: '—', note: 'No batches in this window' },
};

/**
 * German runs roughly 30% longer than English, and DE is a shipped locale. The
 * label wraps; the figure does not move.
 */
export const German: Story = {
  args: {
    label: 'Zugesagter Wert verloren',
    value: '47 200 €',
    note: 'Über das ausgewählte Fenster',
  },
};

/**
 * How four of them sit together. `ReadingList` supplies no columns of its own —
 * the grid below belongs to the page, because how many fit depends on how many
 * there are.
 */
export const Row: StoryObj<typeof meta> = {
  decorators: [],
  args: { note: 'Across the selected window' },
  render: (args) => (
    <ReadingList className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      <Reading {...args} />
      <Reading label="Cells passed" value="18 240" note="of 21 400 started" />
      <Reading label="Versus cohort" value="−2.3 pp" note="Median 74.1% across 24 lines" />
      <Reading label="Worst batch" value="B-2291" note="over 42 batches" />
    </ReadingList>
  ),
};
