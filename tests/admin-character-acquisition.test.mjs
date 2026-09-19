import test from 'node:test';
import assert from 'node:assert/strict';
import { acquisitionOf, acquisitionFlags } from '../admin/js/character-acquisition.js';
import { awakenMaxFor } from '../src/js/data/characters.js';
test('raid selection excludes gacha and enables raid awakening',()=>{
  const flags=acquisitionFlags('raid');
  assert.equal(flags.giftOnly,true);assert.equal(flags.raidDrop,true);
  assert.equal(awakenMaxFor(flags),10);
});
test('editing existing acquisition modes preserves their flags',()=>{
  for(const mode of ['raid','gift','gacha'])assert.equal(acquisitionOf(acquisitionFlags(mode)),mode);
  assert.equal(acquisitionOf({raidDrop:true,giftOnly:true}),'raid');
  assert.equal(acquisitionOf({}),'gacha');
  assert.equal(awakenMaxFor(acquisitionFlags('gift')),4);
  assert.deepEqual(acquisitionFlags('gacha'),{raidDrop:false,giftOnly:false});
});
