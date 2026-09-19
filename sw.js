const CACHE_NAME = 'aura-connect-v65';
const ASSETS = [
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/items/item_atlas.webp',
  './assets/chars/char_atlas.webp',
  './assets/battle/aura_atlas.webp',
  './assets/ui/loading.webp',
  './assets/ui/title.webp',
  './assets/promo/kyuko_banner.webp',
  './assets/Welcome_to_the_Puzzle.mp3',
  './assets/Circuit_Breaker.mp3',
  './src/css/style.css',
  './src/js/main.js',
  './src/js/core/storage.js',
  './src/js/core/ui.js',
  './src/js/core/audio.js',
  './src/js/core/boot.js',
  './src/js/core/state.js',
  './src/js/core/account.js',
  './src/js/core/version.js',
  './src/js/core/recovery.js',
  './src/js/core/nav.js',
  './src/js/core/sysmodal.js',
  './src/js/core/firebase.js',
  './src/js/core/friends.js',
  './src/js/core/gifts.js',
  './src/js/data/gamedata.js',
  './src/js/data/enemies.js',
  './src/js/data/enemy-master.js',
  './src/js/data/raids.js',
  './src/js/data/custom.js',
  './src/js/data/banners.js',
  './src/js/battle/encounter.js',
  './src/js/battle/raid-presentation.js',
  './src/js/battle/player-badges.js',
  './assets/battle/player_badges.webp',
  './assets/chars/kyuko_1.webp',
  './assets/chars/kyuko_2.webp',
  './assets/chars/kyuko_1_icon.webp',
  './assets/chars/kyuko_2_icon.webp',
  './src/js/data/characters.js',
  './src/js/data/char-atlas.js',
  './src/js/data/skills.js',
  './src/js/battle/board.js',
  './src/js/battle/party.js',
  './src/js/battle/resume.js',
  './src/js/battle/renderer.js',
  './src/js/battle/battle.js',
  './src/js/battle/enemy-skills.js',
  './src/js/battle/enemy-motion.js',
  './src/js/battle/enemy-badges.js',
  './src/js/battle/enemy-shield.js',
  './src/js/battle/party-motion.js',
  './src/js/battle/chance.js',
  './src/js/battle/damage.js',
  './assets/battle/enemy_badges.webp',
  './src/js/screens/parts.js',
  './src/js/screens/home.js',
  './src/js/screens/dungeon.js',
  './src/js/screens/training.js',
  './src/js/data/training.js',
  './src/js/screens/character.js',
  './src/js/screens/guide.js',
  './src/js/screens/gacha.js',
  './src/js/screens/shop.js',
  './src/js/screens/mypage.js',
  './src/js/screens/friends.js',
  './src/js/screens/present.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// アプリ本体は network-first(更新を取りこぼさない) / それ以外は cache-first
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isAppCode = url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname.endsWith('/'));

  if (isAppCode) {
    // cache:'reload' で端末側のHTTPキャッシュを飛び越える。
    // これをしないと index.html だけ古いものが返り、JSと版がずれて起動できなくなる。
    // ページ遷移のリクエストは作り直せない環境があるので、駄目なら元のまま使う。
    let fresh = e.request;
    try { fresh = new Request(e.request, { cache: 'reload' }); } catch (err) { /* そのまま */ }
    e.respondWith(
      fetch(fresh)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
      return res;
    }))
  );
});
