#!/usr/bin/env node
// Worktree integrity check. Run it before an agent starts work in a worktree.
//
// Catches checkouts where a crash, an interrupted sync, or disk cleanup deleted
// tracked files. Committing from such a worktree records mass deletions that
// are easy to miss in review.
//
// Checks:
//   - critical directories exist (default: every top-level directory git tracks)
//   - tracked files missing from disk stay under --max-missing (default 25)
//   - optional: current branch matches --branch-pattern (regex)
//
// Usage:
//   node scripts/check-worktree-integrity.mjs [--cwd=<dir>] [--critical=a,b]
//        [--max-missing=N] [--branch-pattern=<regex>]
// Exit codes: 0 healthy, 73 integrity failure, 2 usage or git error.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_USAGE = 2;
export const EXIT_INTEGRITY = 73;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function parseArgs(argv) {
  const opts = { cwd: process.cwd(), critical: null, maxMissing: 25, branchPattern: null };
  for (const arg of argv) {
    const [key, ...rest] = arg.split('=');
    const value = rest.join('=');
    if (key === '--cwd') opts.cwd = resolve(value);
    else if (key === '--critical') opts.critical = value.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === '--max-missing') {
      opts.maxMissing = Number(value);
      if (!Number.isInteger(opts.maxMissing) || opts.maxMissing < 0) throw new Error('--max-missing must be a non-negative integer');
    } else if (key === '--branch-pattern') opts.branchPattern = new RegExp(value);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

export function checkWorktree(opts) {
  const root = git(opts.cwd, ['rev-parse', '--show-toplevel']).trim();
  const tracked = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const critical =
    opts.critical ?? [...new Set(tracked.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))].sort();

  const missingCriticalDirectories = critical.filter((d) => !existsSync(join(root, d)));
  const missingTrackedFiles = tracked.filter((f) => !existsSync(join(root, f)));

  let branch = null;
  try {
    branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  } catch {
    branch = null; // detached HEAD
  }

  const problems = [];
  if (missingCriticalDirectories.length > 0) problems.push('missing_critical_directories');
  if (missingTrackedFiles.length > opts.maxMissing) problems.push('too_many_missing_tracked_files');
  if (opts.branchPattern) {
    if (!branch) problems.push('detached_head');
    else if (!opts.branchPattern.test(branch)) problems.push('branch_name_mismatch');
  }

  return {
    ok: problems.length === 0,
    problems,
    root,
    branch,
    trackedFileCount: tracked.length,
    criticalDirectories: critical,
    missingCriticalDirectories,
    missingTrackedFileCount: missingTrackedFiles.length,
    missingTrackedFileSample: missingTrackedFiles.slice(0, 20),
    maxMissing: opts.maxMissing,
  };
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(String(err.message));
    return EXIT_USAGE;
  }
  let result;
  try {
    result = checkWorktree(opts);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, reason: 'git_error', message: String(err.message).trim() }));
    return EXIT_USAGE;
  }
  const out = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(out);
    return EXIT_OK;
  }
  console.error(out);
  return EXIT_INTEGRITY;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
