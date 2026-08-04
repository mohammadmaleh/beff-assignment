#!/usr/bin/env node
/**
 * `pnpm dev` — get the workspace into a runnable state, then run it.
 *
 * ## Why this is a script and not just `turbo run dev`
 *
 * Three things have to be true before the dev server is useful, and none of
 * them is enforced by `turbo run dev` on its own:
 *
 * 1. **Dependencies match the manifests.** Adding a package edits
 *    `package.json` and `pnpm-lock.yaml`; a dev server started before the
 *    install has a resolver cache that predates it, and reports the new package
 *    as `Module not found` — which reads as a broken install rather than a
 *    stale process. That failure cost a session once.
 *
 * 2. **`@beff/tokens` is built.** `globals.css` does `@import '@beff/tokens/css'`,
 *    which resolves to `dist/tokens.css` — a generated file. The `dev` task now
 *    declares `dependsOn: ["^build"]` so turbo produces it, but that is only
 *    true because this script exists to make the point; before it, a fresh
 *    clone's first `pnpm dev` failed on a missing stylesheet.
 *
 * 3. **The port is free.** A second dev server does not replace the first, and
 *    the one you are looking at is the stale one.
 *
 * ## What it deliberately does not do
 *
 * It never kills anything. The port check reports and stops, because the
 * process holding a port is not reliably identifiable from here — `ss` gives no
 * PID without privileges, and Next retitles its process to `next-server`, so
 * anything that looked confident about killing "the dev server" would sometimes
 * be killing something else. Naming the problem is the useful part; the reader
 * can decide what to stop.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Where the fingerprint of the last successful install is kept.
 *
 * Inside `node_modules` on purpose: it is derived state about `node_modules`,
 * so `pnpm clean` removing that directory correctly invalidates it, and it can
 * never be committed by accident.
 */
const STAMP = join(ROOT, 'node_modules', '.beff-install-stamp');

const DEV_PORT = Number(process.env.WEB_PORT ?? 3000);

// ── Reporting ────────────────────────────────────────────────────────────────

const styled = (code, text) => (process.stdout.isTTY === true ? `[${code}m${text}[0m` : text);

const step = (text) => {
  console.log(`${styled('36', '›')} ${text}`);
};
const warn = (text) => {
  console.log(`${styled('33', '!')} ${text}`);
};

// ── 1. Are the installed packages the ones the manifests ask for? ────────────

/**
 * Every manifest whose contents could change what should be in `node_modules`.
 *
 * The lockfile alone would miss the window that matters most: a `package.json`
 * edited by hand, or a branch switched to, where the install has not run yet.
 * That is exactly the state this script exists to detect.
 */
function manifestPaths() {
  const paths = [join(ROOT, 'package.json'), join(ROOT, 'pnpm-lock.yaml')];

  // The workspace globs, expanded by hand. `pnpm-workspace.yaml` lists
  // `apps/web` and `packages/*`; reading the directories keeps a new package
  // included without editing this list.
  for (const group of ['apps', 'packages']) {
    const base = join(ROOT, group);
    if (!existsSync(base)) continue;

    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = join(base, entry.name, 'package.json');
      if (existsSync(manifest)) paths.push(manifest);
    }
  }

  return paths.sort();
}

function fingerprint() {
  const hash = createHash('sha256');
  for (const path of manifestPaths()) {
    // The path as well as the contents: a package that is deleted must change
    // the fingerprint even if nothing else was edited.
    hash.update(path);
    hash.update(readFileSync(path));
  }
  return hash.digest('hex');
}

function ensureInstalled() {
  const current = fingerprint();
  const previous = existsSync(STAMP) ? readFileSync(STAMP, 'utf8').trim() : null;

  if (previous === current && existsSync(join(ROOT, 'node_modules'))) {
    step('Dependencies match the manifests.');
    return;
  }

  step(previous === null ? 'Installing dependencies…' : 'Manifests changed — installing…');

  // Not `--frozen-lockfile`. That is right in CI, where a lockfile that
  // disagrees with a manifest is a mistake to fail on; here it is usually a
  // dependency someone just added, and the whole job of this script is to
  // reconcile it rather than refuse.
  execFileSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });

  // Written only after a successful install — `execFileSync` throws on a
  // non-zero exit, so a failed install leaves the old stamp and the next run
  // tries again rather than assuming it worked.
  writeFileSync(STAMP, `${fingerprint()}\n`);
}

// ── 2. Is the port free? ─────────────────────────────────────────────────────

/**
 * Ask the OS, rather than parsing `ss` or `lsof`.
 *
 * Binding is the same question the dev server itself is about to ask, so the
 * answer cannot disagree with it, and it needs no external command and no
 * privileges.
 */
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => {
      resolve(false);
    });
    probe.once('listening', () => {
      probe.close(() => {
        resolve(true);
      });
    });
    probe.listen(port, '0.0.0.0');
  });
}

// ── 3. Can we write to our own build output? ─────────────────────────────────

/**
 * Find build-output directories this user cannot write to.
 *
 * The compose `web` service runs as root and used to bind-mount `apps/web`
 * straight through, so it wrote `.next` back to the host owned by root. The
 * host's own dev server then failed to create a directory inside its build
 * output — which Turbopack reports as a FATAL panic with a bug-report URL, so
 * the obvious next move is to go looking for a Next.js bug.
 *
 * The compose file no longer does that (`.next` is an anonymous volume now),
 * but any tree that ran the old configuration still carries the root-owned
 * leftovers, and they do not clean themselves up.
 */
function unwritablePaths() {
  const root = join(ROOT, 'apps', 'web', '.next');
  if (!existsSync(root)) return [];

  const found = [];
  const walk = (path, depth) => {
    try {
      accessSync(path, constants.W_OK);
    } catch {
      found.push(path);
      // No point descending: the whole subtree belongs to someone else.
      return;
    }
    if (depth === 0) return;

    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(path, entry.name), depth - 1);
    }
  };

  try {
    walk(root, 2);
  } catch {
    // An unreadable tree is an unwritable one for our purposes.
    return [root];
  }
  return found;
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  ensureInstalled();

  const blocked = unwritablePaths();
  if (blocked.length > 0) {
    const owner = (path) => {
      try {
        return `uid ${String(statSync(path).uid)}`;
      } catch {
        return 'unknown owner';
      }
    };

    warn(`${String(blocked.length)} path(s) in apps/web/.next are not writable by you.`);

    const listed = blocked
      .slice(0, 5)
      .map((path) => `    ${path.replace(`${ROOT}/`, '')}  (${owner(path)})`);
    if (blocked.length > 5) listed.push(`    …and ${String(blocked.length - 5)} more`);

    console.log(
      [
        '',
        '  These were almost certainly written by the `web` container, which runs as',
        '  root and used to bind-mount apps/web straight through. Next cannot build',
        '  into them, and it fails as a Turbopack panic rather than a permission error.',
        '',
        ...listed,
        '',
        '  Remove them — they are regenerable build output, nothing else:',
        '',
        '    sudo rm -rf apps/web/.next',
        '',
        '  docker-compose.yml no longer mounts .next through to the host, so once',
        '  this is cleared it will not come back.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  if (!(await portIsFree(DEV_PORT))) {
    warn(`Port ${String(DEV_PORT)} is already in use.`);
    console.log(
      [
        '',
        '  A dev server is already running. Starting a second one will not replace it —',
        '  and if you have just added a dependency, the running one cannot see it: its',
        '  module resolution was cached when it booted. That is what "Module not found"',
        '  means when the package is demonstrably installed.',
        '',
        `  Stop it (Ctrl-C in its terminal), then run this again.`,
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  step('Starting the dev server…\n');

  // `^build` on the `dev` task makes turbo produce `@beff/tokens/dist` first.
  // Everything after `--` on our own command line is forwarded, so
  // `pnpm dev --filter @beff/web` still does what it looks like it does.
  const child = spawn('pnpm', ['exec', 'turbo', 'run', 'dev', ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // Turbo's TUI wants the terminal, so signals reach it directly. This is only
  // here so that an exit code is propagated rather than swallowed.
  child.on('exit', (code, signal) => {
    process.exit(signal === null ? (code ?? 0) : 0);
  });
}

await main();
