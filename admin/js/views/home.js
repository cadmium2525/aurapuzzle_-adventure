/* ホーム — 今の中身の要約と、下書きの状態 */
import { esc, card } from '../ui.js';
import { draft, pendingCount } from '../draft.js';
import * as G from '../gamedata.js';

function tile(label, value, note) {
  return `<button class="row flat"><div class="grow"><b>${esc(label)}</b>
    <span class="sub">${esc(note || '')}</span></div>
    <span class="tail">${esc(value)}</span></button>`;
}

export default {
  render(view) {
    const d = draft();
    const pending = pendingCount();

    const dailyCrystals = G.DAILY_THEMES.filter(t => t.dropType === 'crystal').length;

    view.innerHTML = `
      ${pending ? `<div class="note">下書きが <b>${pending}</b> 件あります。
        「リリース」タブでまとめて push できます。</div>` : ''}

      ${card('いまのゲームの中身', `<div class="rows">
        ${tile('キャラクター', G.CHARACTERS.length, `ガチャ母集団 ${G.GACHA_POOL.length}`)}
        ${tile('モンスター', G.ENEMIES.length, `マスター ${G.ENEMY_MASTER_IDS.length} 種`)}
        ${tile('降臨ダンジョン', G.RAID_STAGES.length, G.RAID_STAGES.map(r => r.name).join(' / '))}
        ${tile('通常ステージ', G.STAGES.length, '10章 × 5ステージ')}
        ${tile('テクニカル', G.TECHNICAL_STAGES.length, '10階層 × 5ステージ')}
        ${tile('曜日ダンジョン', `${dailyCrystals}種の結晶`, G.DAILY_THEMES.map(t => t.label).join(''))}
        ${tile('リーダースキル', Object.keys(G.LEADER_SKILLS).length, '')}
        ${tile('スキル', Object.keys(G.ACTIVE_SKILLS).length, '')}
      </div>`)}

      ${card('下書き', d.enemies.length + d.raids.length + d.characters.length === 0
        ? '<p class="empty">まだ何も編集していません。</p>'
        : `<div class="rows">
            ${d.enemies.map(e => `<button class="row flat"><div class="grow"><b>${esc(e.name || e.id)}</b>
              <span class="sub">モンスター</span></div><span class="tail">${esc(e.id)}</span></button>`).join('')}
            ${d.raids.map(r => `<button class="row flat"><div class="grow"><b>${esc(r.name || r.id)}</b>
              <span class="sub">降臨 ・ ${(r.floors || []).length}フロア</span></div>
              <span class="tail">${esc(r.id)}</span></button>`).join('')}
            ${d.characters.map(c => `<button class="row flat"><div class="grow"><b>${esc(c.name || c.id)}</b>
              <span class="sub">キャラクター ・ ★${esc(c.rarity)}</span></div>
              <span class="tail">${esc(c.id)}</span></button>`).join('')}
          </div>`)}

      ${card('使い方', `
        <p class="lead">上のタブで編集すると、内容は端末の中の「下書き」に溜まります。
        GitHub へ送るのは「リリース」タブで確認してからの1回だけです。</p>
        <ol class="small" style="padding-left:1.2em;color:var(--ink-dim);line-height:1.9;">
          <li>右上の ⚙ でアクセストークンを設定する(最初の1回)</li>
          <li>モンスター / 降臨 / キャラを編集する</li>
          <li>「点検」でデータの矛盾がないか見る</li>
          <li>「リリース」で版を上げて push する</li>
        </ol>`)}
    `;
  }
};
