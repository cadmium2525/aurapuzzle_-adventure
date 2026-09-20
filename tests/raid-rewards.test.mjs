import test from 'node:test';
import assert from 'node:assert/strict';
import { RAID_STAGES } from '../src/js/data/raids.js';
import { raidDropSummaryHTML, raidDropResultHTML } from '../src/js/data/raid-rewards.js';

test('each raid displays its configured character in summary and both result states', () => {
  for (const [id, name] of [[2001,'キュウコ'],[2002,'リリム=ノクティア']]) {
    const stage=RAID_STAGES.find(s=>s.id===id);
    assert.equal(raidDropSummaryHTML(stage),`全10フロア ・ ${name} ★3 基本50%ドロップ`);
    assert.equal(raidDropResultHTML(stage,stage.characterDrop.id,.7),`${name} ★3 ×1 獲得！（確率70%）`);
    assert.equal(raidDropResultHTML(stage,null,.5),`${name} ★3のドロップなし（確率50%）`);
  }
});

test('floor count, rarity and base rate are not fixed to the first raid',()=>{
  const stage={floors:[{},{}],characterDrop:{id:'fl_ignis',rate:.25}};
  // Use a published character with a different rarity, independent of raid drop eligibility.
  assert.match(raidDropSummaryHTML(stage),/^全2フロア ・ .* ★4 基本25%ドロップ$/);
  assert.equal(raidDropSummaryHTML({floors:[{}]}),'全1フロア');
  assert.equal(raidDropResultHTML({floors:[{}]},null,0),'');
});
