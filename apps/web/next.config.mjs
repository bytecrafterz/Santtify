/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
