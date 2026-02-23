// scripts/install-chrome.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('🔧 INSTALLING CHROME FOR PUPPETEER');
console.log('='.repeat(60));

// Use Render's persistent disk
const cacheDir = '/opt/render/.cache/puppeteer';
console.log(`📂 Cache directory: ${cacheDir}`);

// Create cache directory
try {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
    console.log('✅ Created cache directory');
  }
} catch (error) {
  console.error('❌ Failed to create cache directory:', error.message);
  process.exit(1);
}

// Set environment variables
process.env.PUPPETEER_CACHE_DIR = cacheDir;
process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';

try {
  console.log('\n📥 Downloading Chrome...');
  
  // Download Chrome
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
      PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
    },
    timeout: 300000 // 5 minutes
  });
  
  console.log('\n✅ Chrome installed successfully!');
  
  // Find and verify Chrome
  const chromeBaseDir = path.join(cacheDir, 'chrome');
  if (fs.existsSync(chromeBaseDir)) {
    const versions = fs.readdirSync(chromeBaseDir);
    if (versions.length > 0) {
      const chromePath = path.join(chromeBaseDir, versions[0], 'chrome-linux64', 'chrome');
      console.log(`📍 Chrome path: ${chromePath}`);
      
      if (fs.existsSync(chromePath)) {
        fs.chmodSync(chromePath, 0o755);
        console.log('✅ Chrome is ready to use');
      }
    }
  }
  
} catch (error) {
  console.error('\n❌ Failed to install Chrome:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ CHROME INSTALLATION COMPLETE');
console.log('='.repeat(60));