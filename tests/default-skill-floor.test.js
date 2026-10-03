import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SKILL_FLOOR, withDefaultSkillFloor } from '../scripts/lib/default-skill-floor.js';

test('the default floor equips unslop without making it runtime always-on', () => {
  // `ftd` added in 2.0.1: the always-on decisor routes ordinary work to it, so a harness
  // without it has a default lane pointing at nothing. See tests/sync-skill-floor.test.js.
  // `unslop` took the place of the retired `bro`.
  assert.deepEqual(DEFAULT_SKILL_FLOOR, ['orient', 'suggest', 'unslop', 'ftd']);
});

test('the default floor is stable, ordered and deduplicated for every install path', () => {
  assert.deepEqual(
    withDefaultSkillFloor(['unslop', 'fastapi', 'orient', 'postgresdb']),
    ['orient', 'suggest', 'unslop', 'ftd', 'fastapi', 'postgresdb'],
  );
});
