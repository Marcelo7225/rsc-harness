// What a session start does for team-safe-default (rsc 3.0), beyond saying hello:
//
//   rescueTrunkCommits    — commits sitting on a CLOSED default branch that never reached the remote
//                           (left there by an agent before 3.0) move to a `rescue/…` branch, and the
//                           default branch goes back to what the remote has. Spec clarify P4.
//   relocateOldWorktrees  — worktrees older versions made OUTSIDE the project (sibling folders) move
//                           into `.worktrees/`. Only the ones rsc made, never one a session is working
//                           in, and a failure leaves it where it was. Spec clarify P6.
//   teamSafeAnnouncement  — once per project and machine, what changed in 3.0 and how to turn each
//                           part off. Spec, global criterion.
//
// Each returns the text to say, or ''. None throws: a session start is never worth breaking.
// Standalone siblings under `.rsc/`: trunk-policy.mjs, worktree-reaper.mjs, session-memory-core.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, sep } from 'node:path';

const git = (root, args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000 }).trim(); }
  catch { return null; }
};
const ok = (root, args) => git(root, args) !== null;
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');

export async function rescueTrunkCommits(root) {
  try {
    const { trunkPolicy, defaultBranchName } = await import(new URL('./trunk-policy.mjs', import.meta.url));
    const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const trunk = defaultBranchName(root);
    if (!branch || !trunk || branch !== trunk || !trunkPolicy(root).closed) return '';
    const remote = `refs/remotes/origin/${trunk}`;
    if (!git(root, ['rev-parse', '--verify', '--quiet', remote])) return '';
    const ahead = Number(git(root, ['rev-list', '--count', `${remote}..HEAD`]) || 0);
    if (!ahead) return '';
    const name = `rescue/${trunk}-${stamp()}`;
    if (!ok(root, ['branch', name, 'HEAD'])) return '';
    // --keep refuses instead of losing anything: a change in progress that the reset would touch.
    if (!ok(root, ['reset', '--quiet', '--keep', remote])) {
      return `rsc · ${ahead} commit(s) en «${trunk}» que no están en el remoto, y este proyecto tiene «${trunk}» cerrada para el agente. ` +
        `Los he copiado a la rama «${name}», pero no he podido dejar «${trunk}» como en el remoto porque hay cambios sin guardar que se verían afectados. ` +
        `Díselo a la persona en una línea; cuando esos cambios estén a salvo: \`git reset --keep origin/${trunk}\`.`;
    }
    return `rsc · Había ${ahead} commit(s) en «${trunk}» que nunca llegaron al remoto, y en este proyecto «${trunk}» está cerrada para el agente. ` +
      `Los he movido a la rama «${name}» y «${trunk}» vuelve a estar igual que en el remoto. Díselo a la persona en una línea.`;
  } catch { return ''; }
}

export async function relocateOldWorktrees(root) {
  try {
    const W = await import(new URL('./worktree-reaper.mjs', import.meta.url));
    let others = () => [];
    try {
      const M = await import(new URL('./session-memory-core.mjs', import.meta.url));
      others = (path) => M.otherActiveSessions({ cwd: root, worktreeCwd: path });
    } catch { /* no memory: nobody can be seen working, so nothing is moved (below) */ }
    const home = real(root);
    const moved = [];
    const left = [];
    for (const wt of W.listWorktrees(root)) {
      const path = real(wt.path);
      if (path === home || path.startsWith(home + sep)) continue; // already inside
      if (W.provenanceOf(root, { ...wt, path }) !== 'rsc') continue;
      if (others(path).length) { left.push(`${path} (una sesión trabaja en él)`); continue; }
      const dest = join(home, '.worktrees', basename(path).replace(`${basename(home)}-`, ''));
      if (existsSync(dest)) { left.push(`${path} (ya existe ${dest})`); continue; }
      mkdirSync(join(home, '.worktrees'), { recursive: true });
      if (ok(root, ['worktree', 'move', path, dest])) moved.push(`${path} → .worktrees/${basename(dest)}`);
      else left.push(`${path} (git no ha podido moverlo)`);
    }
    if (!moved.length && !left.length) return '';
    return [
      moved.length ? `rsc · Worktrees de versiones antiguas movidos dentro del proyecto: ${moved.join('; ')}.` : '',
      left.length ? `rsc · Sin mover, se reintenta en otra sesión: ${left.join('; ')}.` : '',
      'Díselo a la persona en una línea.',
    ].filter(Boolean).join(' ');
  } catch { return ''; }
}

const MARK = '.team-safe-3';

export function teamSafeAnnouncement(root) {
  try {
    const mark = join(root, '.rsc', MARK);
    if (existsSync(mark)) return '';
    mkdirSync(join(root, '.rsc'), { recursive: true });
    writeFileSync(mark, `${new Date().toISOString()}\n`);
    return `
===== rsc 3.0 · equipo seguro por defecto =====
ACTION: díselo a la persona en pocas líneas, una vez, antes de su petición:
1. En proyectos complejos o con producción, el agente no trabaja en la rama principal: abre ramas y
   cierra con PR. En proyectos sencillos trabaja en la principal. Para abrirla: «desbloquea main».
2. Si otra sesión de un asistente está trabajando en esta misma carpeta, el trabajo nuevo va a un
   worktree en .worktrees/<rama>/. Para no hacerlo: «no uses worktrees».
3. El agente elige solo entre FTD (lo sencillo) y SDD (lo grande o complejo) y lo dice; se puede
   pedir el otro.
4. 01-TOOLS/ y 02-DOCS/ viajan al equipo por la rama rsc/knowledge y llegan a la principal dentro de
   las PRs. Para apagarlo: rsc knowledge-sync off.
==============================================
`;
  } catch { return ''; }
}
