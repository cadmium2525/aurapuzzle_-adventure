const CACHE_NAME = 'acb-admin-v16';

/* 管理ツールの本体。オフラインでも一覧の確認くらいはできるようにする
   (push は当然ネットが要る)。 */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/admin.css',
  './js/main.js',
  './js/publication.js',
  './js/views/events.js',
  './js/ui.js',
  './js/github.js',
  './js/draft.js',
  './js/image.js',
  './js/character-acquisition.js',
  './js/draft-catalog.js',
  './js/custom-source.js',
  './js/atlas.js',
  './js/skill-parts.js',
  './js/gamedata.js',
  './js/views/home.js',
  './js/views/enemies.js',
  './js/views/raids.js',
  './js/views/characters.js',
  './js/views/gacha.js',
  './js/views/skills.js',
  './js/views/gifts.js',
  './js/views/tools.js',
  './js/views/release.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => { /* 1つでも取れなければ諦める。次回に拾い直す */ })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // GitHub API は絶対にキャッシュしない(古いSHAで上書きすると事故になる)
  if (url.origin !== self.location.origin) return;

  // ツール本体は network-first。直してすぐ試せるほうが大事
  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
