import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { eventCatalog,activeEvents,eventMaterials,eventShopItems,isAvailable } from '../src/js/data/availability.js';
import { CHARACTERS,gachaPoolAt,resolveCharacter,materialById,canEvolveChar } from '../src/js/data/gamedata.js';
import { RAID_STAGES,rollRaidCharacter } from '../src/js/data/raids.js';
import { isBossEnemy,spawnEnemy } from '../src/js/data/enemy-master.js';
import { CHAR_ATLAS } from '../src/js/data/char-atlas.js';
import { state,addCharacter,addMaterials,resolveOwned,shopRemaining,recordShopPurchase } from '../src/js/core/state.js';
const event=eventCatalog().find(e=>e.id==='halloween_2026');
const start=Date.parse('2026-10-01T00:00:00+09:00'),end=Date.parse('2026-11-01T00:00:00+09:00');
const costumes=CHARACTERS.filter(c=>c.eventId===event.id);
test('published Halloween registration has five costumes and all twenty atlas-backed assets',()=>{
  assert.equal(costumes.length,5);
  for(const c of costumes){
    assert.equal(c.rarity,4);assert.equal(canEvolveChar(c,4),true);
    assert.equal(c.artStages.length,2);
    for(const art of c.artStages){assert.ok(existsSync(art.full));assert.ok(existsSync(art.icon));assert.ok(CHAR_ATLAS[art.icon]);}
    assert.equal(resolveCharacter(c.id,5,1).name,c.evoName);
  }
  assert.ok(existsSync(event.banner));assert.ok(existsSync(event.currency.icon));
});
test('exactly four costumes enter gacha at JST start and leave at end; exchange Kyuko never enters',()=>{
  for(const now of [start-1,end]){
    assert.equal(activeEvents(now).includes(event),false);
    assert.equal(gachaPoolAt(now).filter(c=>c.eventId===event.id).length,0);
  }
  for(const now of [start,end-1]){
    assert.equal(activeEvents(now).includes(event),true);
    assert.deepEqual(gachaPoolAt(now).filter(c=>c.eventId===event.id).map(c=>c.id).sort(),['hw_kai','hw_mio','hw_noa','hw_rune']);
  }
});
test('three event-only dungeons reward increasing candy and never drop raid characters',()=>{
  const stages=RAID_STAGES.filter(s=>s.eventId===event.id);
  assert.equal(stages.length,3);
  assert.deepEqual(stages.map(s=>s.currencyDrop.amount),[10,25,50]);
  assert.deepEqual(stages.map(s=>s.floors.length),[3,4,5]);
  for(const s of stages){
    assert.equal(s.raid,false);assert.equal(s.event,true);assert.equal(s.bgm,'battle');
    assert.equal(rollRaidCharacter(s,[],()=>0),null);
    assert.equal(isAvailable(s,start-1),false);assert.equal(isAvailable(s,start),true);assert.equal(isAvailable(s,end),false);
    assert.equal(s.currencyDrop.id,event.currency.id);
    for(const f of s.floors) for(const e of f.enemies) assert.equal(isBossEnemy(e.id),false);
  }
});
test('a dungeon appearance override preserves the enemy master and its combat behavior',()=>{
  const regular=spawnEnemy({id:'gost',mult:{hp:.12,atk:.35}});
  const costumed=spawnEnemy({id:'gost',mult:{hp:.12,atk:.35},sprite:'assets/enemy/hw_gost.webp'});
  assert.equal(costumed.sprite,'assets/enemy/hw_gost.webp');
  assert.equal(regular.sprite,'assets/enemy/gost.webp');
  assert.equal(costumed.hp,regular.hp);
  assert.equal(costumed.atk,regular.atk);
  assert.deepEqual(costumed.enemySkills,regular.enemySkills);
});
test('every Halloween encounter uses its costume and every floor uses the event arena',()=>{
  const stages=RAID_STAGES.filter(s=>s.eventId===event.id);
  const background='assets/ui/halloween_battle.webp';
  assert.ok(existsSync(background));
  for(const stage of stages){
    assert.equal(stage.battleBackground,background);
    for(const floor of stage.floors) for(const enemy of floor.enemies){
      assert.equal(enemy.sprite,`assets/enemy/hw_${enemy.id}.webp`);
      assert.ok(existsSync(enemy.sprite));
    }
  }
});
test('event exchange has validated finite limits and persistent material/owned masters',()=>{
  const items=eventShopItems().filter(i=>i.eventId===event.id);
  assert.equal(items.length,6);
  for(const item of items){
    assert.equal(item.currency,event.currency.id);assert.ok(item.price>0);assert.ok(item.totalLimit>0);
    assert.equal(isAvailable(item,start),true);assert.equal(isAvailable(item,end),false);
    if(item.matId)assert.ok(materialById(item.matId));
  }
  const kyuko=items.find(i=>i.charId==='hw_kyuko');
  assert.equal(kyuko.price,500);assert.equal(kyuko.totalLimit,5);
  const home=items.find(i=>i.type==='homeTheme');
  assert.equal(home.themeId,'halloween_2026');assert.equal(home.price,300);
  assert.equal(home.totalLimit,1);assert.ok(existsSync(home.image));
  addMaterials({[event.currency.id]:50});assert.equal(state.materials[event.currency.id],50);
  addCharacter('hw_kyuko');assert.equal(resolveOwned('hw_kyuko').rarity,4);
  assert.ok(eventMaterials().some(m=>m.id===event.currency.id));
  for(let i=0;i<5;i++)recordShopPurchase(kyuko);
  assert.equal(shopRemaining(kyuko),0);
});
