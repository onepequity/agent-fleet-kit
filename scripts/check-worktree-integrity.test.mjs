import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWorktree, parseArgs, EXIT_INTEGRITY } from './check-worktree-integrity.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-worktree-integrity.mjs');

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-integrity-'));
  const g = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  g('init', '-q', '-b', 'engineer/fix-thing');
  g('config', 'user.name', 'Test');
  g('config', 'user.email', 'test@example.invalid');
  for (const d of ['src', 'docs']) {
    mkdirSync(join(dir, d));
    for (let i = 0; i < 5; i++) writeFileSync(join(dir, d, `f${i}.txt`), `${d}${i}\n`);
  }
  writeFileSync(join(dir, 'README.md'), 'x\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  return dir;
}

test('healthy worktree passes', () => {
  const dir = makeRepo();
  try {
    const r = checkWorktree(parseArgs([`--cwd=${dir}`]));
    assert.equal(r.ok, true);
    assert.deepEqual(r.criticalDirectories, ['docs', 'src']);
    assert.equal(r.trackedFileCount, 11);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing critical directory fails with exit 73', () => {
  const dir = makeRepo();
  try {
    rmSync(join(dir, 'src'), { recursive: true });
    const res = spawnSync(process.execPath, [script, `--cwd=${dir}`], { encoding: 'utf8' });
    assert.equal(res.status, EXIT_INTEGRITY);
    const out = JSON.parse(res.stderr);
    assert.deepEqual(out.missingCriticalDirectories, ['src']);
    assert.equal(out.missingTrackedFileCount, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing file count respects --max-missing', () => {
  const dir = makeRepo();
  try {
    rmSync(join(dir, 'docs', 'f0.txt'));
    assert.equal(checkWorktree(parseArgs([`--cwd=${dir}`])).ok, true);
    const strict = checkWorktree(parseArgs([`--cwd=${dir}`, '--max-missing=0']));
    assert.deepEqual(strict.problems, ['too_many_missing_tracked_files']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('branch pattern is enforced when given', () => {
  const dir = makeRepo();
  try {
    assert.equal(checkWorktree(parseArgs([`--cwd=${dir}`, '--branch-pattern=^[a-z-]+/[a-z0-9-]+$'])).ok, true);
    const bad = checkWorktree(parseArgs([`--cwd=${dir}`, '--branch-pattern=^release/']));
    assert.deepEqual(bad.problems, ['branch_name_mismatch']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
