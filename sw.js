/* 100yd Sync Service Worker
   方針：本番(HTTPS)は「キャッシュ優先」＝ユーザーが同意するまでアプリのバージョンを固定する（サイレント更新をしない）。
        新バージョンは waiting のまま待機し、ページ側の「更新する」操作（SKIP_WAITING メッセージ）で初めて適用する。
        localhost/127.0.0.1（開発）は「ネットワーク優先」＝編集が即反映。
   ★リリースごとに CACHE の版数を上げること（新SWのinstallを発火させるため）。 */
const CACHE = '100yd-sync-2.3.0';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', e => {
  // 自動 skipWaiting はしない（＝同意制）。新版のアセットだけ先にキャッシュしておく。
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ページからの「更新する」指示で初めて有効化
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (DEV) {
    // 開発：ネットワーク優先（編集が即反映）。失敗時のみキャッシュ。
    e.respondWith(
      fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }
  // 本番：キャッシュ優先（同意するまで版を固定）。未キャッシュはネットワーク→保存。
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
      .catch(() => caches.match('./index.html')))
  );
});
