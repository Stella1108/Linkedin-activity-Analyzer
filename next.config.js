/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {}, // Add this line
  
  experimental: {
    serverComponentsExternalPackages: [
      'puppeteer', 
      'puppeteer-core', 
      'puppeteer-extra', 
      'puppeteer-extra-plugin-stealth'
    ],
  },
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
        'clone-deep': 'commonjs clone-deep',
      });
    }
    return config;
  },
}

module.exports = nextConfig