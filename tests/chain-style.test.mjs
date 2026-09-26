import test from 'node:test';
import assert from 'node:assert/strict';
import {chainLabelFill, chainBanner} from '../src/js/battle/chain-style.js';

test('chains 1–6 retain their existing colors and banner style', () => {
  const ctx = {createLinearGradient(){throw Error('No gradient before seven');}};
  for (let n=1;n<=6;n++) {
    assert.equal(chainLabelFill(ctx,n,100,80),n>=5?'#FFC65C':n>=3?'#8FD8FF':'#FFFFFF');
    assert.equal(chainBanner(n),`<span class="chain">${n} COMBO</span>`);
  }
});
test('seven and higher use a full-width seven-color rainbow', () => {
  for (const n of [7,8,10,20]) {
    const stops=[];const gradient={addColorStop:(...args)=>stops.push(args)};
    const ctx={createLinearGradient(...args){assert.deepEqual(args,[60,0,140,0]);return gradient;}};
    assert.equal(chainLabelFill(ctx,n,100,80),gradient);
    assert.equal(stops.length,7);assert.equal(stops[0][0],0);assert.equal(stops.at(-1)[0],1);
    assert.match(chainBanner(n),/class="chain chain-rainbow"/);
  }
});
