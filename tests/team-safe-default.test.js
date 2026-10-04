import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { trunkPolicy, trunkSignals, defaultBranchName, UNLOCK } from '../targets/trunk-policy.mjs';
import { evaluate, effectiveDir, unquoted, COMMITS_HERE, MOVES_BRANCH } from '../targets/branch-guard.mjs';
import { capture, otherActiveSessions, ACTIVE_WINDOW_MS } from '../targets/session-memory-core.mjs';
import { isolationContext } from '../targets/session-memory-adapter.mjs';

// team-safe-default, parts A and B: the default branch closed for the agent where the project shows it
// is complex, and no branch switching under another session working in the same checkout. Every
// denial must carry its way out (constitution P6) — asserted on the message itself, not assumed.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (root, rel, body = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };

function repo({ authors = ['Eric'] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-tsd-')));
  git(root, 'init', '-q', '-b', 'main');
  write(root, '.rsc.json', '{"version":1}');
  write(root, '.gitignore', '.rsc/\n');
  for (const [i, who] of authors.entries()) {
    git(root, 'config', 'user.name', who);
    git(root, 'config', 'user.email', `${who.toLowerCase()}@x`);
    write(root, `f${i}.txt`, `${i}\n`);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', `c${i}`);
  }
  return root;
}

// ------------------------------------------------------------------ trunk-policy (A)

test('tsd01 · a simple project leaves the default branch open; CI, a deployment or a team close it', () => {
  const simple = repo();
  assert.deepEqual(trunkPolicy(simple), { closed: false, reason: 'simple', signals: [] });
  const ci = repo(); write(ci, '.github/workflows/ci.yml');
  assert.equal(trunkPolicy(ci).closed, true);
  assert.match(trunkSignals(ci)[0], /CI/);
  const deploy = repo(); write(deploy, 'Dockerfile');
  assert.match(trunkSignals(deploy).join(), /despliegue/);
  const team = repo({ authors: ['Eric', 'Ana'] });
  assert.match(trunkSignals(team).join(), /equipo \(2 personas/);
});

test('tsd02 · an empty .github/workflows is not CI, and «desbloquea main» opens a complex project', () => {
  const r = repo(); mkdirSync(join(r, '.github', 'workflows'), { recursive: true });
  assert.equal(trunkPolicy(r).closed, false);
  write(r, '.github/workflows/ci.yml');
  write(r, `.rsc/${UNLOCK}`, '');
  assert.deepEqual(trunkPolicy(r), { closed: false, reason: 'unlocked', signals: [] });
});

test('tsd03 · the default branch name comes from the repo, with main/master as fallbacks', () => {
  assert.equal(defaultBranchName(repo()), 'main');
});

// ------------------------------------------------------------------ branch-guard: rule A

test('tsd10 · on a closed default branch a commit is denied, and the message says how to carry on', async () => {
  const r = repo(); write(r, 'Dockerfile');
  const reason = await evaluate({ root: r, command: 'git commit -m "✨ feat: x"', cwd: r });
  assert.match(reason, /closed for the agent/);
  assert.match(reason, /git switch -c feat\//, 'P6: the way out is in the message');
  assert.match(reason, /rsc main unlock/, 'P6: and the unlock, for a project that is really simple');
  assert.match(await evaluate({ root: r, command: 'git -C . merge feat/x', cwd: r }), /closed for the agent/);
});

test('tsd14 · a search for the words "git commit" on a closed default branch is not denied', async () => {
  const r = repo(); write(r, 'Dockerfile');
  assert.equal(await evaluate({ root: r, command: 'grep -rn "git commit" docs/', cwd: r }), null);
});

test('tsd11 · commits are allowed on a branch, in a simple project, and once unlocked', async () => {
  const r = repo(); write(r, 'Dockerfile');
  git(r, 'switch', '-q', '-c', 'feat/x');
  assert.equal(await evaluate({ root: r, command: 'git commit -m x', cwd: r }), null);
  const s = repo();
  assert.equal(await evaluate({ root: s, command: 'git commit -m x', cwd: s }), null);
  const u = repo(); write(u, 'Dockerfile'); write(u, `.rsc/${UNLOCK}`, '');
  assert.equal(await evaluate({ root: u, command: 'git commit -m x', cwd: u }), null);
});

test('tsd12 · it judges the folder the command runs in, so a worktree on its own branch is fine', async () => {
  const r = repo(); write(r, 'Dockerfile');
  git(r, 'worktree', 'add', '-q', '.worktrees/feat-x', '-b', 'feat/x');
  assert.equal(await evaluate({ root: r, command: 'git -C .worktrees/feat-x commit -m x', cwd: r }), null);
  assert.equal(await evaluate({ root: r, command: 'cd .worktrees/feat-x && git commit -m x', cwd: r }), null);
  assert.equal(effectiveDir('git -C "/a b" commit', '/r'), '/a b');
});

test('tsd13 · only git commands that land work are seen; words inside other commands are not', () => {
  for (const c of ['git commit -m x', 'git -C x commit', 'git merge y', 'git cherry-pick abc']) assert.ok(COMMITS_HERE.test(c), c);
  for (const c of ['grep -rn "git commit" docs/', "echo 'git merge x'", 'git commit-tree abc', 'git log']) assert.ok(!COMMITS_HERE.test(unquoted(c)), c);
  assert.ok(COMMITS_HERE.test(unquoted('git commit -m "fix: a \\"quoted\\" word"')), 'a real commit with a quoted message is still a commit');
  for (const c of ['git switch feat/x', 'git checkout feat/x', 'git checkout -b feat/y']) assert.ok(MOVES_BRANCH.test(c), c);
  for (const c of ['git checkout -- file.txt', 'git checkout HEAD -- a.js', 'git switchx']) assert.ok(!MOVES_BRANCH.test(c), c);
});

// ------------------------------------------------------------------ sessions + rule B

function session(root, id, target = 'codex', at = new Date().toISOString(), extra = {}) {
  write(root, `work-${id}.txt`, id); // the journal only records sessions that did work
  return capture({ cwd: root, sessionId: id, target, event: 'edit', editDelta: 1, now: at, ...extra });
}

test('tsd20 · another session with work in the last 30 minutes counts; old, closed and self do not', () => {
  const r = repo();
  session(r, 'other', 'codex');
  // The spec fixes the window at 30 minutes; a literal, so widening the constant cannot pass.
  session(r, 'old', 'gemini', new Date(Date.now() - 31 * 60 * 1000).toISOString());
  session(r, 'recent', 'opencode', new Date(Date.now() - 29 * 60 * 1000).toISOString());
  session(r, 'closed', 'cursor');
  capture({ cwd: r, sessionId: 'closed', target: 'cursor', event: 'sessionEnd' });
  session(r, 'me', 'claude');
  const others = otherActiveSessions({ cwd: r, sessionId: 'me', target: 'claude' });
  assert.deepEqual(others.map((o) => o.sessionId).sort(), ['other', 'recent']);
  assert.equal(ACTIVE_WINDOW_MS, 30 * 60 * 1000);
});

test('tsd21 · with another active session, switching branches here is denied, with the worktree way out', async () => {
  const r = repo();
  session(r, 'other', 'codex');
  const reason = await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' });
  assert.match(reason, /Another session is working in this same folder \(codex/);
  assert.match(reason, /git worktree add \.worktrees\//, 'P6: the way out is in the message');
  assert.match(reason, /rsc isolation off/);
});

test('tsd22 · alone, or with isolation turned off, switching branches is allowed', async () => {
  const r = repo();
  assert.equal(await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' }), null);
  session(r, 'other', 'codex');
  write(r, '.rsc/.no-worktree-isolation', '');
  assert.equal(await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' }), null);
});

test('tsd23 · the model is told to use a worktree while another session is active, and only then', () => {
  const r = repo();
  assert.equal(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), '');
  session(r, 'other', 'codex');
  assert.match(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), /\.worktrees\/<rama>/);
  write(r, '.rsc/.no-worktree-isolation', '');
  assert.equal(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), '');
});

test('tsd24 · the guard runs as the hook process Claude Code calls, and denies in its JSON', () => {
  const r = repo(); write(r, 'Dockerfile');
  const script = join(import.meta.dirname, '..', 'targets', 'branch-guard.mjs');
  const out = spawnSync(process.execPath, [script, r], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: r }), encoding: 'utf8',
  });
  assert.equal(out.status, 0);
  assert.equal(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const ok = spawnSync(process.execPath, [script, r], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }), encoding: 'utf8' });
  assert.equal(ok.stdout, '', 'an unrelated command is allowed silently');
});

// ------------------------------------------------------------------ session start (3.0 duties)

function withRemote(root) {
  const bare = `${root}-remote.git`;
  git(root, 'init', '-q', '--bare', '-b', 'main', bare);
  git(root, 'remote', 'add', 'origin', bare);
  git(root, 'push', '-q', '-u', 'origin', 'main');
  git(root, 'fetch', '-q', 'origin');
  return bare;
}

test('tsd30 · commits stranded on a closed default branch move to a rescue branch, and main matches the remote', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); write(r, 'Dockerfile'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'docker');
  withRemote(r);
  write(r, 'a.txt', 'agent 1\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent 1');
  write(r, 'b.txt', 'agent 2\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent 2');
  const said = await rescueTrunkCommits(r);
  assert.match(said, /2 commit\(s\)/);
  assert.equal(git(r, 'rev-parse', 'HEAD'), git(r, 'rev-parse', 'origin/main'));
  const rescue = git(r, 'branch', '--list', 'rescue/*').replace(/^[*\s]+/, '');
  assert.equal(git(r, 'log', '-1', '--format=%s', rescue), 'agent 2', 'the work is on the rescue branch');
  assert.equal(await rescueTrunkCommits(r), '', 'idempotent: nothing left to rescue');
});

test('tsd31 · a change in progress the reset would touch stops it: copied, not reset, and said how to finish', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); write(r, 'Dockerfile'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'docker');
  withRemote(r);
  write(r, 'a.txt', 'agent\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent');
  write(r, 'a.txt', 'in progress\n');
  const said = await rescueTrunkCommits(r);
  assert.match(said, /no he podido dejar/);
  assert.match(said, /git reset --keep origin\/main/, 'P6: how to finish is in the message');
  assert.equal(readFileSync(join(r, 'a.txt'), 'utf8'), 'in progress\n', 'the change in progress was lost');
});

test('tsd32 · a simple project keeps its commits on main', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); withRemote(r);
  write(r, 'a.txt', 'x\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'mine');
  assert.equal(await rescueTrunkCommits(r), '');
});

test('tsd33 · an old sibling worktree made by rsc moves into .worktrees/, keeping unsaved work', async () => {
  const { relocateOldWorktrees } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const sibling = `${r}-feat-x`;
  git(r, 'worktree', 'add', '-q', sibling, '-b', 'feat/x');
  write(sibling, 'unsaved.txt', 'not committed\n');
  const said = await relocateOldWorktrees(r);
  assert.match(said, /movidos dentro del proyecto/);
  const dest = join(r, '.worktrees', 'feat-x');
  assert.equal(readFileSync(join(dest, 'unsaved.txt'), 'utf8'), 'not committed\n');
  assert.ok(git(r, 'worktree', 'list').includes(dest), 'git still knows it as a worktree');
});

test('tsd34 · a worktree made by hand, or one a session is working in, is not moved', async () => {
  const { relocateOldWorktrees } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const mine = join(realpathSync(mkdtempSync(join(tmpdir(), 'rsc-hand-'))), 'scratch');
  git(r, 'worktree', 'add', '-q', mine, '-b', 'experiment');
  const busy = `${r}-feat-busy`;
  git(r, 'worktree', 'add', '-q', busy, '-b', 'feat/busy');
  write(busy, 'w.txt', 'w');
  capture({ cwd: r, worktreeCwd: busy, sessionId: 'other', target: 'codex', event: 'edit', editDelta: 1 });
  const said = await relocateOldWorktrees(r);
  assert.ok(existsSync(mine), 'a hand-made worktree was moved');
  assert.ok(existsSync(busy), 'a worktree with an active session was moved');
  assert.match(said, /una sesión trabaja en él/);
});

test('tsd35 · the 3.0 announcement is said once per project and machine, with every way to turn it off', async () => {
  const { teamSafeAnnouncement } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const first = teamSafeAnnouncement(r);
  for (const off of ['desbloquea main', 'no uses worktrees', 'pedir el otro', 'rsc knowledge-sync off']) assert.match(first, new RegExp(off));
  assert.equal(teamSafeAnnouncement(r), '');
});

// ------------------------------------------------------------------ the switches a person asks for

test('tsd40 · «desbloquea main» and «no uses worktrees» become project decisions in .rsc.json, and back', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const { readManifest } = await import('../scripts/lib/manifest-file.js');
  const r = repo(); write(r, 'Dockerfile');
  await applyInstall({ skillIds: ['suggest', 'orient'], target: 'claude', home: r, cwd: r });
  for (const f of ['branch-guard.mjs', 'trunk-policy.mjs', 'team-safe-start.mjs']) assert.ok(existsSync(join(r, '.rsc', f)), `${f} installed`);
  const cli = (...a) => execFileSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'rsc.js'), ...a], { cwd: r, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(JSON.parse(cli('main', 'status')).closed, true);
  cli('main', 'unlock');
  cli('isolation', 'off');
  assert.deepEqual(readManifest(r).optOuts, ['trunk-guard', 'worktree-isolation']);
  assert.equal(JSON.parse(cli('main', 'status')).reason, 'unlocked');
  cli('main', 'lock');
  cli('isolation', 'on');
  assert.deepEqual(readManifest(r).optOuts, []);
  const settings = readFileSync(join(r, '.claude', 'settings.json'), 'utf8');
  assert.match(settings, /branch-guard\.mjs/, 'the guard is wired');
});
