import test from 'node:test';
import assert from 'node:assert/strict';
import {giftMaterials, materialRewardText, addGiftMaterialTotals} from '../src/js/core/gift-materials.js';

test('gift accepts every evolution, awakening and enhancement material',()=>{
  const materials={mt_c0:3,mt_c1:4,mt_c2:5,mt_c3:6,mt_c4:7,mt_star:8,mt_awaken:9,mt_exp1:10,mt_exp2:11};
  assert.deepEqual(giftMaterials({materials}),materials);
  const text=materialRewardText({materials});
  for(const name of ['紅蓮の結晶','蒼海の結晶','翠緑の結晶','聖光の結晶','常闇の結晶','進化の輝石','開眼の証','経験の雫','経験の書']) assert.match(text,new RegExp(name));
});

test('unknown, negative and fractional material values cannot enter inventory',()=>{
  assert.deepEqual(giftMaterials({materials:{mt_star:2.9,mt_exp1:-4,unknown:99}}),{mt_star:2});
});

test('claim-all material totals combine multiple gifts',()=>{
  const total={materials:{}};
  addGiftMaterialTotals(total,{materials:{mt_star:2,mt_exp2:1}});
  addGiftMaterialTotals(total,{materials:{mt_star:3,mt_awaken:4}});
  assert.deepEqual(total.materials,{mt_star:5,mt_exp2:1,mt_awaken:4});
});
