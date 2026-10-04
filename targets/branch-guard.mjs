#!/usr/bin/env node
// rsc Branch guard (claude). Wired by targets/claude.js onto PreToolUse (matcher Bash) as
// `node ...`, like ship-guard. argv[2] = project root · stdin = PreToolUse hook JSON.
//
// Two rules from team-safe-default, each the deterministic floor of something the skills decide:
//
//   A · the default branch is closed for the agent where the project shows it is complex or in
//       production (trunk-policy.mjs). A commit or a merge there is denied, and the message says
//       how to carry on: a branch, or — if the project is in fact simple — the person unlocking it.
//   B · another session is working in this same checkout (session-memory-core.mjs). Switching
//       branches here would change its files under it, so it is denied, and the message says how to
//       carry on: a worktree under `.worktrees/`.
//
// Every denial carries its way out (constitution P6). Only what the AGENT runs is seen: a person
// committing in their own terminal is never touched (spec, P3). FAIL-OPEN: no repo, no git, a module
// missing, anything unclear → allow. Opt-outs, both PROJECT switches: `.rsc/.no-trunk-guard`
// («desbloquea main» / `rsc main unlock`) and `.rsc/.no-worktree-isolation` (`rsc isolation off`).
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

const GIT_OPTS = String.raw`(?:(?:-C\s+\S+|-c\s+\S+|--\S+)\s+)*`;
export const COMMITS_HERE = new RegExp(String.raw`\bgit\s+${GIT_OPTS}(?:commit|merge|cherry-pick|revert|am)(?![\w-])`);
// A branch move: switch, or checkout of something that is not a path (`checkout -- f`, `checkout HEAD -- f`).
export const MOVES_BRANCH = new RegExp(String.raw`\bgit\s+${GIT_OPTS}(?:switch(?![\w-])|checkout(?![\w-])(?![^;&|\n]*\s--(?:\s|$)))`);

export const unquoted = (command) => command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

/** Where the git command actually runs: `git -C <dir>`, or a leading `cd <dir> &&`, else the cwd. */
export function effectiveDir(command, base) {
  const c = command.match(/\bgit\s+(?:-c\s+\S+\s+)*-C\s+("[^"]+"|'[^']+'|\S+)/);
  const d = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/);
  const raw = (c || d)?.[1]?.replace(/^["']|["']$/g, '');
  if (!raw) return base;
  return isAbsolute(raw) ? raw : resolve(base, raw);
}

const gitAt = (dir) => (...args) => {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : null;
};

const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min <= 1 ? 'just now' : `${min} min ago`;
};

export async function evaluate({ root, command, cwd, sessionId }) {
  if (typeof command !== 'string' || !command) return null;
  // Words inside quotes are text, not commands: `grep -rn "git commit" docs/` must not read as a commit.
  const bare = unquoted(command);
  const commits = COMMITS_HERE.test(bare);
  const moves = MOVES_BRANCH.test(bare);
  if (!commits && !moves) return null;
  const dir = effectiveDir(command, cwd || root);
  const git = gitAt(dir);
  const top = git('rev-parse', '--show-toplevel');
  if (!top) return null;
  const here = (() => { try { return realpathSync(top); } catch { return top; } })();
  const self = dirname => new URL(dirname, import.meta.url);

  if (commits && !existsSync(join(root, '.rsc', '.no-trunk-guard'))) {
    try {
      const { trunkPolicy, defaultBranchName } = await import(self('./trunk-policy.mjs'));
      const branch = git('symbolic-ref', '--quiet', '--short', 'HEAD');
      const trunk = defaultBranchName(here);
      if (branch && trunk && branch === trunk) {
        const policy = trunkPolicy(here);
        if (policy.closed) {
          // Where the branch goes depends on rule B: alone → this same folder; with company → .worktrees/.
          let others = [];
          if (!existsSync(join(root, '.rsc', '.no-worktree-isolation'))) {
            try {
              const { otherActiveSessions } = await import(self('./session-memory-core.mjs'));
              others = otherActiveSessions({ cwd: root, worktreeCwd: here, sessionId, target: 'claude' });
            } catch { /* no memory → treated as alone */ }
          }
          const where = others.length
            ? 'Another session is working in this folder, so open it as a worktree inside the project: `git worktree add .worktrees/<branch> -b feat/<what-you-are-doing>` and commit inside `.worktrees/<branch>/`'
            : 'You are the only session here, so stay in this same folder, no worktree: `git switch -c feat/<what-you-are-doing>` (or fix/…, docs/…) and commit there';
          return `This project keeps its default branch "${trunk}" closed for the agent (it looks complex or in production: ${policy.signals.join(', ')}). ` +
            `Do this work on a branch instead. ${where}; it reaches "${trunk}" through a pull request. ` +
            'If this project is actually simple and the person asks to unlock it, run `npx @ericrisco/rsc main unlock` (a project decision, saved in .rsc.json).';
        }
      }
    } catch { /* policy module missing → nothing to enforce */ }
  }

  if (moves && !existsSync(join(root, '.rsc', '.no-worktree-isolation'))) {
    try {
      const { otherActiveSessions } = await import(self('./session-memory-core.mjs'));
      const others = otherActiveSessions({ cwd: root, worktreeCwd: here, sessionId, target: 'claude' });
      if (others.length) {
        const who = others.map((o) => `${o.target}${o.branch ? ` on "${o.branch}"` : ''}, ${ago(o.updatedAt)}`).join('; ');
        return `Another session is working in this same folder (${who}). Switching branches here would change its files under it. ` +
          'Work in a worktree instead, inside the project: `git worktree add .worktrees/<branch> -b <branch>` (or without -b for an existing branch) and run everything inside `.worktrees/<branch>/`; tell the person that is where the project now runs. ' +
          'To turn this rule off for the project: `npx @ericrisco/rsc isolation off`.';
      }
    } catch { /* no memory module → no detection */ }
  }
  return null;
}

function isMain(metaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const me = fileURLToPath(metaUrl);
  try { return realpathSync(me) === realpathSync(invoked); } catch { return me === invoked; }
}

if (isMain(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  if (!existsSync(join(root, '.git'))) allow();
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { allow(); }
  if ((input.tool_name || input.toolName) !== 'Bash') allow();
  const command = input.tool_input?.command || input.toolInput?.command || '';
  const reason = await evaluate({ root, command, cwd: input.cwd || root, sessionId: input.session_id });
  if (reason) deny(reason);
  allow();
}
