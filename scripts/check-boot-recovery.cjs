/* 古いHTMLと新しいJSが混ざったとき(サービスワーカーの版ずれ)に、
   自力で読み直して直るか、直らないときに画面へ出るかを見る。
   ここが壊れると利用者にはローディング0%のまま固まって見える。
   node scripts/check-boot-recovery.cjs                            */
// 版ずれから自力で立ち直れるか、立ち直れないときに画面へ出るかを見る。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const NEW = path.resolve(__dirname, '..');
// 「古いHTML」は index.html から版の印を抜いたもので作る。
// 実機では、サービスワーカーがHTMLだけ古いものを返したときにこの形になる。
const OLD = path.join(require('node:os').tmpdir(), 'acb-oldhtml');
const types = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg' };
let htmlRoot = OLD;          // HTML だけ古いものを返す状態から始める
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url,'http://l').pathname);
  const root = (p === '/' || p.endsWith('.html')) ? htmlRoot : NEW;
  try {
    const file = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
(async () => {
  await fs.mkdir(OLD, { recursive: true });
  const html = await fs.readFile(path.join(NEW, 'index.html'), 'utf8');
  await fs.writeFile(path.join(OLD, 'index.html'),
    html.replace(/<meta name="app-version"[^>]*>/, '').replace(/<script>[\s\S]*?<\/script>/, ''));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;

    /* --- 1. 版ずれ → 読み直して自力で直る --- */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const reloads = [];
    page.on('framenavigated', f => { if (f === page.mainFrame() && f.url() !== 'about:blank') reloads.push(f.url()); });
    // 1回目の読み直しの直後に、正しいHTMLが配られる状態にする
    page.on('framenavigated', () => { htmlRoot = NEW; });
    await page.goto(url);
    await page.waitForTimeout(6000);
    const healed = await page.locator('#titleScreen.ready').count();
    console.log('版ずれからの復帰:', healed ? 'タイトルまで到達' : '失敗',
      '/ 読み直し回数:', reloads.length - 1);
    assert.equal(healed, 1, '版ずれから自力で戻れていない');

    /* --- 2. 直らない版ずれ → 0%で固まらず画面に出る --- */
    htmlRoot = OLD;
    const page2 = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await page2.goto(url);
    await page2.waitForTimeout(7000);
    const shown = await page2.locator('#bootError:not([hidden])').count();
    console.log('直らない版ずれ:', shown ? 'エラー画面が出た' : '0%のまま固まった');
    console.log('  内容:', (await page2.locator('#bootErrorDetail').textContent()).slice(0, 90));
    assert.equal(shown, 1, '固まったまま何も出ていない');
    // 「読み込み直す」でセーブが消えないこと
    // 起動しきるとログインボーナス等が加わるので、冒険の中身だけを見比べる
    const core = () => page2.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('acb_state') || 'null');
      return s && { characters: s.characters, teams: s.teams, rank: s.rank,
        coin: s.coin, id: s.settings.playerId, progress: s.progress };
    });
    const before = await core();
    assert.ok(before, '前提: セーブがある');
    htmlRoot = NEW;
    await page2.locator('#bootError button').first().click();
    await page2.waitForTimeout(6000);
    console.log('ボタンで復帰:', await page2.locator('#titleScreen.ready').count() ? 'タイトルまで到達' : '失敗');
    assert.deepEqual(await core(), before, 'セーブが消えた');
    assert.equal(await page2.locator('#titleScreen.ready').count(), 1);

    /* --- 3. 版がそろっているときは何も起きない --- */
    const page3 = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    // ページ側で数える。framenavigated は1回の読み込みでも複数回鳴ることがある
    await page3.addInitScript(() => {
      sessionStorage.setItem('__loads', String(Number(sessionStorage.getItem('__loads') || 0) + 1));
    });
    const errs = [];
    page3.on('pageerror', e => errs.push(e.message));
    await page3.goto(url);
    await page3.waitForTimeout(4000);
    const loads = Number(await page3.evaluate(() => sessionStorage.getItem('__loads')));
    console.log('正常時: タイトル', await page3.locator('#titleScreen.ready').count(),
      '/ 読み込み', loads, '回 / エラー', errs.length ? errs : 'なし');
    assert.equal(loads, 1, '正常なのに読み直している');
    assert.equal(await page3.locator('#bootError:not([hidden])').count(), 0, '正常なのにエラー画面が出ている');
    assert.deepEqual(errs, []);
    console.log('PASS: 版ずれは自力で復帰、直らないときは画面に出てセーブも残る');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e.message || e); process.exit(1); });
