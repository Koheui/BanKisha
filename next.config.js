/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin'],
  output: 'standalone',
  reactStrictMode: true,
  // Firebase Functionsディレクトリを除外
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/functions/**', '**/node_modules/**'],
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // リダイレクトを一時的に無効化（開発中）
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/articles',
  //       permanent: false,
  //     },
  //   ]
  // },
}

module.exports = nextConfig

