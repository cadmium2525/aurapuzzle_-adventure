/* =========================================================
 * tools.js — 点検まわり
 *   ・データ整合性チェック(ID重複・参照切れ・画像の欠け)
 *   ・ガチャ排出率シミュレータ
 *   ・経済 / バランス表
 * push する前にここを見ると、壊れたデータを出さずに済む。
 * =======================================================*/
import { $, esc, card, toast } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, blobEntries } from '../draft.js';

/* ===================== 整合性チェック ===================== */

function checkAll() {
  const problems = [];
  const warn = (level, where, text) => problems.push({ level, where, text });

  const d = draft();
  const heldImages = new Set(blobEntries().map(([path]) => path));

  /* --- キャラクター --- */
  const charIds = new Map();
  G.CHARACTERS.forEach(c => charIds.set(c.id, 'ゲーム本体'));
  d.characters.forEach(c => {
    if (charIds.has(c.id)) warn('ng', `キャラ ${c.id}`, `IDが ${charIds.get(c.id)} と重複しています`);
    charIds.set(c.id, '下書き');
    if (!G.LEADER_SKILLS[c.leaderSkillId]) {
      warn('ng', `キャラ ${c.id}`, `リーダースキル ${c.leaderSkillId} がありません`);
    }
    if (!G.ACTIVE_SKILLS[c.skillId]) {
      warn('ng', `キャラ ${c.id}`, `スキル ${c.skillId} がありません`);
    }
    if (c.evoLeaderSkillId && !G.LEADER_SKILLS[c.evoLeaderSkillId]) {
      warn('ng', `キャラ ${c.id}`, `進化後のリーダースキル ${c.evoLeaderSkillId} がありません`);
    }
    if (c.evoSkillId && !G.ACTIVE_SKILLS[c.evoSkillId]) {
      warn('ng', `キャラ ${c.id}`, `進化後のスキル ${c.evoSkillId} がありません`);
    }
    (c.artStages || []).forEach(stage => {
      ['icon', 'full'].forEach(key => {
        if (stage[key] && !heldImages.has(stage[key])) {
          warn('warn', `キャラ ${c.id}`, `${stage[key]} をまだアップロードしていません(絵文字で表示されます)`);
        }
      });
    });
  });

  /* --- モンスター --- */
  const enemyIds = new Set(G.ENEMY_MASTER_IDS);
  d.enemies.forEach(e => {
    const shapes = e.forms || [e];
    shapes.forEach((s, i) => {
      if (!(s.hp > 0)) warn('ng', `モンスター ${e.id}`, `${i}番目の姿のHPが0以下です`);
      if (!(s.atk > 0)) warn('ng', `モンスター ${e.id}`, `${i}番目の姿の攻撃力が0以下です`);
      if (s.sprite && !heldImages.has(s.sprite) && !spriteExists(s.sprite)) {
        warn('warn', `モンスター ${e.id}`, `${s.sprite} が見つかりません`);
      }
    });
    enemyIds.add(e.id);
  });

  /* --- 降臨 --- */
  const raidIds = new Map();
  G.RAID_STAGES.forEach(r => raidIds.set(String(r.id), 'ゲーム本体'));
  [...G.STAGES, ...G.TECHNICAL_STAGES].forEach(s => raidIds.set(String(s.id), '通常/テクニカル'));
  d.raids.forEach(r => {
    if (raidIds.has(String(r.id))) {
      warn('ng', `降臨 ${r.id}`, `ステージIDが ${raidIds.get(String(r.id))} と重複しています`);
    }
    raidIds.set(String(r.id), '下書き');
    if (!r.floors || !r.floors.length) warn('ng', `降臨 ${r.id}`, 'フロアがありません');
    (r.floors || []).forEach((f, i) => {
      if (!f.enemies || !f.enemies.length) warn('ng', `降臨 ${r.id}`, `${i + 1}フロアが空です`);
      (f.enemies || []).forEach(spec => {
        if (!enemyIds.has(spec.id)) {
          warn('ng', `降臨 ${r.id}`, `${i + 1}フロアの ${spec.id} というモンスターがいません`);
        }
      });
    });
    if (r.characterDrop && r.characterDrop.id && !charIds.has(r.characterDrop.id)) {
      warn('ng', `降臨 ${r.id}`, `ドロップする ${r.characterDrop.id} というキャラがいません`);
    }
  });

  /* --- バナー --- */
  d.raids.forEach(r => {
    if (r.banner && !heldImages.has(r.banner) && !existingBanner(r.banner)) {
      warn('warn', `降臨 ${r.id}`, `バナー ${r.banner} をまだアップロードしていません`);
    }
  });
  const st = d.settings || {};
  if (st.gachaBanner && !heldImages.has(st.gachaBanner)) {
    warn('warn', 'ガチャ', `バナー ${st.gachaBanner} をまだアップロードしていません`);
  }
  if (st.pickupId && !charIds.has(st.pickupId)) {
    warn('ng', 'ガチャ', `ピックアップの ${st.pickupId} というキャラがいません`);
  }
  if (st.pickupRate != null && !(st.pickupRate >= 0 && st.pickupRate <= 1)) {
    warn('ng', 'ガチャ', `ピックアップの割合 ${st.pickupRate} が 0〜1 に収まっていません`);
  }

  /* --- どこからも使われていない画像 --- */
  const referenced = new Set();
  d.characters.forEach(c => (c.artStages || []).forEach(s => {
    if (s.icon) referenced.add(s.icon);
    if (s.full) referenced.add(s.full);
  }));
  d.enemies.forEach(e => (e.forms || [e]).forEach(s => { if (s.sprite) referenced.add(s.sprite); }));
  d.raids.forEach(r => { if (r.banner) referenced.add(r.banner); });
  if (st.gachaBanner) referenced.add(st.gachaBanner);
  blobEntries().forEach(([path]) => {
    // アトラスとその索引は焼き直しの成果物なので、参照が無くて当たり前
    if (GENERATED.has(path)) return;
    if (!referenced.has(path)) {
      warn('warn', 'ファイル', `${path} はどこからも参照されていません`);
    }
  });

  return problems;
}

/** 焼き直しで作られるファイル。参照元が無くて当然なので見逃す */
const GENERATED = new Set(['assets/chars/char_atlas.webp', 'src/js/data/char-atlas.js']);

/** ゲーム本体が既に持っているバナー */
const knownBanners = new Set(G.RAID_STAGES.map(r => r.banner).filter(Boolean));
function existingBanner(path) { return knownBanners.has(path); }

/** 既にリポジトリにある画像かどうかの当て推量(相対パスで引けるものだけ) */
const knownSprites = new Set(G.ENEMIES.map(e => e.sprite));
function spriteExists(path) { return knownSprites.has(path); }

/* ===================== ガチャの確率 ===================== */

function gachaTable() {
  const pool = G.GACHA_POOL;
  const weights = G.ORB_WEIGHTS || {};
  const byRarity = {};
  pool.forEach(c => { byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1; });

  const total = Object.keys(weights).reduce((sum, r) => sum + (weights[r] || 0), 0) || 1;
  const rows = Object.keys(byRarity).sort((a, b) => b - a).map(r => {
    const share = (weights[r] || 0) / total;
    const count = byRarity[r];
    const pickup = Number(r) === G.MAX_GACHA_RARITY && G.PICKUP_CHARACTER ? G.PICKUP_RATE : 0;
    const each = count ? (share * (1 - pickup)) / (pickup ? count - 1 : count) : 0;
    return { r, count, share, pickup, each };
  });
  return rows;
}

/* ===================== コイン効率 ===================== */

function efficiencyRows() {
  const rows = [];
  const add = (name, coin, stamina) => rows.push({ name, coin, stamina, rate: coin / stamina });
  G.STAGES.forEach(s => {
    add(`${s.name}`, s.coinReward, s.stamina);
    add(`${s.name} ハード`, Math.round(s.coinReward * G.HARD_REWARD_MULT),
      Math.round(s.stamina * G.HARD_STAMINA_MULT));
  });
  G.DAILY_THEMES.forEach((t, day) => {
    G.dailyStagesFor(day).forEach(s => add(s.name, s.coinReward, s.stamina));
  });
  rows.sort((a, b) => b.rate - a.rate);
  return rows.slice(0, 12);
}

export default {
  render(view) {
    const problems = checkAll();
    const bad = problems.filter(p => p.level === 'ng');
    const soft = problems.filter(p => p.level === 'warn');
    const gacha = gachaTable();
    const eff = efficiencyRows();
    const pouch = G.SHOP_ITEMS.find(i => i.type === 'orb');
    const drink = G.SHOP_ITEMS.find(i => i.type === 'stamina');
    const perDay = pouch ? pouch.amount * (pouch.dailyLimit || 0) : 0;
    const drinkCost = drink ? drink.price * (drink.dailyLimit || 0) : 0;

    view.innerHTML = `
      ${card('データ整合性', problems.length === 0
        ? '<p class="ok">問題は見つかりませんでした。</p>'
        : `${bad.length ? `<div class="warn">直さないと壊れるもの: <b>${bad.length}</b> 件</div>` : ''}
           <div class="rows">
             ${problems.map(p => `<div class="row flat">
               <div class="grow"><b class="${p.level === 'ng' ? 'ng' : ''}">${esc(p.where)}</b>
               <span class="sub">${esc(p.text)}</span></div>
               <span class="tail">${p.level === 'ng' ? '要修正' : '注意'}</span></div>`).join('')}
           </div>`)}

      ${card('ガチャの排出率(オーブ召喚)', `
        <div class="scroll-x"><table class="data">
          <tr><th>レア</th><th class="num">体数</th><th class="num">帯の確率</th><th class="num">1体あたり</th></tr>
          ${gacha.map(g => `<tr>
            <td>★${esc(g.r)} ${esc(G.RARITY_TITLE[g.r] || '')}</td>
            <td class="num">${esc(g.count)}</td>
            <td class="num">${(g.share * 100).toFixed(1)}%</td>
            <td class="num">${(g.each * 100).toFixed(2)}%</td></tr>`).join('')}
        </table></div>
        ${G.PICKUP_CHARACTER ? `<p class="small" style="color:var(--ink-dim)">
          ピックアップ: ${esc(G.PICKUP_CHARACTER.name)} — ★${G.MAX_GACHA_RARITY}帯の
          ${(G.PICKUP_RATE * 100).toFixed(0)}%</p>` : ''}
        <p class="small" style="color:var(--ink-faint)">単発 ${G.ORB_COST}ダイヤ / 10連 ${G.ORB_COST_MULTI}ダイヤ</p>`)}

      ${card('コイン効率の上位', `
        <p class="lead small">スタミナ1あたりのコイン。ここが高すぎると、
          ショップの小袋を通してダイヤが無限に増えます。</p>
        <div class="scroll-x"><table class="data">
          <tr><th>ステージ</th><th class="num">コイン</th><th class="num">スタミナ</th><th class="num">効率</th></tr>
          ${eff.map(r => `<tr><td>${esc(r.name)}</td>
            <td class="num">${r.coin.toLocaleString()}</td>
            <td class="num">${esc(r.stamina)}</td>
            <td class="num">${r.rate.toFixed(1)}</td></tr>`).join('')}
        </table></div>`)}

      ${card('経済の安全弁', `
        <dl class="kv">
          <dt>1日に替えられるダイヤ</dt><dd>${perDay}(小袋 ${pouch ? pouch.dailyLimit : 0}個/日)</dd>
          <dt>ドリンクを買い切る値段</dt><dd>${drinkCost} ダイヤ</dd>
          <dt>ダイヤ→スタミナ→コイン→ダイヤ</dt>
          <dd class="${perDay < drinkCost ? 'ok' : 'ng'}">
            ${perDay < drinkCost ? '赤字で閉じている(健全)' : '黒字。無限に増やせます'}</dd>
        </dl>
        <p class="small" style="color:var(--ink-faint)">
          コイン建ての商品にスタミナを混ぜたり、小袋の上限を外すとここが崩れます。</p>`)}
    `;
  }
};
