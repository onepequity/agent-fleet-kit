import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSkills, parseFrontmatter } from './check-skill-quality.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyKit() {
  const dir = mkdtempSync(join(tmpdir(), 'skill-quality-'));
  cpSync(join(repoRoot, 'skills'), join(dir, 'skills'), { recursive: true });
  return dir;
}

test('the kit itself passes the skill quality gate', () => {
  const { checked, issues } = auditSkills(repoRoot);
  assert.ok(checked >= 2);
  assert.deepEqual(issues, []);
});

test('parses scalars, inline lists, and block lists', () => {
  const fm = parseFrontmatter('---\nname: a\npersonas: [x, y]\ntools:\n  - git\n  - "gh"\n---\nbody');
  assert.equal(fm.data.name, 'a');
  assert.deepEqual(fm.data.personas, ['x', 'y']);
  assert.deepEqual(fm.data.tools, ['git', 'gh']);
  assert.equal(fm.body, 'body');
});

test('flags a skill with bad frontmatter, no evals, and no registry entry', () => {
  const dir = copyKit();
  try {
    cpSync(join(dir, 'skills/_TEMPLATE'), join(dir, 'skills/broken'), { recursive: true });
    writeFileSync(
      join(dir, 'skills/broken/SKILL.md'),
      '---\nname: wrong-name\nversion: 1\ndescription: x\ntriggers: []\ntools:\n  - git\nrisk_level: extreme\n---\n## Contract\n',
    );
    rmSync(join(dir, 'skills/broken/evals'), { recursive: true });
    const codes = auditSkills(dir).issues.filter((i) => i.skill === 'broken').map((i) => i.code);
    for (const code of [
      'name_mismatch',
      'invalid_version',
      'missing_triggers',
      'invalid_risk_level',
      'missing_section',
      'missing_routing_evals',
      'not_in_registry',
    ]) {
      assert.ok(codes.includes(code), `expected ${code} in ${codes.join(',')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('requires both positive and negative routing evals', () => {
  const dir = copyKit();
  try {
    writeFileSync(
      join(dir, 'skills/code-review-dispatch/evals/routing.jsonl'),
      '{"prompt":"review this","expected_skill":"code-review-dispatch","should_use":true}\n',
    );
    const codes = auditSkills(dir).issues.map((i) => i.code);
    assert.deepEqual(codes, ['no_negative_evals']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
