/* ガチャのピックアップ: 管理ツールの設定が、実際のガチャ画面と抽選に効くこと。
   node scripts/check-gacha-pu.cjs                                        */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http=require('node:http'), fs=require('node:fs/promises'), fsSync=require('node:fs'), path=require('node:path');
const root='/home/user/aurapuzzle_-adventure';
const CUSTOM = root + '/src/js/data/custom.js';
const base = fsSync.readFileSync(CUSTOM,'utf8');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname);
 try{const f=path.resolve(root,'.'+(p==='/'?'/index.html':p)); res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream'); res.end(await fs.readFile(f));}
 catch{res.writeHead(404);res.end();}});
const CASES = [
  ['既定(未設定)', '{}'],
  ['PU=ネレイド 率0.5', '{ "pickupId": "aq_nereid", "pickupRate": 0.5 }'],
  ['ピックアップなし', '{ "pickupOff": true }']
];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({channel:'chrome',headless:true});
 // 途中で落ちても custom.js を元に戻す(書き換えたまま残すと本体が壊れる)
 const restore = () => fsSync.writeFileSync(CUSTOM, base);
 process.on('exit', restore);
 process.on('uncaughtException', e => { restore(); console.error(e); process.exit(1); });
 for (const [label, settings] of CASES) {
   // CUSTOM_SETTINGS には実データが入っていることがあるので、
   // 中身を決め打ちせず宣言ごと差し替える
   const re = /export const CUSTOM_SETTINGS = [\s\S]*?;\n/;
   if (!re.test(base)) throw new Error('custom.js に CUSTOM_SETTINGS が見つからない');
   const next = base.replace(re, `export const CUSTOM_SETTINGS = ${settings};\n`);
   if (next === base) throw new Error('custom.js の差し替えが効いていない');
   fsSync.writeFileSync(CUSTOM, next);
   const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
   const errs=[]; page.on('pageerror',e=>errs.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.locator('#titleScreen.ready').click({timeout:30000});
   await page.evaluate(async()=>{(await import('./src/js/core/nav.js')).showScreen('gacha');});
   await page.waitForTimeout(500);
   const boxHidden = await page.locator('#pickupBox').evaluate(e=>e.hidden);
   const puText = boxHidden ? '(枠を隠した)' : (await page.locator('#pickupBox .pu-name').textContent());
   const note = (await page.locator('#orbGachaNote').textContent()).trim();
   const api = await page.evaluate(async()=>{
     const g=await import('./src/js/data/gamedata.js');
     return (g.PICKUP_CHARACTER? g.PICKUP_CHARACTER.name : 'null') + ' / 率 ' + g.PICKUP_RATE;
   });
   console.log(`${label.padEnd(18)} 画面=${puText.padEnd(12)} 文言=${note.padEnd(32)} API=${api}`);
   if (errs.length) console.log('   エラー:', errs.join(' / '));
   assert.deepEqual(errs, [], label + ' でエラーが出た');
   if (label === '既定(未設定)') {
     assert.ok(!boxHidden, '既定ではピックアップ枠が出るはず');
     assert.ok(note.includes('開催中'), '既定では「開催中」と出るはず');
     assert.ok(api.includes('0.3'), '既定の率は 0.3');
   }
   if (label === 'PU=ネレイド 率0.5') {
     assert.equal(puText, 'ネレイド', '画面のPU表示が設定に追随していない');
     assert.ok(api.startsWith('ネレイド'), '抽選側のPUが設定に追随していない');
     assert.ok(api.includes('0.5'), 'PU率が設定に追随していない');
   }
   if (label === 'ピックアップなし') {
     assert.ok(boxHidden, '開催しないのにPU枠が残っている');
     assert.ok(!note.includes('開催中'), '開催しないのに「開催中」と出ている');
     assert.ok(api.startsWith('null'), '開催しない設定なのにPUがいる');
   }
   await page.close();
 }
 fsSync.writeFileSync(CUSTOM, base);
 console.log('PASS: PUの差し替え・率・「開催しない」が、ガチャ画面と抽選の両方に効く');
 await b.close(); server.close();
})();
