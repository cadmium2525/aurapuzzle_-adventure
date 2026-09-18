/* =========================================================
 * gacha.js — ガチャのピックアップと、アトラスの焼き直し
 * =======================================================*/
import { $, esc, card, toast, field, readForm, confirmAsk } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, settings, setSetting, putBlob, getBlob, blobEntries } from '../draft.js';
import { toBannerWebp, previewUrl, humanSize, canEncodeWebp } from '../image.js';
import { atlasSources, buildAtlas, buildAtlasIndexJs, COLUMNS, CELL } from '../atlas.js';

const ATLAS_IMAGE = 'assets/chars/char_atlas.webp';
const ATLAS_INDEX = 'src/js/data/char-atlas.js';
const BANNER_PATH = 'assets/promo/gacha_banner.webp';

/** 下書きも含めた全キャラ(新しく足したキャラもPUにできる) */
function allCharacters() {
  const map = new Map();
  G.CHARACTERS.forEach(c => map.set(c.id, c));
  draft().characters.forEach(c => map.set(c.id, c));
  return Array.from(map.values());
}

/** 下書きで足したキャラのアイコン。アトラスに混ぜる対象 */
function draftIconPaths() {
  const out = [];
  draft().characters.forEach(c => (c.artStages || []).forEach(s => {
    if (s.icon) out.push(s.icon);
  }));
  return out;
}

export default {
  render(view) {
    const s = settings();
    const chars = allCharacters().filter(c => c.rarity >= G.MAX_GACHA_RARITY);
    const current = s.pickupOff
      ? null
      : (s.pickupId ? allCharacters().find(c => c.id === s.pickupId) : G.PICKUP_CHARACTER);
    const rate = s.pickupRate == null ? G.PICKUP_RATE : s.pickupRate;
    const bannerPath = s.gachaBanner || BANNER_PATH;
    const held = getBlob(bannerPath);

    // ★4帯の内訳。PUを1体抜いた残りを均等に割る
    const pool = G.GACHA_POOL.filter(c => c.rarity === G.MAX_GACHA_RARITY);
    const band = (G.ORB_WEIGHTS || {})[G.MAX_GACHA_RARITY] || 0;
    const total = Object.values(G.ORB_WEIGHTS || {}).reduce((a, b) => a + b, 0) || 1;
    const share = band / total;
    const others = Math.max(1, pool.length - 1);
    const eachOther = (share * (1 - rate)) / others;

    view.innerHTML = `
      ${card('ピックアップ', `
        <p class="lead">★${G.MAX_GACHA_RARITY} の枠のうち、決めた割合をこの1体に寄せます。
        残りは同じレアリティで均等に割ります。「ピックアップなし」を選ぶと、
        ガチャ画面のPU枠と「開催中」の表示も消えます。</p>
        ${field('ピックアップするキャラ', 'pickupId', current ? current.id : '', {
          type: 'select',
          options: [['', '（ピックアップなし）']].concat(chars.map(c =>
            [c.id, `${c.name} ★${c.rarity} ${G.AURA_NAME[c.aura]}`]))
        })}
        ${field('ピックアップの割合', 'pickupRate', rate, {
          type: 'number', min: 0, max: 1, step: 0.05, hint: '0〜1。0.3 なら★4帯の30%' })}
        <div class="scroll-x"><table class="data">
          <tr><th>枠</th><th class="num">確率</th></tr>
          <tr><td>★${G.MAX_GACHA_RARITY} 帯ぜんぶ</td><td class="num">${(share * 100).toFixed(1)}%</td></tr>
          <tr><td>${current ? esc(current.name) : 'ピックアップなし'}</td>
            <td class="num ${current ? 'ok' : ''}">${current ? (share * rate * 100).toFixed(2) : '—'}</td></tr>
          <tr><td>★${G.MAX_GACHA_RARITY} 1体あたり(${current ? `ほか${others}体` : `${pool.length}体`})</td>
            <td class="num">${((current ? eachOther : share / Math.max(1, pool.length)) * 100).toFixed(2)}%</td></tr>
        </table></div>
        <div class="row-btns">
          <button class="btn primary" id="savePickup">下書きに保存</button>
          <button class="btn" id="clearPickup">既定に戻す</button>
        </div>`)}

      ${card('ガチャのバナー', `
        <p class="lead">ホームに出す宣伝バナーです。降臨のバナーと数秒ごとに入れ替わります。
        設定しなければガチャのバナーは出ません。</p>
        <label class="drop">バナー画像を選ぶ(1080×608 に整えます)
          <input type="file" accept="image/*" id="bannerFile"></label>
        <div class="shots">${held
          ? `<div class="shot wide" style="width:100%"><img src="${previewUrl(held)}" alt="">
             <span class="cap">${esc(bannerPath)} / ${humanSize(held.size)}</span></div>`
          : `<p class="empty">${s.gachaBanner ? `${esc(s.gachaBanner)} を使う設定です(画像は未アップロード)` : 'まだ選んでいません'}</p>`}</div>
        ${s.gachaBanner ? '<button class="btn danger" id="clearBanner">バナーを外す</button>' : ''}`)}

      ${card('アイコンのアトラス', `
        <p class="lead">一覧でアイコンを数十枚並べるので、1枚の格子絵に焼いて
        リクエストを1回にまとめています。</p>
        <div class="note">焼き直しは<b>必須ではありません</b>。アトラスに無いアイコンは
        自動で個別の画像として表示されます。軽くしたいときだけ流してください。</div>
        <dl class="kv">
          <dt>いまの枚数</dt><dd>${Object.keys(G.CHAR_ATLAS || {}).length} 枚</dd>
          <dt>下書きで増える</dt><dd>${draftIconPaths().length} 枚</dd>
          <dt>格子</dt><dd>${COLUMNS} 列 × ${CELL}px</dd>
        </dl>
        <div class="bar" id="atlasBar" hidden><i></i></div>
        <p class="small mono" id="atlasOut"></p>
        <div id="atlasPreview"></div>
        <button class="btn wide" id="bakeBtn">アトラスを焼き直す</button>`)}
    `;

    /* --- ピックアップ --- */
    $('savePickup').addEventListener('click', () => {
      const v = readForm(view.querySelector('.card'));
      const r = Number(v.pickupRate);
      if (!(r >= 0 && r <= 1)) { toast('割合は 0〜1 で入れてください', 'ng'); return; }
      // 空文字では「未設定」と区別が付かず既定のキャラへ戻ってしまうので、
      // 「開催しない」は専用の pickupOff で表す
      if (v.pickupId) {
        setSetting('pickupId', v.pickupId);
        setSetting('pickupOff', null);
      } else {
        setSetting('pickupId', null);
        setSetting('pickupOff', true);
      }
      setSetting('pickupRate', r);
      toast('下書きに保存しました', 'ok');
      this.render(view);
    });
    $('clearPickup').addEventListener('click', () => {
      setSetting('pickupId', null);
      setSetting('pickupOff', null);
      setSetting('pickupRate', null);
      toast('既定に戻しました');
      this.render(view);
    });

    /* --- バナー --- */
    $('bannerFile').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!canEncodeWebp()) { toast('この端末は webp を書き出せません', 'ng'); return; }
      try {
        const blob = await toBannerWebp(file);
        putBlob(BANNER_PATH, blob);
        setSetting('gachaBanner', BANNER_PATH);
        toast(`webp にしました (${humanSize(blob.size)})`, 'ok');
        this.render(view);
      } catch (err) { toast(String(err.message || err), 'ng'); }
    });
    const clearBanner = $('clearBanner');
    if (clearBanner) clearBanner.addEventListener('click', () => {
      setSetting('gachaBanner', null);
      toast('バナーを外しました');
      this.render(view);
    });

    /* --- アトラス --- */
    $('bakeBtn').addEventListener('click', async () => {
      const btn = $('bakeBtn');
      const bar = $('atlasBar');
      const out = $('atlasOut');
      const paths = atlasSources(draftIconPaths());
      if (!await confirmAsk('アトラスを焼き直す',
        `${paths.length} 枚を1枚の格子絵にまとめ、索引も作り直します。`, '焼く')) return;

      btn.disabled = true;
      bar.hidden = false;
      out.className = 'small mono';
      try {
        const result = await buildAtlas(paths, getBlob, (done, all) => {
          bar.querySelector('i').style.width = `${Math.round((done / all) * 100)}%`;
          out.textContent = `${done} / ${all} 枚`;
        });
        putBlob(ATLAS_IMAGE, result.blob);
        putBlob(ATLAS_INDEX, new Blob([buildAtlasIndexJs(result)], { type: 'text/javascript' }));
        out.innerHTML = `焼けました: ${result.columns}列 × ${result.rows}行 /
          ${humanSize(result.blob.size)}`
          + (result.missing.length
            ? `<br><span class="ng">読めなかった ${result.missing.length} 枚は空けました:
               ${esc(result.missing.slice(0, 3).join(', '))}${result.missing.length > 3 ? ' ほか' : ''}</span>`
            : '');
        $('atlasPreview').innerHTML = `<div class="shot" style="width:100%">
          <img src="${previewUrl(result.blob)}" alt="" style="width:100%;height:auto;border-radius:10px">
          <span class="cap">${esc(ATLAS_IMAGE)}</span></div>`;
        toast('アトラスを焼きました', 'ok');
      } catch (e) {
        out.textContent = String(e.message || e);
        out.className = 'small mono ng';
        toast(String(e.message || e), 'ng');
      } finally {
        btn.disabled = false;
      }
    });
  }
};
