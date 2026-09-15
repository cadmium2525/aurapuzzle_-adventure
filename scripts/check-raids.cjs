const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
    res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    // Only accelerate presentation waits; combat calculations and production files stay intact.
    await page.route('**/core/ui.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('setTimeout(res, ms)','setTimeout(res, Math.min(ms, 20))')});});
    await page.route('**/battle/raid-presentation.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('setTimeout(resolve,ms)','setTimeout(resolve,Math.min(ms, 100))')});});
    await page.route('**/battle/battle.js',async route=>{
      const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+`
      window.raidTest={snapshot:()=>structuredClone({run,bstate}),
        strike:async(value,chain=6)=>{bstate='resolving';const result=dealDamage([{aura:0,value}],chain);await checkBuildUps();retarget(run);updateHPUI(false,false);if(encounterCleared(run))await floorClear();else bstate='idle';return result;},
        target:i=>{run.targetIndex=i;updateHPUI(false,false);},
        fortify:()=>{run.maxHP=100000;run.playerHP=100000;},
        emptyTurn:async()=>{board=genBoard(run.matchMin);await resolveTurn();}
      };`});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#titleScreen.ready').click({timeout:30000});
    await page.evaluate(async()=>{(await import('/src/js/core/nav.js')).showScreen('dungeon');});
    assert.deepEqual(await page.locator('#dungeonMenu b').allTextContents(),['ノーマルダンジョン','降臨ダンジョン','曜日ダンジョン','トレーニング']);
    await page.locator('#openRaidDungeonBtn').click();
    await page.locator('.stage-card').filter({hasText:'九狐降臨'}).click();
    // 説明ページは挟まず、カードからそのままサポート選択へ進む
    assert.ok(await page.locator('#supportPickModal.show').isVisible());
    await page.locator('#supportSkipBtn').click();
    await page.waitForFunction(()=>raidTest.snapshot().bstate==='idle');
    let snap=await page.evaluate(()=>raidTest.snapshot());
    assert.equal(snap.run.enemies.length,3);assert.ok(snap.run.enemies.every(e=>e.effects.defenses[0].turns===5));
    assert.equal(await page.locator('#enemyRoster .foe').count(),3);
    await page.evaluate(()=>{
      raidTest.fortify();window.bossLines=[];
      new MutationObserver(()=>{const text=document.getElementById('bossDialogue').textContent;if(text)bossLines.push(text);}).observe(document.getElementById('bossDialogue'),{childList:true});
    });
    await page.screenshot({path:path.join(os.tmpdir(),'kyuko-raid-floor1.png')});
    const blocked=await page.evaluate(()=>raidTest.strike(100000,5));assert.equal(blocked.blocked,true);
    await page.locator('.foe-target').nth(1).click();
    await page.evaluate(()=>raidTest.strike(100000));
    snap=await page.evaluate(()=>raidTest.snapshot());assert.equal(snap.run.floorIndex,0);assert.equal(snap.run.enemies[1].hp,0);assert.equal(snap.run.enemies[0].hp,4200);
    await page.evaluate(()=>raidTest.emptyTurn());
    snap=await page.evaluate(()=>raidTest.snapshot());assert.ok(snap.run.enemies.filter(e=>e.hp>0).every(e=>e.effects.defenses[0].turns===4));
    const visited=new Set();
    for(let step=0;step<40;step++){
      snap=await page.evaluate(()=>raidTest.snapshot());if(!snap.run)break;
      const f=snap.run.floorIndex;
      if(!visited.has(f)){
        visited.add(f);
        if(f===1)assert.ok(snap.run.enemies.every(e=>e.effects.defenses[0].type==='auraAbsorb'));
        if(f===3)assert.ok(snap.run.enemyEffects.binds.some(n=>n===2));
        if(f===4)assert.equal(snap.run.enemyEffects.time.type,'timeFixed');
        if(f===8){assert.equal(snap.run.enemyEffects.time.seconds,3);await page.screenshot({path:path.join(os.tmpdir(),'kyuko-raid-floor9.png')});await page.evaluate(()=>raidTest.emptyTurn());}
        if(f===9){
          assert.equal(snap.run.enemies.length,3);assert.equal(snap.run.enemies[1].hp,13000);assert.equal(snap.run.enemies[2].hp,13000);
          await page.screenshot({path:path.join(os.tmpdir(),'kyuko-raid-floor10.png')});
          await page.evaluate(()=>raidTest.emptyTurn());
          await page.evaluate(()=>raidTest.target(0));
          await page.evaluate(()=>raidTest.strike(100000));
          const protectedSnap=await page.evaluate(()=>raidTest.snapshot());assert.equal(protectedSnap.run.enemies[0].hp,26000);assert.equal(protectedSnap.run.enemies[1].hp,0);
          continue;
        }
      }
      const before=snap.run.enemies;
      // Deterministic drop branch only in this isolated browser profile.
      await page.evaluate(async()=>{const original=Math.random;Math.random=()=>.25;try{await raidTest.strike(100000);}finally{Math.random=original;}});
      const after=await page.evaluate(()=>raidTest.snapshot());
      if(after.run?.floorIndex===9 && after.run.enemies.slice(1).every(e=>e.hp<=0)) assert.equal(after.run.enemies[0].effects.attackMult,2);
      if(after.run?.floorIndex===2){const golem=after.run.enemies.find(e=>e.spec.id==='gorem');if(golem.hp===1)assert.equal(golem.effects.attackMult,2);}
    }
    assert.equal(await page.locator('#resultTitle').innerText(),'STAGE CLEAR');
    assert.match(await page.locator('#resultRewards').innerText(),/キュウコ ★3 ×1/);
    assert.equal(visited.size,10);
    assert.ok(await page.evaluate(()=>bossLines.length)>=5);
    const growth=await page.evaluate(async()=>{
      const s=await import('/src/js/core/state.js');
      const entry=s.state.characters.dk_kyuko;
      const dropped=entry.n;
      entry.n=160;
      const results=[];
      for(let i=0;i<10;i++)results.push(s.awakenCharacter('dk_kyuko',false).ok);
      const token=s.awakenCheck('dk_kyuko',true).ok;
      entry.lv=30;s.state.coin=100000;
      const check=s.evolveCheck('dk_kyuko');
      s.state.materials[check.need.crystalId]=1000;s.state.materials.mt_star=1000;
      const evolved=s.evolveCharacter('dk_kyuko').ok;
      s.state.team=['dk_kyuko','aq_mio','lm_mina'];s.saveState();
      return {dropped,results,token,evolved,n:entry.n,awa:entry.awa,star:entry.star,own:s.ownCharacters().map(c=>c.id)};
    });
    assert.equal(growth.dropped,1);assert.ok(growth.results.every(Boolean));assert.equal(growth.n,1);assert.equal(growth.awa,10);assert.equal(growth.token,false);assert.equal(growth.evolved,true);assert.equal(growth.star,4);assert.equal(growth.own[0],'dk_kyuko');
    await page.reload();await page.locator('#titleScreen.ready').click({timeout:30000});
    assert.equal(await page.evaluate(async()=> (await import('/src/js/core/state.js')).state.characters.dk_kyuko.awa),10);
    assert.deepEqual(errors,[]);
    console.log('PASS: raid route, ten floors, individual targets/HP, preemptives, guard, clones/shield/build-up, drop, ten awaken levels, evolution, party and save reload');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
