import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LEADER_PARTS, ACTIVE_PARTS, partsFor, decompose, compose, defaultsOf
} from '../admin/js/skill-parts.js';
import { LEADER_SKILLS, ACTIVE_SKILLS, describeLeaderSkill, describeActiveSkill }
  from '../src/js/data/skills.js';

/* 管理ツールのスキル組み立ては「既存を分解 → 組み替え → 登録」なので、
   分解と組み立てが往復で一致しないと、触っただけで中身が変わってしまう。 */

test('パーツはエンジンが実際に読むキーだけを並べている', async () => {
  // 飾りのパーツを足しても効果が出ないので、battle/ が読んでいることを確かめる
  const sources = await Promise.all(
    ['battle/damage.js', 'battle/party.js', 'battle/battle.js']
      .map(f => readFile(new URL(`../src/js/${f}`, import.meta.url), 'utf8'))
  );
  const code = sources.join('\n');
  [...LEADER_PARTS, ...ACTIVE_PARTS].forEach(part => {
    assert.ok(code.includes(`.${part.key}`),
      `${part.key} を battle/ が読んでいない(効果が出ないパーツ)`);
  });
});

test('既存のリーダースキルは分解して組み直すと元に戻る', () => {
  Object.entries(LEADER_SKILLS).forEach(([id, ls]) => {
    const rebuilt = compose(decompose(ls, 'leader'), 'leader');
    partsFor('leader').forEach(part => {
      if (ls[part.key] == null) return;
      assert.deepEqual(rebuilt[part.key], ls[part.key],
        `${id} の ${part.key} が往復で変わった`);
    });
  });
});

test('既存のスキルも分解して組み直すと元に戻る', () => {
  Object.entries(ACTIVE_SKILLS).forEach(([id, sk]) => {
    const rebuilt = compose(decompose(sk, 'active'), 'active');
    partsFor('active').forEach(part => {
      if (sk[part.key] == null || sk[part.key] === false) return;
      // convert は複数持てる(カイ専用)。パーツ表は1つだけ扱うので先頭で比べる
      if (part.key === 'convert' && Array.isArray(sk.convert)) {
        assert.deepEqual(rebuilt.convert, sk.convert[0]);
        return;
      }
      assert.deepEqual(rebuilt[part.key], sk[part.key], `${id} の ${part.key} が往復で変わった`);
    });
  });
});

test('パーツの既定値は、そのパーツが許す範囲に収まっている', () => {
  ['leader', 'active'].forEach(kind => {
    partsFor(kind).forEach(part => {
      const d = defaultsOf(part.key, kind);
      part.fields.forEach(f => {
        const v = d.values[f.key];
        if (f.type === 'aura') { assert.ok(/^c[0-4]$/.test(v)); return; }
        assert.ok(v >= f.min && v <= f.max, `${part.key}.${f.key} の既定値 ${v} が範囲外`);
      });
    });
  });
});

test('組み立てたスキルは説明を自動で書ける', () => {
  const ls = compose([
    { key: 'auraAtk', values: { aura: 'c0', mult: 3 } },
    { key: 'comboAtk', values: { combo: 4, mult: 1.5 } },
    { key: 'damageCut', values: { rate: 0.2 } }
  ], 'leader');
  const text = describeLeaderSkill(ls);
  assert.ok(text.includes('火オーラ3倍'), text);
  assert.ok(text.includes('4コンボ'), text);
  assert.ok(text.includes('20%減'), text);

  const sk = compose([
    { key: 'timeThisTurn', values: { seconds: 5 } },
    { key: 'fixedDamage', values: { mult: 12 } },
    { key: 'spawn', values: { to: 'c0', count: 6 } }
  ], 'active');
  const t2 = describeActiveSkill(sk);
  assert.ok(t2.includes('+5.0秒') && t2.includes('×12') && t2.includes('6個'), t2);
});

test('どのパーツも空の値では壊れたスキルを作らない', () => {
  ['leader', 'active'].forEach(kind => {
    partsFor(kind).forEach(part => {
      const built = compose([defaultsOf(part.key, kind)], kind);
      const value = built[part.key];
      assert.notEqual(value, undefined, `${part.key} が undefined になった`);
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${part.key} が NaN`);
    });
  });
});
