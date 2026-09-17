/* =========================================================
 * boot.js — loading → title → game の起動フロー
 * =======================================================*/
import { $ } from './ui.js';
import { homeCharacters } from './state.js';
import { preloadBgm } from './audio.js';

const BASE_IMAGES = [
  './assets/ui/loading.webp',
  './assets/ui/title.webp',
  './assets/ui/bg.webp',
  './assets/ui/menu_atlas.webp',
  './assets/ui/present.webp',
  './assets/promo/kyuko_banner.webp',
  './assets/items/item_atlas.webp',
  './assets/battle/aura_atlas.webp',
  './assets/battle/enemy_badges.webp'
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function preloadImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve; // 1素材の失敗でタイトルへ進めなくならないようにする
    image.src = src;
  });
}

function currentPartyImages() {
  // 起動直後に出るのはホームの1枚絵なので、そこに並ぶ3人を先に読む
  return homeCharacters()
    .map(ch => ch.art && ch.art.full)
    .filter(Boolean)
    .map(src => `./${src.replace(/^\.\//, '')}`);
}

function setProgress(done, total) {
  const percent = Math.round(done / Math.max(1, total) * 100);
  $('loadingProgress').style.width = `${percent}%`;
  $('loadingPercent').textContent = `${percent}%`;
  $('loadingLabel').textContent = percent >= 100 ? '準備完了' : '起動データを読み込み中';
}

export async function runBoot(onStart) {
  const startedAt = performance.now();
  const imagePaths = [...new Set(BASE_IMAGES.concat(currentPartyImages()))];
  const tasks = imagePaths.map(preloadImage).concat(preloadBgm());
  let done = 0;
  setProgress(done, tasks.length);
  await Promise.all(tasks.map(task => task.finally(() => setProgress(++done, tasks.length))));
  await delay(Math.max(0, 850 - (performance.now() - startedAt)));
  setProgress(tasks.length, tasks.length);
  await delay(220);

  // ここまで来れば起動は成功。index.html の見張り番を解く
  if (typeof window.__acbBootDone === 'function') window.__acbBootDone();

  const loading = $('loadingScreen');
  const title = $('titleScreen');
  title.hidden = false;
  requestAnimationFrame(() => title.classList.add('ready'));
  loading.classList.add('leaving');
  setTimeout(() => { loading.hidden = true; }, 480);

  title.addEventListener('click', () => {
    // 音声再生は必ずこのユーザー操作の同期処理内で始める。
    onStart();
    const app = $('app');
    app.setAttribute('aria-hidden', 'false');
    app.classList.add('ready');
    title.classList.add('leaving');
    setTimeout(() => { title.hidden = true; }, 520);
  }, { once: true });
}
