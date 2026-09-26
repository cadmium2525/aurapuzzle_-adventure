const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
  try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep))throw Error('outside root');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/tests/event-preview.html`);
    await page.locator('[data-gacha]').click();
    assert.equal(await page.locator('[data-campaign="halloween_2026"]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-pickup]').count(),4);
    assert.equal(await page.locator('.g-frepo').isVisible(),false);
    assert.ok((await page.locator('#pickupBox').innerText()).includes('1.5%'));
    await page.locator('[data-pickup="hw_kai"]').click();
    assert.ok((await page.locator('#gachaDetail').innerText()).includes('イベント特効'));
    await page.locator('#gachaDetail [data-back-close]').click();
    await page.locator('#gachaRates summary').click();
    assert.ok((await page.locator('#gachaRates').innerText()).includes('2.75%'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'aura-halloween-gacha.png'),fullPage:true});
    await page.locator('[data-campaign="normal"]').click();
    assert.equal(await page.locator('[data-pickup]').count(),1);
    assert.equal(await page.locator('[data-pickup="lm_emiri"]').count(),1);
    assert.equal(await page.locator('.g-frepo').isVisible(),true);
    assert.ok(!(await page.locator('#gachaRates').innerText()).includes('宵宴の吸血剣士'));
    await page.locator('[data-campaign="halloween_2026"]').click();
    await page.evaluate(()=>{Math.random=()=>.945;});
    await page.locator('#orbGacha1Btn').click();
    await page.locator('#gachaStage').click();
    await page.waitForFunction(()=>document.getElementById('pullBody').textContent.includes('宵宴の吸血剣士'));
    const result=await page.evaluate(async()=>{const {state}=await import('/src/js/core/state.js');return {orb:state.orb,copies:state.characters.hw_kai?.n};});
    assert.deepEqual(result,{orb:495,copies:1});
    await page.waitForTimeout(400);await page.locator('#pullCloseBtn').click();
    // 画面を開いたまま開催終了しても、別のガチャを引かず通貨も消費しない。
    await page.evaluate(()=>{Date.now=()=>Date.parse('2026-11-01T00:00:00+09:00');});
    await page.locator('#orbGacha1Btn').click();
    assert.equal(await page.locator('[data-campaign="halloween_2026"]').count(),0);
    assert.equal(await page.evaluate(async()=>(await import('/src/js/core/state.js')).state.orb),495);
    await page.goto(`http://127.0.0.1:${server.address().port}/admin/index.html`);
    await page.locator('[data-go="events"]').click();
    await page.locator('[data-edit="halloween_2026"]').click();
    assert.equal(await page.locator('[name=gachaRate]').inputValue(),'50');
    assert.equal(await page.locator('[name=gachaPickups]').inputValue(),'hw_kai, hw_mio, hw_noa, hw_rune');
    await page.locator('#saveEvent').click();
    const config=await page.evaluate(()=>JSON.parse(localStorage.getItem('acb_admin_draft')).settings.events.find(e=>e.id==='halloween_2026').gacha);
    assert.equal(config.pickupRate,.5);assert.equal(config.pickupIds.length,4);assert.equal(config.enabled,true);
    await page.locator('[data-go="gacha"]').click();
    assert.equal(await page.locator('[name=pickupId] option[value="hw_kai"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: tabs, four PU details/rates, real draw, expiry guard and admin settings round-trip');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
