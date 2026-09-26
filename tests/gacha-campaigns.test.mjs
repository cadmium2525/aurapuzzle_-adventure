import test from 'node:test';
import assert from 'node:assert/strict';
import {gachaCampaignsAt,gachaRates,drawGacha} from '../src/js/data/gacha-campaigns.js';
const start=Date.parse('2026-10-01T00:00:00+09:00');
const end=Date.parse('2026-11-01T00:00:00+09:00');
test('normal excludes event costumes; separate campaign exists only inside its publication window',()=>{
  for(const now of [start-1,end]) assert.deepEqual(gachaCampaignsAt(now).map(c=>c.id),['normal']);
  for(const now of [start,end-1]) {
    const [normal,event]=gachaCampaignsAt(now);
    assert.ok(normal.pool.every(c=>!c.eventId));
    assert.equal(event.id,'halloween_2026');
    assert.deepEqual(event.pickups.map(c=>c.id),['hw_kai','hw_mio','hw_noa','hw_rune']);
    assert.ok(event.pool.every(c=>!c.giftOnly && (!c.eventId || c.eventId===event.id)));
    assert.equal(drawGacha(event,'frepo'),null);
  }
});
test('displayed rates sum to one and exactly match draw intervals including guarantee frames',()=>{
  for(const campaign of gachaCampaignsAt(start)) for(const kind of ['orb','frepo']) for(const guaranteed of [false,true]) {
    const rows=gachaRates(campaign,kind,guaranteed);
    if(!rows.length) continue;
    assert.ok(Math.abs(rows.reduce((n,r)=>n+r.rate,0)-1)<1e-12);
    let cursor=0;
    for(const row of rows) {
      if(row.rate>0) assert.equal(drawGacha(campaign,kind,guaranteed,()=>cursor+row.rate/2).id,row.character.id);
      cursor+=row.rate;
      if(guaranteed) assert.ok(row.character.rarity>=(kind==='orb'?3:2));
    }
  }
});
test('Halloween four-way pickup is 1.5% each, without applying normal Emiri pickup',()=>{
  const [normal,event]=gachaCampaignsAt(start);
  const rates=gachaRates(event);
  for(const row of rates.filter(r=>r.pickup)) assert.ok(Math.abs(row.rate-.015)<1e-12);
  assert.ok(Math.abs(gachaRates(normal).find(r=>r.character.id==='lm_emiri').rate-.036)<1e-12);
  const ordinary=rates.filter(r=>r.character.rarity===4 && !r.pickup);
  assert.ok(ordinary.every(r=>Math.abs(r.rate-ordinary[0].rate)<1e-12));
  for(const row of gachaRates(event,'orb',true).filter(r=>r.pickup)) assert.equal(row.rate,.0275);
});
