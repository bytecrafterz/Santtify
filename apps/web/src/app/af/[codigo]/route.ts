/**
 * O link do afiliado: santtify.com/af/<código>.
 *
 * Só dá a volta para o link rastreado, `/r/af-<código>`, que é a porta de
 * todos os links: é lá que o clique é contado (uma pessoa por dia), que o
 * cookie da visita nasce, e que se decide para onde ir — a página dos
 * cartões. Um código que não existe também vai para a loja, sem erro.
 *
 * O endereço de lá sai do da API, que tem a raiz do site: em produção
 * https://santtify.com/api → https://santtify.com/r/...
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'
const RAIZ_DOS_LINKS = API.replace(/\/+$/, '').replace(/\/api$/, '')

export async function GET(pedido: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  // Só o que um código pode ter; o resto do caminho não passa daqui.
  const limpo = decodeURIComponent(codigo).toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 40)
  const consulta = new URL(pedido.url).search
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${RAIZ_DOS_LINKS}/r/af-${limpo}${consulta}`,
      // O destino pode mudar no painel: nenhum intermediário guarda este salto.
      'Cache-Control': 'no-store',
    },
  })
}
