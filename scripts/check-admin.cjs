/* 管理ツール: 7画面が開き、モンスター/降臨/キャラの編集が下書きに入ること。
   node scripts/check-admin.cjs                                      */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http=require('node:http'), fs=require('node:fs/promises'), path=require('node:path');
const root='/home/user/aurapuzzle_-adventure';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname);
 try{const f=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p)); res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream'); res.end(await fs.readFile(f));}
 catch{res.writeHead(404);res.end('404');}});
const SHOT = process.env.ACB_SHOT_DIR ? process.env.ACB_SHOT_DIR + '/' : null;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const b=await chromium.launch({channel:'chrome',headless:true});
 const page=await b.newPage({viewport:{width:390,height:900},serviceWorkers:'block'});
 const errors=[]; page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
 page.on('console',m=>{ if(m.type()==='error' && !/favicon|ERR_TUNNEL|net::/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
 await page.goto(`http://127.0.0.1:${server.address().port}/admin/index.html`);
 await page.waitForTimeout(700);

 // --- モンスターを開いて中身が入っているか ---
 await page.locator('[data-go="enemies"]').click(); await page.waitForTimeout(300);
 await page.locator('.icon-cell').nth(1).click(); await page.waitForTimeout(400);  // ワーム
 const v = sel => page.locator(sel).inputValue();
 assert.equal(await v('[name=name]'), 'ワーム', '既存モンスターの名前が引けていない');
 assert.equal(await v('[name=hp]'), '4800', '既存モンスターの基礎HPが引けていない');
 console.log('ワーム編集: id=%s name=%s hp=%s atk=%s',
   await v('[name=id]'), await v('[name=name]'), await v('[name=hp]'), await v('[name=atk]'));
 console.log('  先制の数:', await page.locator('#preEffects [data-effect]').count(),
   '/ 型:', await page.locator('#preEffects [data-type]').first().inputValue());
 if (SHOT) await page.screenshot({path:SHOT+'admin-enemy-edit.png'});

 // 変身ボスを開く
 await page.locator('#cancelBtn').click(); await page.waitForTimeout(300);
 await page.locator('.icon-cell').last().click(); await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-form]').count(), 2, '変身の姿が2つ出ていない');
 console.log('キュウコ: 変身タブ=%d / 変身前hp=%s', await page.locator('[data-form]').count(), await v('[name=hp]'));
 await page.locator('[data-form="1"]').click(); await page.waitForTimeout(350);
 console.log('  変身後: name=%s hp=%s intro=%s',
   await v('[name=formName]'), await v('[name=hp]'), await v('[name=intro]'));
 if (SHOT) await page.screenshot({path:SHOT+'admin-boss-edit.png'});

 // --- 新規モンスターを作って保存 ---
 await page.locator('#cancelBtn').click(); await page.waitForTimeout(250);
 await page.locator('#newEnemy').click(); await page.waitForTimeout(300);
 await page.fill('[name=id]','testgolem'); await page.fill('[name=name]','テストゴーレム');
 await page.fill('[name=hp]','5000'); await page.fill('[name=atk]','120');
 await page.locator('#addPre').click(); await page.waitForTimeout(250);
 await page.locator('#saveBtn').click(); await page.waitForTimeout(400);
 console.log('保存後のモンスター数:', await page.locator('.icon-cell').count());
 console.log('バッジ:', await page.locator('#draftBadge').textContent());

 // --- 降臨を新規作成 ---
 await page.locator('[data-go="raids"]').click(); await page.waitForTimeout(300);
 await page.locator('#newRaid').click(); await page.waitForTimeout(400);
 await page.fill('[name=name]','テスト降臨');
 await page.locator('#addFloor').click(); await page.waitForTimeout(350);
 // 1フロア目の倍率を変える
 await page.locator('[data-slot-hp]').first().fill('2.5'); await page.waitForTimeout(400);
 const tail = await page.locator('.slot .tail').first().textContent();
 // モノリスの基礎HP 4200 × 2.5 = 10,500 が出るはず
 assert.ok(tail.includes('10,500'), '倍率が反映されていない: ' + tail);
 console.log('倍率2.5倍のあとの表示:', tail.trim());
 if (SHOT) await page.screenshot({path:SHOT+'admin-raid-edit.png'});
 await page.locator('#saveBtn').click(); await page.waitForTimeout(400);
 console.log('降臨の数:', await page.locator('.row[data-open]').count());

 // --- キャラ新規 ---
 await page.locator('[data-go="characters"]').click(); await page.waitForTimeout(300);
 await page.locator('#newChar').click(); await page.waitForTimeout(400);
 const before = await v('[name=atk]');
 await page.locator('#rollBtn').click(); await page.waitForTimeout(300);
 const after = await v('[name=atk]');
 console.log('ステータス引き直し: %s → %s', before, after);
 await page.selectOption('[name=role]','tank'); await page.waitForTimeout(350);
 const tankAtk = Number(await v('[name=atk]')), tankHp = Number(await v('[name=hp]'));
 assert.ok(tankHp > tankAtk * 2, 'タンクなのにHPが伸びていない');
 console.log('タンクにした: atk=%s hp=%s', tankAtk, tankHp);
 await page.fill('[name=id]','fl_testnova'); await page.fill('[name=name]','ノヴァ');
 await page.fill('[name=artName]','testnova');
 await page.locator('#evolveBox').check(); await page.waitForTimeout(350);
 console.log('進化欄:', await page.locator('[name=evoName]').count() ? 'あり' : 'なし');
 if (SHOT) await page.screenshot({path:SHOT+'admin-char-edit.png'});
 await page.locator('#saveBtn').click(); await page.waitForTimeout(400);

 // --- ガチャ: PU の差し替えとアトラスの焼き直し ---
 await page.locator('[data-go="gacha"]').click(); await page.waitForTimeout(400);
 await page.selectOption('[name=pickupId]','aq_nereid');
 await page.fill('[name=pickupRate]','0.5');
 await page.locator('#savePickup').click(); await page.waitForTimeout(450);
 const pu = await page.evaluate(()=>{
   const d=JSON.parse(localStorage.getItem('acb_admin_draft')||'{}'); return d.settings||{};
 });
 assert.equal(pu.pickupId,'aq_nereid','ピックアップが保存されていない');
 assert.equal(pu.pickupRate,0.5,'ピックアップ率が保存されていない');
 console.log('ピックアップ:', JSON.stringify(pu));
 page.on('dialog',d=>d.accept());
 await page.locator('#bakeBtn').click(); await page.waitForTimeout(350);
 await page.locator('[data-ok]').click();
 await page.waitForFunction(()=>{
   const o=document.getElementById('atlasOut'); return o && /焼けました|できません/.test(o.textContent);
 },{timeout:90000});
 const atlasMsg = (await page.locator('#atlasOut').textContent()).replace(/\s+/g,' ').trim();
 assert.ok(atlasMsg.includes('焼けました'), 'アトラスが焼けなかった: '+atlasMsg);
 console.log('アトラス:', atlasMsg);

 // --- 点検 ---
 await page.locator('[data-go="tools"]').click(); await page.waitForTimeout(500);
 const rows = await page.locator('#view .card').first().locator('.row').allTextContents();
 console.log('--- 整合性チェックの結果 ---');
 rows.slice(0,8).forEach(r=>console.log('  '+r.replace(/\s+/g,' ').trim()));
 if (SHOT) await page.screenshot({path:SHOT+'admin-tools.png'});

 // --- リリース ---
 await page.locator('[data-go="release"]').click(); await page.waitForTimeout(400);
 console.log('--- リリース画面 ---');
 console.log((await page.locator('#view .card').first().textContent()).replace(/\s+/g,' ').trim().slice(0,200));
 if (SHOT) await page.screenshot({path:SHOT+'admin-release.png'});

 // 画像未アップロードの 404 は想定内(絵文字にフォールバックする)
 const real = errors.filter(e => !/404/.test(e));
 assert.deepEqual(real, [], '想定外のエラーが出た');
 console.log('PASS: 8画面が開き、モンスター/変身ボス/降臨の倍率/キャラ生成/PU差し替え/アトラス焼き直し/点検/リリースが動く');
 await b.close(); server.close();
})();
