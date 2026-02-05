/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved serverComponentsExternalPackages from experimental to root level
  serverExternalPackages: [
    'puppeteer', 
    'puppeteer-core', 
    'puppeteer-extra', 
    'puppeteer-extra-plugin-stealth'
  ],
  
  // turbopack should be at root level (not in experimental)
  turbopack: {
    root: __dirname, // Add this to fix the lockfile warning
  },
  
  // Keep experimental object for other experimental features if needed
  experimental: {},
  
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