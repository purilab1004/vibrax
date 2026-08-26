// Vibrexcup 서비스워커 — 앱 셸 캐시(오프라인 대비) + 네트워크 우선. 게임/API/오디오는 캐시하지 않는다.
const CACHE = 'vibrex-v1'
const SHELL = ['/', '/games', '/offline', '/icon-192.png', '/icon-512.png']
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  // 게임·API·플레이·오디오는 항상 네트워크 (캐시 금지)
  if (/^\/(api|play|studio)\b/.test(url.pathname) || /\.(mp3|wav|ogg|mp4|webm)$/i.test(url.pathname)) return
  // HTML 문서: 네트워크 우선, 실패 시 오프라인 셸
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/offline') || caches.match('/'))))
    return
  }
  // 정적 자원: 캐시 우선, 없으면 네트워크 후 캐시
  e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
    if (res.ok && (url.pathname.startsWith('/_next/static') || /\.(png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname))) {
      const clone = res.clone(); caches.open(CACHE).then((c) => c.put(req, clone))
    }
    return res
  }).catch(() => cached)))
})
