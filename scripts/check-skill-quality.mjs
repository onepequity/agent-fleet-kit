#!/usr/bin/env node
// Skill quality gate. Lints every skills/<slug>/ directory:
//   - SKILL.md frontmatter has required keys with valid values
//   - name matches the directory, risk_level matches the registry
//   - required body sections exist
//   - provenance.md exists
//   - evals/routing.jsonl parses, targets this skill, and has positive and negative cases
//   - the skill has an entry in skills/registry.yaml
//
// Usage: node scripts/check-skill-quality.mjs [--root=<repo root>] [--json]
// Exit codes: 0 clean, 1 errors found, 2 usage error. No dependencies.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_KEYS = ['name', 'version', 'description', 'triggers', 'tools', 'risk_level'];
export const RISK_LEVELS = ['low', 'medium', 'high'];
export const REQUIRED_SECTIONS = ['Contract', 'When not to use', 'Workflow', 'Output Format'];
const MAX_DESCRIPTION = 200;

// Minimal YAML frontmatter parser: scalars, inline lists [a, b], block lists.
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return null;
  const data = {};
  let currentKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(item[1].trim()));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();
    if (value === '') data[currentKey] = [];
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((v) => unquote(v.trim()))
        .filter(Boolean);
    } else data[currentKey] = unquote(value);
  }
  return { data, body: text.slice(match[0].length) };
}

function unquote(v) {
  return v.replace(/^(['"])(.*)\1$/, '$2');
}

// Pulls `slug` and `risk_level` pairs out of registry.yaml without a YAML library.
export function parseRegistry(text) {
  const entries = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const slug = /^\s*-\s+slug:\s*(\S+)/.exec(line);
    if (slug) {
      current = { slug: unquote(slug[1]) };
      entries.set(current.slug, current);
      continue;
    }
    const risk = /^\s+risk_level:\s*(\S+)/.exec(line);
    if (risk && current) current.risk_level = unquote(risk[1]);
  }
  return entries;
}

export function auditSkills(root) {
  const skillsRoot = join(root, 'skills');
  const issues = [];
  const add = (skill, code, message) => issues.push({ skill, code, message });

  if (!existsSync(skillsRoot)) {
    add('*', 'missing_skills_dir', `No skills directory at ${skillsRoot}`);
    return { checked: 0, issues };
  }
  const registryPath = join(skillsRoot, 'registry.yaml');
  const registry = existsSync(registryPath) ? parseRegistry(readFileSync(registryPath, 'utf8')) : null;
  if (!registry) add('*', 'missing_registry', 'skills/registry.yaml not found');

  const dirs = readdirSync(skillsRoot).filter((d) => statSync(join(skillsRoot, d)).isDirectory());
  for (const slug of dirs) {
    const dir = join(skillsRoot, slug);
    const skillPath = join(dir, 'SKILL.md');
    if (!existsSync(skillPath)) {
      add(slug, 'missing_skill_md', 'SKILL.md not found');
      continue;
    }
    const parsed = parseFrontmatter(readFileSync(skillPath, 'utf8'));
    if (!parsed) {
      add(slug, 'missing_frontmatter', 'SKILL.md has no --- frontmatter block');
      continue;
    }
    const { data, body } = parsed;

    for (const key of REQUIRED_KEYS) {
      const v = data[key];
      if (v === undefined || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '')) {
        add(slug, `missing_${key}`, `Frontmatter key "${key}" is missing or empty`);
      }
    }
    if (data.name && data.name !== slug) {
      add(slug, 'name_mismatch', `name "${data.name}" does not match directory "${slug}"`);
    }
    if (data.risk_level && !RISK_LEVELS.includes(data.risk_level)) {
      add(slug, 'invalid_risk_level', `risk_level "${data.risk_level}" must be one of ${RISK_LEVELS.join(', ')}`);
    }
    if (data.triggers !== undefined && !Array.isArray(data.triggers)) {
      add(slug, 'triggers_not_list', 'triggers must be a list');
    }
    if (data.tools !== undefined && !Array.isArray(data.tools)) {
      add(slug, 'tools_not_list', 'tools must be a list');
    }
    if (typeof data.description === 'string' && data.description.length > MAX_DESCRIPTION) {
      add(slug, 'description_too_long', `description is ${data.description.length} chars (max ${MAX_DESCRIPTION})`);
    }
    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      add(slug, 'invalid_version', `version "${data.version}" is not semver (x.y.z)`);
    }
    for (const section of REQUIRED_SECTIONS) {
      const re = new RegExp(`^##\\s+${section.replace(/ /g, '\\s+')}\\s*$`, 'mi');
      if (!re.test(body)) add(slug, 'missing_section', `Missing "## ${section}" section`);
    }

    if (!existsSync(join(dir, 'provenance.md'))) {
      add(slug, 'missing_provenance', 'provenance.md not found');
    }

    const evalPath = join(dir, 'evals', 'routing.jsonl');
    if (!existsSync(evalPath)) {
      add(slug, 'missing_routing_evals', 'evals/routing.jsonl not found');
    } else {
      let positive = 0;
      let negative = 0;
      readFileSync(evalPath, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (!line.trim()) return;
          let row;
          try {
            row = JSON.parse(line);
          } catch {
            add(slug, 'invalid_eval_json', `routing.jsonl line ${i + 1} is not valid JSON`);
            return;
          }
          if (typeof row.prompt !== 'string' || !row.prompt.trim()) {
            add(slug, 'invalid_eval_row', `routing.jsonl line ${i + 1} has no prompt`);
          }
          if (row.expected_skill !== slug) {
            add(slug, 'eval_wrong_skill', `routing.jsonl line ${i + 1} targets "${row.expected_skill}"`);
          }
          if (row.should_use === true) positive += 1;
          else if (row.should_use === false) negative += 1;
          else add(slug, 'invalid_eval_row', `routing.jsonl line ${i + 1} needs boolean should_use`);
        });
      if (positive === 0) add(slug, 'no_positive_evals', 'routing evals need at least one should_use: true case');
      if (negative === 0) add(slug, 'no_negative_evals', 'routing evals need at least one should_use: false case');
    }

    if (registry) {
      const entry = registry.get(slug);
      if (!entry) add(slug, 'not_in_registry', 'No entry in skills/registry.yaml');
      else if (entry.risk_level && data.risk_level && entry.risk_level !== data.risk_level) {
        add(slug, 'registry_risk_mismatch', `registry risk_level "${entry.risk_level}" != SKILL.md "${data.risk_level}"`);
      }
    }
  }

  if (registry) {
    for (const slug of registry.keys()) {
      if (!dirs.includes(slug)) add(slug, 'registry_orphan', 'Registry entry has no skills/<slug>/ directory');
    }
  }
  return { checked: dirs.length, issues };
}

function main(argv) {
  let root = process.cwd();
  let json = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = resolve(arg.slice('--root='.length));
    else if (arg === '--json') json = true;
    else {
      console.error(`Unknown argument: ${arg}\nUsage: check-skill-quality.mjs [--root=<dir>] [--json]`);
      return 2;
    }
  }
  const { checked, issues } = auditSkills(root);
  if (json) {
    console.log(JSON.stringify({ ok: issues.length === 0, checked, issues }, null, 2));
  } else {
    console.log(`skill quality: checked ${checked} skill(s)`);
    for (const i of issues) console.error(`  FAIL ${i.skill} [${i.code}] ${i.message}`);
    console.log(issues.length === 0 ? 'skill quality: ok' : `skill quality: ${issues.length} issue(s)`);
  }
  return issues.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
