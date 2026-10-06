// Git permissions: on a harness installed from scratch, the agent may `git commit`, `git push` and
// `gh pr create` without asking — the three steps that close every lane (branch → commit → push →
// PR). A force-push still asks wherever the assistant can say so. The guards are untouched: a commit
// on a closed default branch is still denied by branch-guard, whatever the permission says.
//
// A PROJECT decision, recorded as `gitPermissions` in `.rsc.json`: true on a brand-new project, absent
// on one adopted before this existed (nothing changes there until `rsc git-permissions on`), false
// after `rsc git-permissions off`. Only rsc's own entries are ever added or removed; whatever the
// person allowed or denied stays exactly as it was.
//
// Cursor is left out on purpose: its CLI matches only the first word (`Shell(git)`), so allowing a
// push there would allow every git and gh command, `reset --hard` and `repo delete` included.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const GIT_PERMISSION_TARGETS = Object.freeze(['claude', 'codex', 'gemini', 'opencode']);

const CLAUDE_ALLOW = ['Bash(git commit *)', 'Bash(git push *)', 'Bash(gh pr create *)'];
// `ask` beats `allow` in Claude Code, and applies to any subcommand of a chain.
const CLAUDE_ASK = ['Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git push * --force*)', 'Bash(git push * -f*)'];
const GEMINI_ALLOW = ['run_shell_command(git commit)', 'run_shell_command(git push)', 'run_shell_command(gh pr create)'];
// OpenCode: the last matching rule wins, so the force-push asks come after the allows.
const OPENCODE_BASH = [
  ['git commit', 'allow'], ['git commit *', 'allow'], ['git push', 'allow'], ['git push *', 'allow'], ['gh pr create *', 'allow'],
  ['git push --force*', 'ask'], ['git push -f*', 'ask'], ['git push * --force*', 'ask'], ['git push * -f*', 'ask'],
];
const CODEX_RULES = `# rsc-git-permissions:managed — written by rsc; \`rsc git-permissions off\` removes it.
# Commit, push and open a PR without asking; a force-push still asks (the strictest match wins).
prefix_rule(pattern = ["git", "commit"], decision = "allow", justification = "rsc: close the lane — commit")
prefix_rule(pattern = ["git", "push"], decision = "allow", justification = "rsc: close the lane — push the branch")
prefix_rule(pattern = ["gh", "pr", "create"], decision = "allow", justification = "rsc: close the lane — open the PR")
prefix_rule(pattern = ["git", "push", ["--force", "-f", "--force-with-lease"]], decision = "prompt", justification = "rsc: a force-push rewrites the remote")
`;

const FILES = Object.freeze({
  claude: '.claude/settings.json',
  codex: '.codex/rules/rsc-git.rules',
  gemini: '.gemini/settings.json',
  opencode: 'opencode.json',
});

const git = (cwd, args) => {
  try { return execFileSync('git', args, { windowsHide: true, cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};
const rel = (cwd, path) => relative(cwd, path).split(sep).join('/');

/** A file rsc created is kept out of git with the local exclude; one the project tracks is merged into, never hidden. */
function excludeIfNew(cwd, path) {
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return;
  if (git(cwd, ['ls-files', '--', rel(cwd, path)])) return;
  const value = git(cwd, ['rev-parse', '--git-path', 'info/exclude']);
  if (!value) return;
  const file = isAbsolute(value) ? value : resolve(cwd, value);
  const pattern = `/${rel(cwd, path)}`;
  mkdirSync(dirname(file), { recursive: true });
  const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!body.split('\n').includes(pattern)) appendFileSync(file, `${body && !body.endsWith('\n') ? '\n' : ''}${pattern}\n`);
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

const writeJson = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
const addAll = (list, items) => [...(Array.isArray(list) ? list : []), ...items.filter((i) => !(list || []).includes(i))];
const dropAll = (list, items) => (Array.isArray(list) ? list.filter((i) => !items.includes(i)) : list);

export function gitPermissionsPath(target, cwd = process.cwd()) {
  return FILES[target] ? join(cwd, ...FILES[target].split('/')) : null;
}

/** Add rsc's entries. `{ mode: 'wired' | 'unsupported' | 'config-invalid', path }`. */
export function wireGitPermissions(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path) return { mode: 'unsupported', path: null };
  if (target === 'codex') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, CODEX_RULES);
    excludeIfNew(cwd, path);
    return { mode: 'wired', path };
  }
  const existed = existsSync(path);
  const config = readJson(path);
  if (!config) return { mode: 'config-invalid', path }; // never overwrite a file we cannot read
  if (target === 'claude') {
    config.permissions ||= {};
    config.permissions.allow = addAll(config.permissions.allow, CLAUDE_ALLOW);
    config.permissions.ask = addAll(config.permissions.ask, CLAUDE_ASK);
  } else if (target === 'gemini') {
    config.tools ||= {};
    config.tools.allowed = addAll(config.tools.allowed, GEMINI_ALLOW);
  } else if (target === 'opencode') {
    config.permission ||= {};
    if (typeof config.permission.bash === 'string') return { mode: 'config-invalid', path }; // a blanket rule is the person's call
    const bash = config.permission.bash && typeof config.permission.bash === 'object' ? config.permission.bash : {};
    // Re-inserted so the asks stay after the allows (OpenCode: the last matching rule wins).
    for (const [pattern] of OPENCODE_BASH) delete bash[pattern];
    for (const [pattern, action] of OPENCODE_BASH) bash[pattern] = action;
    config.permission.bash = bash;
    config.$schema ||= 'https://opencode.ai/config.json';
  }
  writeJson(path, config);
  if (!existed && target !== 'claude') excludeIfNew(cwd, path);
  return { mode: 'wired', path };
}

/** Remove rsc's entries, and nothing else. Returns the paths it touched. */
export function unwireGitPermissions(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path || !existsSync(path)) return [];
  if (target === 'codex') {
    if (!readFileSync(path, 'utf8').includes('rsc-git-permissions:managed')) return [];
    rmSync(path, { force: true });
    return [path];
  }
  const config = readJson(path);
  if (!config) return [];
  if (target === 'claude' && config.permissions) {
    config.permissions.allow = dropAll(config.permissions.allow, CLAUDE_ALLOW);
    config.permissions.ask = dropAll(config.permissions.ask, CLAUDE_ASK);
    for (const k of ['allow', 'ask']) if (Array.isArray(config.permissions[k]) && !config.permissions[k].length) delete config.permissions[k];
    if (!Object.keys(config.permissions).length) delete config.permissions;
  } else if (target === 'gemini' && config.tools) {
    config.tools.allowed = dropAll(config.tools.allowed, GEMINI_ALLOW);
    if (Array.isArray(config.tools.allowed) && !config.tools.allowed.length) delete config.tools.allowed;
    if (!Object.keys(config.tools).length) delete config.tools;
  } else if (target === 'opencode' && config.permission?.bash && typeof config.permission.bash === 'object') {
    for (const [pattern, action] of OPENCODE_BASH) if (config.permission.bash[pattern] === action) delete config.permission.bash[pattern];
    if (!Object.keys(config.permission.bash).length) delete config.permission.bash;
    if (!Object.keys(config.permission).length) delete config.permission;
  } else return [];
  writeJson(path, config);
  return [path];
}

/** Whether rsc's entries are all there, for `status` and `doctor`. */
export function gitPermissionsWired(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path || !existsSync(path)) return false;
  if (target === 'codex') return readFileSync(path, 'utf8').includes('rsc-git-permissions:managed');
  const config = readJson(path) || {};
  if (target === 'claude') return CLAUDE_ALLOW.every((r) => config.permissions?.allow?.includes(r));
  if (target === 'gemini') return GEMINI_ALLOW.every((r) => config.tools?.allowed?.includes(r));
  if (target === 'opencode') return OPENCODE_BASH.every(([p, a]) => config.permission?.bash?.[p] === a);
  return false;
}
