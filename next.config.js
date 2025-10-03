/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  },
  images: {
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com']
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/articles',
        permanent: false,
      },
    ]
  }
}

module.exports = nextConfig
