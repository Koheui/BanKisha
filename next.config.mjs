/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-8aa83ae527054eb9ad205eb019cbd8da.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;