/*
 * Service worker do PWA.
 *
 * A versão anterior tinha dois defeitos que só aparecem depois de a aplicação
 * estar instalada há dias — e foi o que aconteceu ao cliente em 22/08.
 *
 * 1. O nome do cache era fixo. Como o `activate` só apaga caches com nome
 *    DIFERENTE do actual, e o nome nunca mudava, nada era apagado nunca. Um
 *    telemóvel que instalou a aplicação na semana passada ficava com aquilo
 *    para sempre.
 *
 * 2. A mídia era cache primeiro e mais nada: uma vez guardada, nunca mais era
 *    lida da rede. Se ele trocasse a arte de uma letra, quem já a tinha visto
 *    continuava a ver a antiga, sem forma de sair disso a não ser desinstalar.
 *
 * Agora: o nome do cache muda a cada publicação, a mídia é servida depressa do
 * cache mas actualizada em segundo plano, e quando entra uma versão nova as
 * páginas abertas são avisadas para se recarregarem.
 */

/* A data da compilação entra no nome. Cada publicação estreia um cache limpo e
 * manda os antigos fora — que era o que faltava. */
const CACHE = 'pv-' + (self.__VERSAO__ || 'dev')
const ESSENCIAIS = ['/', '/manifest.json', '/icone.svg']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => {
        // SÓ AVISA QUANDO HOUVE MESMO UMA TROCA DE VERSÃO.
        //
        // Antes avisava sempre, e a primeira visita de qualquer pessoa é uma
        // activação: não havia service worker, instala-se um, e a página
        // recarregava-se logo. O recarregamento é rápido e não se vê — mas
        // apaga o primeiro instante da visita, e com ele a introdução do
        // projeto, que só é para aparecer da primeira vez. Quem chegava pela
        // primeira vez nunca a chegava a ver.
        //
        // Uma troca de versão reconhece-se por existir cache anterior com
        // outro nome. Numa instalação nova não existe nenhuma.
        const antigas = chaves.filter((k) => k.startsWith('pv-') && k !== CACHE)
        return Promise.all(antigas.map((k) => caches.delete(k))).then(() => antigas.length > 0)
      })
      .then((houveTroca) =>
        self.clients.claim().then(() => {
          if (!houveTroca) return
          // Avisa quem está com a página aberta que existe versão nova. Sem
          // isto, quem tem a aplicação aberta continua a ver a anterior até
          // fechar e abrir de novo — e ninguém fecha uma aplicação para
          // verificar isso.
          return self.clients
            .matchAll({ type: 'window' })
            .then((janelas) => janelas.forEach((j) => j.postMessage({ tipo: 'versao-nova' })))
        }),
      ),
  )
})

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'assumir-agora') self.skipWaiting()
})

self.addEventListener('fetch', (evento) => {
  const req = evento.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Rastreamento, redirecções e API sempre na rede: nunca servir métrica de
  // cache, nem um link curto que pode ter mudado de destino.
  if (url.pathname.startsWith('/track') || url.pathname.startsWith('/r/')) return
  if (url.pathname.startsWith('/api/')) return
  if (url.origin !== self.location.origin) return

  const ehMidia = /\.(mp3|m4a|ogg|wav|mp4|webm|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)

  if (ehMidia) {
    // Depressa do cache, actualizado por trás. Quem abre vê logo o que já tem;
    // na vez seguinte vê o que ele trocou entretanto.
    evento.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((cacheado) => {
          const daRede = fetch(req)
            .then((res) => {
              if (res.ok) c.put(req, res.clone())
              return res
            })
            .catch(() => cacheado)
          return cacheado || daRede
        }),
      ),
    )
    return
  }

  evento.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copia))
        }
        return res
      })
      .catch(() => caches.match(req).then((c) => c ?? caches.match('/'))),
  )
})
