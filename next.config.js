/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved serverComponentsExternalPackages from experimental to root level
  serverExternalPackages: [
    'puppeteer', 
    'puppeteer-core', 
    'puppeteer-extra', 
    'puppeteer-extra-plugin-stealth'
  ],
  
  // Updated turbopack configuration
  experimental: {
    turbopack: {
      root: __dirname, // Add this to fix the lockfile warning
    },
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