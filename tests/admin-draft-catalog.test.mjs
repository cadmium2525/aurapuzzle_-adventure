import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCatalog} from '../admin/js/draft-catalog.js';
test('new draft characters are selectable and edited masters appear only once',()=>{
  assert.deepEqual(mergeCatalog([{id:'a',name:'old'}],[{id:'a',name:'edited'},{id:'b',name:'new'}]),[{id:'a',name:'edited'},{id:'b',name:'new'}]);
});
