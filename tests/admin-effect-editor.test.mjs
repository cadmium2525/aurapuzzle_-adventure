import test from 'node:test';
import assert from 'node:assert/strict';
import {bindEffects} from '../admin/js/views/effects.js';

test('switching effect type keeps new defaults after collecting the previous form',()=>{
  let list=[{type:'comboGuard',chains:6,turns:10}];
  const handlers={};
  const root={addEventListener:(event,callback)=>{handlers[event]=callback;}};
  let renders=0;
  bindEffects(root,()=>list,value=>{list=value;},()=>{renders++;},()=>{
    list=[{type:'recoveryReduce',turns:10}];
  });
  const select={value:'recoveryReduce',closest:()=>({dataset:{effect:'0'}})};
  handlers.change({target:{closest:()=>select}});
  assert.deepEqual(list,[{type:'recoveryReduce',percent:50,turns:3}]);
  assert.equal(renders,1);
});

test('removing an effect collects edits before deletion, not after',()=>{
  let list=[{type:'comboGuard',chains:6}];
  const handlers={};
  const root={addEventListener:(event,callback)=>{handlers[event]=callback;}};
  bindEffects(root,()=>list,value=>{list=value;},()=>{},()=>{
    list=[{type:'comboGuard',chains:7}];
  });
  handlers.click({target:{closest:()=>({dataset:{dropEffect:'0'}})}});
  assert.deepEqual(list,[]);
});
