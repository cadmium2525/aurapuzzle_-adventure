// Local fixture uses memory-only storage and no Firebase session.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep))throw Error('outside root');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/battle/battle.js',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text())+'\nwindow.boardEffectsTest=()=>structuredClone({run,bstate,board});'});
    });
    const url=`http://127.0.0.1:${server.address().port}/tests/event-preview.html`;
    await page.goto(url);
    await page.locator('[data-gacha]').waitFor();
    await page.evaluate(async()=>{
      const {STAGES}=await import('/src/js/data/gamedata.js');
      const {startDungeonRun}=await import('/src/js/battle/battle.js');
      const stage=structuredClone(STAGES[0]);
      const floor=stage.floors[0];floor.hp=100000;
      floor.enemySkills={preemptive:{effects:[
        {type:'boardShuffle'}, {type:'auraCorrupt',aura:4,count:5},
        {type:'auraJam',count:6,turns:3}, {type:'auraCurse',aura:0,percent:8,turns:3},
        {type:'auraWeaken',aura:1,percent:35,turns:3}
      ]}};
      stage.floors=[floor];startDungeonRun(stage,false,null);
    });
    await page.waitForFunction(()=>window.boardEffectsTest?.().bstate==='idle',{},{timeout:15000});
    const snap=await page.evaluate(()=>boardEffectsTest());
    assert.equal(snap.run.enemyEffects.jam.cells.length,6);
    assert.equal(snap.run.enemyEffects.curses[0].percent,8);
    assert.equal(snap.run.enemyEffects.weakens[1].percent,35);
    assert.equal(snap.board.flat().filter(x=>x===4).length,5);
    const rect=await page.locator('#board').boundingBox();
    for(const type of ['auraJam','auraCurse','auraWeaken'])
      assert.equal(await page.locator(`#playerEffects [data-effect="${type}"]`).count(),1);
    await page.locator('#playerEffects [data-effect="auraCurse"]').click();
    assert.deepEqual(await page.locator('#board').boundingBox(),rect);
    await page.screenshot({path:path.join(os.tmpdir(),'aura-board-effects.png')});
    const admin=await page.evaluate(async()=>{
      const {newEffect,effectRow,readEffects}=await import('/admin/js/views/effects.js');
      const {describeEffect}=await import('/admin/js/gamedata.js');
      const types=['auraJam','auraCurse','auraWeaken','boardShuffle','auraCorrupt'];
      const root=document.createElement('div');
      root.innerHTML=types.map((type,index)=>effectRow(newEffect(type),index)).join('');
      root.querySelector('[data-effect="1"] [data-arg="percent"]').value='11';
      const values=readEffects(root);
      return {values,descriptions:values.map(describeEffect),options:types.map(type=>root.querySelector(`[data-effect] [data-type] option[value="${type}"]`)!=null)};
    });
    assert.deepEqual(admin.values,[
      {type:'auraJam',count:6,turns:3}, {type:'auraCurse',aura:0,percent:11,turns:3},
      {type:'auraWeaken',aura:0,percent:35,turns:3}, {type:'boardShuffle'},
      {type:'auraCorrupt',aura:4,count:5}
    ]);
    assert.ok(admin.descriptions[1].includes('最大HPの11%'));
    assert.ok(admin.options.every(Boolean));
    assert.deepEqual(errors,[]);
    console.log('PASS: five board effects render and apply in battle; icons preserve board size; admin editor round-trips all types');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
