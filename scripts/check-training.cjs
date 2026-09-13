const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/');
 await page.locator('#titleScreen.ready').click({timeout:20000});
 await page.evaluate(async()=>{(await import('./src/js/core/nav.js')).showScreen('dungeon');});
 assert.deepEqual(await page.locator('#dungeonMenu b').allTextContents(),['ノーマルダンジョン','曜日ダンジョン','トレーニング']);
 await page.locator('#openTrainingBtn').click();
 const snapshot=async()=>page.evaluate(async()=>{
   const {staminaAt,...data}=(await import('./src/js/core/state.js')).state;
   return JSON.stringify(data); // Natural stamina-clock ticks are unrelated to training.
 });
 const baseline=await snapshot();
 await page.locator('[data-action="lessons"]').click();
 for(let lesson=0;lesson<6;lesson++) {
  await page.locator(`[data-action="lesson"][data-index="${lesson}"]`).click();
  if(lesson===2) await page.screenshot({path:'.codex-training.png',fullPage:true});
  await page.locator('[data-action="practice"]').click();
  await page.locator(`[data-action="color"][data-color="${Math.min(lesson,[2,2,3,3,4,5][lesson]-1)}"]`).click();
  await page.locator('.training-cell.target').click();
  for(let step=0;step<15 && await page.locator('[data-action="step"]').count();step++)await page.locator('[data-action="step"]').click();
  assert.match(await page.locator('.training-status').innerText(),/成功/);
  await page.locator('#screen-training [data-action="back"]').click();
 }
 assert.equal(await page.locator('[data-action="lesson"]').filter({hasText:'習得'}).count(),6);
 await page.locator('#screen-training [data-action="back"]').click();
 await page.locator('[data-action="free"]').click();
 await page.locator('[data-cell="7,0"]').click();
 await page.locator('[data-cell="7,1"]').click();
 assert.equal(await page.locator('[data-action="undo"]').isEnabled(),true);
 await page.locator('[data-action="undo"]').click();
 assert.equal(await page.locator('[data-cell="7,1"]').innerText(),'');
 await page.locator('[data-action="move"]').click();
 await page.locator('#trainingTime').selectOption('10');
 await page.locator('[data-cell="7,0"]').scrollIntoViewIfNeeded();
 const start=await page.locator('[data-cell="7,0"]').boundingBox();
 const end=await page.locator('[data-cell="7,1"]').boundingBox();
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
 await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:5});await page.mouse.up();
 assert.equal(await page.locator('[data-cell="7,1"]').innerText(),'火');
 await page.waitForTimeout(300);
 assert.match(await page.locator('#trainingClock').innerText(),/残り/);
 await page.waitForTimeout(10100);
 assert.match(await page.locator('.training-status').innerText(),/0連鎖/);
 assert.equal(await snapshot(),baseline);
 assert.deepEqual(errors,[]);
 console.log('PASS: category order, six lessons, completion, free edit/undo/drag, released timer, no game-state mutation');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
