/* ===================== ホーム画面 ===================== */
import { $ } from '../core/ui.js';
import { getTeamStats } from '../core/state.js';
import { monRowHTML } from './parts.js';

export function renderHome() {
  const { mons } = getTeamStats();
  const box = $('homeLeaderBox');
  box.innerHTML = mons.length
    ? monRowHTML(mons[0])
    : '<div class="minfo mstats">編成が空です。モンスター画面で設定しましょう。</div>';
}
