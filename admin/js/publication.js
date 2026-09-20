import { field } from './ui.js';
export function publicationFields(item) {
  return `<h3>公開期間（日本時間）</h3>
    ${field('公開状態', 'enabled', item.enabled === false ? 'false' : 'true', {type:'select', options:[['true','公開／期間中のみ公開'],['false','非公開']]})}
    ${field('イベントID（空なら通常）', 'eventId', item.eventId || '')}
    ${field('開始日時 JST', 'availableFrom', jstInput(item.availableFrom), {type:'datetime-local'})}
    ${field('終了日時 JST（この時刻から非公開）', 'availableUntil', jstInput(item.availableUntil), {type:'datetime-local'})}
    <p class="lead small">空欄は期限なし。イベントIDを指定するとイベント全体の期間も適用。獲得済みキャラは終了後も使用できます。</p>`;
}
function jstInput(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t + 9*3600000).toISOString().slice(0,16) : '';
}
export function readPublication(v) {
  return {enabled:v.enabled !== 'false', eventId:String(v.eventId || '').trim(),
    availableFrom:v.availableFrom ? `${v.availableFrom}:00+09:00` : '',
    availableUntil:v.availableUntil ? `${v.availableUntil}:00+09:00` : ''};
}
export function validPublication(p) {
  return (!p.availableFrom || Number.isFinite(Date.parse(p.availableFrom)))
    && (!p.availableUntil || Number.isFinite(Date.parse(p.availableUntil)))
    && (!p.availableFrom || !p.availableUntil || Date.parse(p.availableFrom)<Date.parse(p.availableUntil));
}
