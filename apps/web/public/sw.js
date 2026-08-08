/*
 * Service worker do PWA.
 *
 * Estratégia deliberadamente conservadora:
 *  - Navegação: rede primeiro, cache como rede de segurança. O conteúdo muda
 *    quando o cliente edita pelo painel, e servir cache velho faria parecer
 *    que a edição dele não funcionou.
 *  - Mídia e estáticos: cache primeiro. Áudio de música é pesado e não muda.
 *  - Chamadas a /track e à API nunca são cacheadas.
 */
const CACHE = 'pv-v1'
const ESSENCIAIS = ['/', '/manifest.json', '/icone.svg']

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const req = evento.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Rastreamento e API sempre na rede: nunca servir métrica ou dado de cache.
  if (url.pathname.startsWith('/track') || url.pathname.startsWith('/r/')) return
  if (url.origin !== self.location.origin) return

  const ehMidia = /\.(mp3|m4a|ogg|wav|mp4|webm|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)

  if (ehMidia) {
    evento.respondWith(
      caches.match(req).then(
        (cacheado) =>
          cacheado ??
          fetch(req).then((res) => {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
            return res
          }),
      ),
    )
    return
  }

  evento.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copia))
        return res
      })
      .catch(() => caches.match(req).then((c) => c ?? caches.match('/'))),
  )
})
