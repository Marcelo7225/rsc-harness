import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// #278 — accepting a plan regenerated user-profile.md from nothing. That file is not the plan's: `init`
// records there what it learns about the user, and `orient` changes the dial when they ask for more or
// less. Re-accepting after an update erased both, and dropped from `.rsc.json` any assistant added
// outside the plan.
//
// #276 — the dial had two names: the CLI wrote `accompaniment`, nine skill files read
// `accompaniment_level`, so the dial chosen at onboarding was invisible to the compass.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const base = (dial = 'L3', targets = 'claude') => ['onboard', '--target', targets, '--technical-level', 'non-technical',
  '--accompaniment', dial, '--project-kind', 'operations', '--goal', 'Llevar la facturación'];
function accept(cwd, args) {
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan to accept');
  const out = run(cwd, [...args, '--accept-plan', planId]);
  assert.doesNotMatch(out.stdout + out.stderr, /differs|RSC_PLAN_CHANGED/, out.stdout.slice(-400));
}
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-prof-'));
  execFileSync('git', ['init', '-q'], { cwd });
  return cwd;
}
const profilePath = (cwd) => join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md');
const profile = (cwd) => readFileSync(profilePath(cwd), 'utf8');
const edit = (cwd, fn) => writeFileSync(profilePath(cwd), fn(profile(cwd)));
const DISCOVERY = '\n## Descubrimiento\n\n- Dominio: gestoría de tres personas.\n- Intocable: la carpeta CONTABILIDAD/.\n';
const targets = (cwd) => JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).targets.sort();

test('#276 — the profile carries the dial under the one name every skill reads', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base());
  assert.match(profile(cwd), /^accompaniment_level: L3$/m);
  assert.doesNotMatch(profile(cwd), /^accompaniment: /m, 'the short name is gone for good');
});

test('#278 — re-accepting keeps what init discovered and the dial the user adjusted', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('L3'));
  edit(cwd, (p) => p.replace(/^accompaniment_level: L3$/m, 'accompaniment_level: L1') + DISCOVERY);
  accept(cwd, base('L3')); // the same plan again, as after an update or a reassess
  const p = profile(cwd);
  assert.match(p, /^accompaniment_level: L1$/m, 'the plan did not change the dial, so the user’s value stands');
  assert.ok(p.includes(DISCOVERY.trim()), 'the discovery survives');
  assert.match(p, /^project_kind: operations$/m);
  assert.match(p, /^Goal: Llevar la facturación$/m);
});

test('#278 — asking for a different dial explicitly still applies it', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('L3'));
  edit(cwd, (p) => p.replace(/^accompaniment_level: L3$/m, 'accompaniment_level: L1') + DISCOVERY);
  accept(cwd, base('L2')); // a new decision: the receipt said L3, now the user says L2
  assert.match(profile(cwd), /^accompaniment_level: L2$/m);
  assert.ok(profile(cwd).includes(DISCOVERY.trim()));
});

test('#276 — a profile written by an older version is migrated, not duplicated', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('L3'));
  // What 2.0.15 wrote, plus what init added afterwards.
  edit(cwd, (p) => p.replace(/^accompaniment_level: L3$/m, 'accompaniment: L3') + DISCOVERY);
  accept(cwd, base('L3'));
  const p = profile(cwd);
  assert.match(p, /^accompaniment_level: L3$/m);
  assert.doesNotMatch(p, /^accompaniment: /m);
  assert.ok(p.includes(DISCOVERY.trim()));
});

test('#278 — an assistant added outside the plan stays declared', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('L3', 'claude'));
  run(cwd, ['sync', '--target', 'codex']);
  assert.deepEqual(targets(cwd), ['claude', 'codex'], 'fixture: codex declared by sync');
  accept(cwd, base('L3', 'claude'));
  assert.deepEqual(targets(cwd), ['claude', 'codex']);
});

test('control — an assistant the new plan drops is still removed on purpose', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('L3', 'claude,codex'));
  accept(cwd, base('L3', 'claude'));
  assert.deepEqual(targets(cwd), ['claude']);
});

// The skills that read the dial must also understand the name older onboarding wrote, or a profile
// that was never re-accepted keeps its dial invisible after the update.
test('#276 — the skills that read the dial accept the older name', () => {
  const skills = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  for (const f of ['orient/SKILL.md', 'orient/references/orientation-contract.md', 'init/references/accompaniment-and-profile.md']) {
    assert.match(readFileSync(join(skills, f), 'utf8'), /`accompaniment:`/, `${f} must name the legacy key`);
  }
});
