import test from 'node:test';
import assert from 'node:assert/strict';
import { withinWindow,isAvailable } from '../src/js/data/availability.js';
import { readPublication,validPublication } from '../admin/js/publication.js';
import { buildCustomJs } from '../admin/js/custom-source.js';
const event={id:'test',enabled:true,availableFrom:'2026-10-01T00:00:00+09:00',availableUntil:'2026-11-01T00:00:00+09:00'};
test('JST event boundaries are inclusive start/exclusive end',()=>{
  const start=Date.parse(event.availableFrom),end=Date.parse(event.availableUntil);
  assert.equal(withinWindow(event,start-1),false);
  assert.equal(withinWindow(event,start),true);
  assert.equal(withinWindow(event,end-1),true);
  assert.equal(withinWindow(event,end),false);
});
test('event toggle and individual publication both apply; missing parent fails closed',()=>{
  const now=Date.parse(event.availableFrom);
  assert.equal(isAvailable({eventId:'test'},now,[event]),true);
  assert.equal(isAvailable({eventId:'test',enabled:false},now,[event]),false);
  assert.equal(isAvailable({eventId:'test'},now,[{...event,enabled:false}]),false);
  assert.equal(isAvailable({eventId:'missing'},now,[event]),false);
  assert.equal(isAvailable({},now,[]),true);
  assert.equal(withinWindow({...event,availableUntil:'invalid'},now),false);
});
test('admin serializes explicit JST dates and validates ordering',()=>{
  const p=readPublication({availableFrom:'2026-10-01T00:00',availableUntil:'2026-11-01T00:00'});
  assert.equal(p.availableFrom,event.availableFrom);
  assert.equal(validPublication(p),true);
  assert.equal(validPublication({...p,availableUntil:p.availableFrom}),false);
});
test('release preserves event settings when publishing unrelated drafts',()=>{
  const src=buildCustomJs({characters:[]},{settings:{events:[event],pickupRate:.3}});
  assert.ok(src.includes(JSON.stringify(event.availableUntil)));
  assert.ok(src.includes('"pickupRate": 0.3'));
});
