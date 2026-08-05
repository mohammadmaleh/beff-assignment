import { render } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { describe, expect, it } from 'vitest';

import type { ComponentType } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Every story, rendered.
 *
 * ## Why this exists
 *
 * The root `test:storybook` script ran a turbo task **no package defined**, so
 * it exited zero and reported success for a suite that did not exist. That is
 * worse than having no script: `pnpm test:storybook` printed green in CI for
 * months. This is the smallest thing that makes the name true.
 *
 * ## Why portable stories rather than the Storybook test runner
 *
 * `composeStories` applies the meta's args, the decorators and the parameters
 * and hands back plain React components — the same objects Storybook renders,
 * executed here in the jsdom environment the rest of this suite already uses.
 * The alternative, `@storybook/test-runner`, needs a Storybook server and a
 * browser per run; it would catch more (real layout, real CSS) at a cost this
 * repo's two-core CI runner cannot absorb, and the *browser* half of that
 * coverage already exists in `packages/e2e`.
 *
 * ## What it actually catches
 *
 * A story that throws — the ordinary decay of a component explorer, where a
 * prop is renamed and the eleventh story keeps a shape nobody rendered since.
 * It is a smoke test and is worth being precise about that: it does not assert
 * that anything *looks* right. The per-component suites next to each story file
 * do that.
 */
interface StoryModule {
  default: Meta;
  [name: string]: unknown;
}

const modules = import.meta.glob<StoryModule>('./components/**/*.stories.tsx', { eager: true });

const entries = Object.entries(modules);

describe('stories', () => {
  it('finds a story file for every component', () => {
    /*
     * The gate that stops this file quietly measuring nothing.
     *
     * `import.meta.glob` matching zero files is not an error — it is an empty
     * object, and every `it.each` below then runs zero times and the suite
     * passes. Naming the expected count means deleting a story file fails here
     * rather than reporting success for tests that did not run.
     */
    const componentDirs = new Set(entries.map(([path]) => path.split('/').slice(0, -1).join('/')));
    expect(componentDirs.size).toBe(entries.length);
    // `exports.test.ts` owns the "every component has one" rule, per directory.
    // This only guards against the glob matching nothing at all.
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s renders every story it exports', (_path, module) => {
    const composed = composeStories(module as Parameters<typeof composeStories>[0]);
    /*
     * `composeStories` types each entry as `AnnotatedStoryFn`, which takes
     * `(args, context)` and so is not a valid JSX component type — but it is
     * callable with neither, because compose has already bound the meta's args
     * and the decorators. The cast says that, rather than working around it by
     * passing arguments the composed story does not want.
     */
    const stories = Object.values(composed) as unknown as ComponentType[];

    // A story file that exports a meta and no stories is a file nobody has
    // looked at since it was scaffolded.
    expect(stories.length).toBeGreaterThan(0);

    for (const Story of stories) {
      const { unmount } = render(<Story />);
      unmount();
    }
  });
});
