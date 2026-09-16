/* =========================================================
 * recovery.js — 起動に失敗したときの逃げ道
 *
 * index.html にも同じ役目の見張り番を直接書いてあるが、そちらは
 * 「新しいHTML」にしか入っていない。古いHTMLのまま新しいJSが
 * 動いてしまった場合こそ助けが要るので、JS側だけで完結させる。
 *
 * どちらの経路でも、消すのはキャッシュとサービスワーカーだけ。
 * 冒険の記録(localStorage)には触らない。
 * =======================================================*/

/**
 * キャッシュとサービスワーカーを捨てて読み込み直す。
 * URLに印を付けるのは、端末側のキャッシュから同じものが返るのを避けるため。
 */
export function resetApp() {
  const jobs = [];
  try {
    jobs.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  } catch (e) { /* 使えない環境ではそのまま進む */ }
  try {
    jobs.push(navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister()))));
  } catch (e) { /* 同上 */ }
  Promise.all(jobs).catch(() => {}).then(() => {
    location.replace(location.pathname + '?v=' + Date.now());
  });
}

/**
 * 起動できなかったことを画面に出す。
 * 0%のまま固まると利用者には何も分からないので、必ず何か見せる。
 * 新しいHTMLなら用意済みの #bootError を使い、古いHTMLなら自分で作る。
 */
export function showBootError(detail) {
  const existing = document.getElementById('bootError');
  if (existing) {
    const box = document.getElementById('bootErrorDetail');
    if (box) box.textContent = String(detail || '').slice(0, 300);
    // HTML側のボタンは onclick で index.html の関数を呼ぶが、そちらが
    // 用意されていない版のHTMLでも押せるように、こちらからも繋いでおく
    const button = existing.querySelector('button');
    if (button) button.addEventListener('click', resetApp);
    existing.hidden = false;
    return;
  }
  const el = document.createElement('div');
  el.id = 'bootError';           // 新しいHTMLの箱と同じ名前にしておく
  el.className = 'boot-error';
  // 古いHTMLだと .boot-error のスタイルも無いので、最低限を直接書く
  el.setAttribute('style', 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
    + 'justify-content:center;padding:24px;background:#0B0718;color:#F3EEFF;text-align:center;'
    + 'font-family:"Hiragino Maru Gothic ProN","Yu Gothic Medium",system-ui,sans-serif;');
  el.innerHTML = `<div style="max-width:400px">
    <h2 style="font-size:19px;margin:0 0 12px">起動できませんでした</h2>
    <p style="font-size:13px;line-height:1.8;color:#A99CD0;margin:0 0 20px">
      データの読み込みに失敗しました。下のボタンで読み込み直してください。<br>
      <b style="color:#F3EEFF">冒険の記録(セーブデータ)は消えません。</b></p>
    <button type="button" id="bootErrorReset" style="width:100%;padding:14px;border:0;border-radius:14px;
      font:700 15px inherit;color:#231603;background:linear-gradient(180deg,#FFE9A8,#F2A93B)">読み込み直す</button>
    <code id="bootErrorDetail" style="display:block;margin-top:16px;font-size:10px;color:#6F659A;word-break:break-all">${
      String(detail || '').slice(0, 300).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</code>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('#bootErrorReset').addEventListener('click', resetApp);
}
