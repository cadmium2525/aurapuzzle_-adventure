const CACHE_NAME = 'aura-connect-v7';
const ASSETS = [
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './src/css/style.css',
  './src/js/main.js',
  './src/js/core/storage.js',
  './src/js/core/ui.js',
  './src/js/core/state.js',
  './src/js/core/nav.js',
  './src/js/core/sysmodal.js',
  './src/js/core/firebase.js',
  './src/js/core/friends.js',
  './src/js/data/gamedata.js',
  './src/js/data/characters.js',
  './src/js/data/skills.js',
  './src/js/battle/board.js',
  './src/js/battle/party.js',
  './src/js/battle/renderer.js',
  './src/js/battle/battle.js',
  './src/js/screens/parts.js',
  './src/js/screens/home.js',
  './src/js/screens/dungeon.js',
  './src/js/screens/character.js',
  './src/js/screens/guide.js',
  './src/js/screens/gacha.js',
  './src/js/screens/shop.js',
  './src/js/screens/mypage.js',
  './src/js/screens/friends.js'
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
    e.respondWith(
      fetch(e.request)
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
