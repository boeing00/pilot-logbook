/*
 * Offline support for Pilot Logbook.
 *
 * Strategy:
 *  - Navigations: network-first (always get the freshest index.html when
 *    online), falling back to the cached shell when offline.
 *  - Same-origin assets + Google Fonts: cache-first (Vite asset filenames are
 *    content-hashed, so cached copies never go stale).
 *  - Everything else (Firebase Auth/Firestore, Tesseract CDN) is never
 *    intercepted — those need the network and manage their own state.
 *
 * Flight data itself lives in localStorage, so once the shell is cached the
 * whole logbook (tables, stats, CSV export) works fully offline. Uploading
 * new PDFs/photos and cloud sync still require a connection.
 */
const VERSION = 'v1'
const APP_CACHE = `pilot-logbook-${VERSION}`
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== APP_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

async function handleNavigate(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(APP_CACHE)
    cache.put('/', response.clone())
    return response
  } catch {
    const cached = await caches.match('/')
    return cached ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(APP_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isFonts =
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== self.location.origin && !isFonts) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request))
    return
  }
  event.respondWith(cacheFirst(request))
})
