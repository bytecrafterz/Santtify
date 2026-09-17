/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * `@pv/cartoes` é um pacote do próprio monorepo, em JavaScript simples.
   *
   * Sem esta linha o Next trata-o como dependência externa e o `output:
   * 'standalone'` não o leva para a imagem: o site sobe e rebenta na primeira
   * página que calcule um enquadramento. Está aqui pela mesma razão que o
   * ENTREGA.md avisa sobre as NEXT_PUBLIC_: a falha não dá erro no build, dá
   * erro em produção.
   */
  transpilePackages: ['@pv/cartoes', '@pv/karaoke'],
  // Gera um servidor mínimo com só as dependências usadas — a imagem de
  // produção fica na casa das dezenas de MB em vez de centenas.
  output: 'standalone',
  // O conteúdo (áudio, imagem) é hospedado pelo próprio projeto ou por CDN
  // que o cliente escolher; a lista cresce quando ele definir onde sobe.
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}
export default nextConfig
