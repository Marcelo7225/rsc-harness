// A harness installed from scratch lets the agent close the lane — git commit, git push, gh pr create —
// without asking each time; a force-push still asks. A project decision (`gitPermissions` in .rsc.json),
// so older projects are not changed behind anyone's back and a clone gets what the team decided.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, syncInstalled } from '../scripts/install-apply.js';
import { readManifest, writeManifest } from '../scripts/lib/manifest-file.js';
import { wireGitPermissions, unwireGitPermissions, gitPermissionsWired } from '../targets/git-permissions.js';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gp-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  return cwd;
}

test('gp01 · a harness installed from scratch allows commit, push and PR, and asks before a force-push', async () => {
  const cwd = project();
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const { permissions } = json(join(cwd, '.claude', 'settings.json'));
  for (const rule of ['Bash(git commit *)', 'Bash(git push *)', 'Bash(gh pr create *)']) assert.ok(permissions.allow.includes(rule), rule);
  assert.ok(permissions.ask.includes('Bash(git push --force*)'));
  assert.equal(readManifest(cwd).gitPermissions, true, 'the decision travels with the project');
});

test('gp02 · a project adopted before this keeps its permissions untouched until someone turns it on', async () => {
  const cwd = project();
  writeManifest(cwd, { version: 1, targets: ['claude'], skills: ['suggest'], agents: [] });
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  assert.equal(json(join(cwd, '.claude', 'settings.json')).permissions, undefined);
  assert.equal(readManifest(cwd).gitPermissions, undefined);
});

test('gp03 · off removes only rsc\'s entries and sticks across sync; on puts them back', async () => {
  const cwd = project();
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test *)'], deny: ['Bash(rm -rf *)'] } }));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  writeManifest(cwd, { ...readManifest(cwd), gitPermissions: false });
  await syncInstalled({ target: 'claude', cwd });
  let p = json(join(cwd, '.claude', 'settings.json')).permissions;
  assert.deepEqual(p.allow, ['Bash(npm test *)'], 'the person\'s own allow stays');
  assert.deepEqual(p.deny, ['Bash(rm -rf *)'], 'the person\'s own deny stays');
  assert.equal(p.ask, undefined);
  await syncInstalled({ target: 'claude', cwd });
  assert.equal(gitPermissionsWired('claude', cwd), false, 'sync does not bring them back');
  writeManifest(cwd, { ...readManifest(cwd), gitPermissions: true });
  await syncInstalled({ target: 'claude', cwd });
  p = json(join(cwd, '.claude', 'settings.json')).permissions;
  assert.ok(p.allow.includes('Bash(git push *)') && p.allow.includes('Bash(npm test *)'));
});

test('gp04 · a clone of a project that decided "on" gets the same permissions', async () => {
  const cwd = project();
  writeManifest(cwd, { version: 1, targets: ['codex'], skills: ['suggest'], agents: [], gitPermissions: true });
  await syncInstalled({ target: 'codex', cwd });
  assert.match(readFileSync(join(cwd, '.codex', 'rules', 'rsc-git.rules'), 'utf8'), /prefix_rule\(pattern = \["git", "push"\], decision = "allow"/);
});

test('gp05 · OpenCode: rsc\'s asks stay after its allows (last match wins), and the person\'s rules survive', () => {
  const cwd = project();
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ model: 'x', permission: { bash: { '*': 'ask', 'npm *': 'allow' } } }));
  wireGitPermissions('opencode', cwd);
  const c = json(join(cwd, 'opencode.json'));
  assert.equal(c.model, 'x');
  const keys = Object.keys(c.permission.bash);
  assert.ok(keys.indexOf('git push --force*') > keys.indexOf('git push *'), 'a force-push would be allowed');
  assert.equal(c.permission.bash['*'], 'ask');
  unwireGitPermissions('opencode', cwd);
  assert.deepEqual(json(join(cwd, 'opencode.json')).permission.bash, { '*': 'ask', 'npm *': 'allow' });
});

test('gp06 · Gemini adds to tools.allowed; an unreadable config is never overwritten; Cursor is not touched', () => {
  const cwd = project();
  assert.equal(wireGitPermissions('gemini', cwd).mode, 'wired');
  assert.ok(json(join(cwd, '.gemini', 'settings.json')).tools.allowed.includes('run_shell_command(git push)'));
  writeFileSync(join(cwd, '.gemini', 'settings.json'), '{ not json');
  assert.equal(wireGitPermissions('gemini', cwd).mode, 'config-invalid');
  assert.equal(readFileSync(join(cwd, '.gemini', 'settings.json'), 'utf8'), '{ not json');
  assert.equal(wireGitPermissions('cursor', cwd).mode, 'unsupported');
  assert.ok(!existsSync(join(cwd, '.cursor', 'cli.json')));
});
