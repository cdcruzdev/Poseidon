/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'app.meteora.ag',
      },
      {
        protocol: 'https',
        hostname: 'www.orca.so',
      },
      {
        protocol: 'https',
        hostname: 'raydium.io',
      },
    ],
  },
};

module.exports = nextConfig;
