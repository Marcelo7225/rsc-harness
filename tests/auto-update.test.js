import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// The update notice asked, and asking depended on an agent relaying it: people kept running bugs
// that were already fixed. Now a release in the same major installs itself in the background, and a
// new major still asks. `.rsc/.no-auto-update` brings the question back for every release.
//
// `npx` is replaced by a fake that records how it was called and does what a successful sync does to
// the one file the hook reads: it writes the new version into `.rsc/.version`.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_START = join(ROOT, 'targets', 'session-start.mjs');

function project(installed, { optOut = false, targets = ['claude', 'codex'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-auto-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.version'), `${installed}\n`);
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({ version: 1, targets, skills: [] }));
  if (optOut) writeFileSync(join(root, '.rsc', '.no-auto-update'), '');
  const fake = join(root, 'fake-npx.mjs');
  writeFileSync(fake, `
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(join(root, 'called.json'))}, JSON.stringify({ args: process.argv.slice(2), to: process.env.RSC_AUTO_UPDATE_TO }));
if (!process.env.FAKE_FAIL) writeFileSync(${JSON.stringify(join(root, '.rsc', '.version'))}, process.env.RSC_AUTO_UPDATE_TO + '\\n');
`);
  return { root, fake };
}

function sessionStart({ root, fake }, latest, extra = {}) {
  const suggest = join(root, 'suggest-SKILL.md');
  writeFileSync(suggest, '# suggest\n');
  return spawnSync('node', [SESSION_START, suggest, root], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RSC_NO_UPDATE_CHECK: '',
      RSC_LATEST_JSON: '',
      RSC_LATEST: latest,
      RSC_AUTO_UPDATE_CMD: JSON.stringify([process.execPath, fake]),
      ...extra,
    },
  }).stdout;
}

// The background process is detached: wait for its footprint, never for the hook.
function waitFor(path, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (existsSync(path)) return true;
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)']);
  }
  return false;
}
const state = (root) => JSON.parse(readFileSync(join(root, '.rsc', 'auto-update.json'), 'utf8'));
const writeState = (root, s) => writeFileSync(join(root, '.rsc', 'auto-update.json'), JSON.stringify(s));
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

test('a minor in the same major installs itself, at that exact version, for every declared target', () => {
  const p = project('2.1.0');
  const out = sessionStart(p, '2.2.0');
  assert.match(out, /rsc updating/);
  assert.match(out, /next session/);
  assert.doesNotMatch(out, /update available/, 'nothing to ask');
  assert.ok(waitFor(join(p.root, 'called.json')), 'the background update ran');
  const called = JSON.parse(readFileSync(join(p.root, 'called.json'), 'utf8'));
  assert.deepEqual(called.args, ['sync', '--target', 'claude,codex']);
  assert.equal(called.to, '2.2.0', 'the version seen by the hook, never @latest');
  assert.deepEqual({ from: state(p.root).from, to: state(p.root).to }, { from: '2.1.0', to: '2.2.0' });
});

test('a patch installs itself too', () => {
  const p = project('2.1.0');
  assert.match(sessionStart(p, '2.1.1'), /rsc updating/);
  assert.ok(waitFor(join(p.root, 'called.json')));
});

test('the next session says once that it was updated, then stays quiet', () => {
  const p = project('2.1.0');
  sessionStart(p, '2.1.1');
  assert.ok(waitFor(join(p.root, 'called.json')));
  waitFor(join(p.root, 'never'), 300); // let the fake finish writing .version
  assert.equal(readFileSync(join(p.root, '.rsc', '.version'), 'utf8').trim(), '2.1.1');
  const second = sessionStart(p, '2.1.1');
  assert.match(second, /rsc updated itself in the background, from 2\.1\.0 to 2\.1\.1/);
  assert.doesNotMatch(sessionStart(p, '2.1.1'), /rsc updat/, 'said once');
});

test('a new major asks, and launches nothing', () => {
  const p = project('2.1.0');
  const out = sessionStart(p, '3.0.0');
  assert.match(out, /update available/);
  assert.match(out, /new major version/);
  assert.match(out, /if they say yes/);
  assert.equal(existsSync(join(p.root, '.rsc', 'auto-update.json')), false);
  assert.equal(waitFor(join(p.root, 'called.json'), 500), false);
});

test('with .no-auto-update every release asks, as before', () => {
  const p = project('2.1.0', { optOut: true });
  const out = sessionStart(p, '2.1.1');
  assert.match(out, /update available/);
  assert.doesNotMatch(out, /major/);
  assert.equal(waitFor(join(p.root, 'called.json'), 500), false);
});

test('an update still running is not launched again', () => {
  const p = project('2.1.0');
  writeState(p.root, { from: '2.1.0', to: '2.2.0', startedAt: hoursAgo(0.01) });
  const out = sessionStart(p, '2.2.0');
  assert.match(out, /still installing/);
  assert.equal(waitFor(join(p.root, 'called.json'), 500), false);
});

test('a failed update falls back to asking and is not retried the same day', () => {
  const p = project('2.1.0');
  writeState(p.root, { from: '2.1.0', to: '2.2.0', startedAt: hoursAgo(2) });
  const out = sessionStart(p, '2.2.0');
  assert.match(out, /update available/);
  assert.match(out, /did not finish/);
  assert.match(out, /auto-update\.log/);
  assert.equal(waitFor(join(p.root, 'called.json'), 500), false);
});

test('a failed update is retried after a day', () => {
  const p = project('2.1.0');
  writeState(p.root, { from: '2.1.0', to: '2.2.0', startedAt: hoursAgo(25) });
  assert.match(sessionStart(p, '2.2.0'), /rsc updating/);
  assert.ok(waitFor(join(p.root, 'called.json')));
});

test('a newer release than the failed one is tried at once', () => {
  const p = project('2.1.0');
  writeState(p.root, { from: '2.1.0', to: '2.2.0', startedAt: hoursAgo(2) });
  assert.match(sessionStart(p, '2.2.1'), /rsc updating/);
  assert.ok(waitFor(join(p.root, 'called.json')));
});

test('a version from the registry that is not a plain version launches nothing', () => {
  const p = project('2.1.0');
  const out = sessionStart(p, '2.2.0 && rm -rf ~');
  assert.doesNotMatch(out, /rsc updat/);
  assert.equal(waitFor(join(p.root, 'called.json'), 500), false);
});

test('a current install hears nothing', () => {
  const p = project('2.1.0');
  assert.doesNotMatch(sessionStart(p, '2.1.0'), /rsc updat|update available/);
});
