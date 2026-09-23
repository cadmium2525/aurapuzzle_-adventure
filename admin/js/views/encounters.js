/* テクニカル・曜日ダンジョンの出現表。技は各モンスターのマスターを参照する。 */
import { card, esc, toast } from '../ui.js';
import * as G from '../gamedata.js';
import { draft, setSetting } from '../draft.js';

let working;

function catalog() {
  const map = new Map(G.ENEMY_MASTER_IDS.map(id => [id, G.enemyFormOf(id)]));
  draft().enemies.forEach(enemy => {
    map.set(enemy.id, enemy.forms ? { ...enemy.forms[0], boss: true } : enemy);
  });
  return new Map([...map].filter(([, enemy]) => enemy && !enemy.boss && enemy.sprite));
}

function special(enemy) {
  const skills = enemy?.enemySkills;
  return !!(skills && (skills.preemptive || skills.passives?.length
    || skills.actions?.some(action => action.effects?.length) || skills.buildUpBelow != null));
}

function skillLabel(enemy) {
  const skills = enemy?.enemySkills || {};
  const effects = [
    ...(skills.preemptive?.effects || []), ...(skills.passives || []),
    ...(skills.actions || []).flatMap(action => action.effects || [])
  ];
  const labels = [...new Set(effects.map(G.describeEffect).filter(Boolean))];
  if (skills.buildUpBelow != null) labels.push(`HP${skills.buildUpBelow}%以下でビルドアップ`);
  return labels.join('、') || '通常攻撃のみ';
}

function select(id, kind, index, enemies, onlySpecial) {
  const options = [...enemies].filter(([, enemy]) => !onlySpecial || special(enemy));
  const current = enemies.get(id);
  if (!options.some(([key]) => key === id)) options.unshift([id, current || { name: `${id}（未登録）` }]);
  return `<span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><select data-kind="${kind}" data-index="${index}" style="max-width:100%">
    ${options.map(([key, enemy]) => `<option value="${esc(key)}"${key === id ? ' selected' : ''}>${esc(enemy.name || key)} (${esc(key)})</option>`).join('')}
  </select><small class="small">${esc(skillLabel(current))}</small></span>`;
}

function render(view) {
  if (!working) {
    const saved = draft().settings?.specialEncounters || G.CUSTOM_SETTINGS.specialEncounters || {};
    const tech = Array.isArray(saved.technical) && saved.technical.length === 10
      && saved.technical.every(Array.isArray) ? saved.technical : G.TECH_ENCOUNTER_IDS;
    const daily = Array.isArray(saved.daily) && saved.daily.length === 7
      && saved.daily.every(Array.isArray) ? saved.daily : G.DAILY_ENCOUNTER_IDS;
    working = {
      technical: tech.map(ids => [...ids]),
      daily: daily.map(ids => [...ids])
    };
  }
  const enemies = catalog();
  const techRows = working.technical.map((ids, chapter) => `
    <h3>${chapter + 1}階層・${esc(G.techChapterNameOf(chapter + 1))}</h3>
    ${ids.map((id, index) => `
      <div class="slot" style="align-items:center">
        <span class="mono" style="min-width:4em">${index + 1}番</span>
        <div class="grow">${select(id, `technical-${chapter}`, index, enemies, true)}</div>
      </div>`).join('')}`).join('');
  const dailyRows = G.DAILY_THEMES.map(theme => `
    <h3>${esc(theme.label)}曜・${esc(theme.title)}</h3>
    ${working.daily[theme.day].map((id, index) => `
      <div class="slot" style="align-items:center">
        <span class="mono" style="min-width:4em">${index + 1}F</span>
        <div class="grow">${select(id, `daily-${theme.day}`, index, enemies, false)}</div>
      </div>`).join('')}`).join('');
  view.innerHTML = `
    ${card('出現と行動の管理', `
      <p class="lead">特殊ダンジョンはこの出現表に載せた敵だけを使います。新規モンスターを登録しても自動では混ざりません。技・先制・耐性はモンスターのマスター設定を参照し、ステージではHPと攻撃力だけ調整します。</p>
      <p class="lead small">ノーマルダンジョンは従来どおり一般モンスターから自動抽選。降臨・イベントは各フロアの明示配置を使います。</p>`)}
    ${card('テクニカルダンジョン', `
      <p class="lead small">各階層に5体を登録し、ステージごとに開始位置をずらします。全員に特殊行動が必要です。</p>
      ${techRows}`)}
    ${card('曜日ダンジョン', `
      <p class="lead small">初・中・上級で同じ敵と技を使い、ステータスだけ変わります。</p>
      ${dailyRows}`,
      '<button class="btn primary" id="saveEncounters">出現表を下書きに保存</button>')}
  `;

  view.querySelectorAll('select[data-kind]').forEach(input => input.addEventListener('change', () => {
    const { kind, index } = input.dataset;
    if (kind.startsWith('technical-')) working.technical[Number(kind.slice(10))][Number(index)] = input.value;
    else working.daily[Number(kind.slice(6))][Number(index)] = input.value;
    render(view);
  }));
  view.querySelector('#saveEncounters').addEventListener('click', () => {
    if (working.technical.length !== 10 || working.technical.some(ids => ids.length !== 5
      || ids.some(id => !special(enemies.get(id))))) {
      toast('テクニカルは各階層に特殊行動のある通常敵を5体配置してください'); return;
    }
    if (working.daily.length !== 7 || working.daily.some(ids => ids.length !== 5 || ids.some(id => !enemies.has(id)))) {
      toast('曜日は各5フロアに登録済みの通常敵を配置してください'); return;
    }
    setSetting('specialEncounters', structuredClone(working));
    toast('出現表を下書きに保存しました。リリース画面から反映してください');
  });
}

export default { render(view) { working = null; render(view); } };
