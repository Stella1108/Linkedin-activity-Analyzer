// scripts/install-chrome.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🔧 CHROME INSTALLATION SCRIPT FOR PUPPETEER');
console.log('='.repeat(80));
console.log(`📂 Current directory: ${process.cwd()}`);
console.log(`💻 Platform: ${process.platform}`);
console.log(`🌎 Render: ${!!process.env.RENDER}`);
console.log(`🕐 Time: ${new Date().toISOString()}`);

// ==========================================================================
// CONFIGURATION
// ==========================================================================
const isRender = !!process.env.RENDER;
const CACHE_DIR = isRender 
  ? '/opt/render/.cache/puppeteer' 
  : path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer');

console.log(`\n📂 Cache directory: ${CACHE_DIR}`);

// ==========================================================================
// STEP 1: CREATE CACHE DIRECTORY
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 1: Creating cache directory');
console.log('-'.repeat(40));

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o755 });
    console.log('✅ Created cache directory');
  } else {
    console.log('✅ Cache directory already exists');
    
    // Ensure it has correct permissions
    fs.chmodSync(CACHE_DIR, 0o755);
    console.log('✅ Updated cache directory permissions');
  }
} catch (error) {
  console.error('❌ Failed to create/update cache directory:', error.message);
  process.exit(1);
}

// ==========================================================================
// STEP 2: SET ENVIRONMENT VARIABLES
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 2: Setting environment variables');
console.log('-'.repeat(40));

process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;
process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';
process.env.PUPPETEER_EXECUTABLE_PATH = ''; // Let Puppeteer find it

console.log(`✅ PUPPETEER_CACHE_DIR = ${CACHE_DIR}`);
console.log(`✅ PUPPETEER_SKIP_CHROME_DOWNLOAD = false`);

// ==========================================================================
// STEP 3: CHECK IF CHROME IS ALREADY INSTALLED
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 3: Checking for existing Chrome installation');
console.log('-'.repeat(40));

let chromeExists = false;
let chromePath = '';

const chromeBaseDir = path.join(CACHE_DIR, 'chrome');
if (fs.existsSync(chromeBaseDir)) {
  try {
    const versions = fs.readdirSync(chromeBaseDir);
    console.log(`📂 Found Chrome versions: ${versions.length > 0 ? versions.join(', ') : 'none'}`);
    
    for (const version of versions) {
      const possiblePath = path.join(chromeBaseDir, version, 'chrome-linux64', 'chrome');
      if (fs.existsSync(possiblePath)) {
        chromeExists = true;
        chromePath = possiblePath;
        console.log(`✅ Found existing Chrome at: ${chromePath}`);
        break;
      }
    }
  } catch (error) {
    console.log('⚠️ Error scanning chrome directory:', error.message);
  }
}

// ==========================================================================
// STEP 4: DOWNLOAD CHROME IF NEEDED
// ==========================================================================
if (!chromeExists) {
  console.log('\n' + '-'.repeat(40));
  console.log('STEP 4: Downloading Chrome');
  console.log('-'.repeat(40));
  console.log('⏳ This may take 2-3 minutes...');

  try {
    // Try primary download method
    console.log('📥 Method 1: Using puppeteer browsers install...');
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: CACHE_DIR,
        PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
      },
      timeout: 300000 // 5 minutes
    });
    console.log('✅ Chrome downloaded successfully via method 1');
  } catch (error1) {
    console.log('⚠️ Method 1 failed:', error1.message);
    
    try {
      // Try alternative download method
      console.log('\n📥 Method 2: Using @puppeteer/browsers...');
      execSync('npx @puppeteer/browsers install chrome@latest --path ' + CACHE_DIR, {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: CACHE_DIR
        },
        timeout: 300000
      });
      console.log('✅ Chrome downloaded successfully via method 2');
    } catch (error2) {
      console.error('❌ Both download methods failed:', error2.message);
      process.exit(1);
    }
  }
} else {
  console.log('\n✅ Chrome already installed, skipping download');
}

// ==========================================================================
// STEP 5: FIND AND VERIFY CHROME INSTALLATION
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 5: Verifying Chrome installation');
console.log('-'.repeat(40));

let foundPath = '';
let foundVersion = '';

// Search for Chrome in cache directory
if (fs.existsSync(chromeBaseDir)) {
  try {
    const versions = fs.readdirSync(chromeBaseDir);
    console.log(`📂 Scanning ${versions.length} Chrome versions...`);
    
    for (const version of versions) {
      const possiblePath = path.join(chromeBaseDir, version, 'chrome-linux64', 'chrome');
      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        console.log(`✅ Found Chrome at: ${foundPath}`);
        break;
      }
    }
  } catch (error) {
    console.error('❌ Error scanning chrome directory:', error.message);
  }
}

// If not found in cache, try system locations
if (!foundPath) {
  console.log('🔍 Checking system Chrome locations...');
  const systemPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  
  for (const sysPath of systemPaths) {
    if (fs.existsSync(sysPath)) {
      foundPath = sysPath;
      console.log(`✅ Found system Chrome at: ${foundPath}`);
      break;
    }
  }
}

if (!foundPath) {
  console.error('❌ Could not find Chrome installation anywhere!');
  process.exit(1);
}

// ==========================================================================
// STEP 6: SET EXECUTABLE PERMISSIONS (CRITICAL FIX FOR EACCES ERROR)
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 6: Setting executable permissions');
console.log('-'.repeat(40));

try {
  // Make Chrome executable
  fs.chmodSync(foundPath, 0o755);
  console.log(`✅ Set executable permissions (755) for: ${foundPath}`);
  
  // Also set permissions for the containing directory if needed
  const chromeDir = path.dirname(foundPath);
  fs.chmodSync(chromeDir, 0o755);
  console.log(`✅ Set directory permissions for: ${chromeDir}`);
  
} catch (error) {
  console.error('❌ Failed to set permissions:', error.message);
  process.exit(1);
}

// ==========================================================================
// STEP 7: VERIFY CHROME WORKS
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 7: Testing Chrome execution');
console.log('-'.repeat(40));

try {
  const versionOutput = execSync(`"${foundPath}" --version`, { 
    encoding: 'utf8',
    timeout: 10000
  }).trim();
  
  console.log(`✅ Chrome version: ${versionOutput}`);
  
  // Extract version number for logging
  const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+\.\d+)/);
  if (versionMatch) {
    foundVersion = versionMatch[1];
    console.log(`✅ Chrome version number: ${foundVersion}`);
  }
} catch (error) {
  console.error('❌ Chrome test failed:', error.message);
  console.log('⚠️ Continuing despite test failure - may have display issues');
}

// ==========================================================================
// STEP 8: CREATE SYMLINK FOR CONSISTENT PATH (OPTIONAL)
// ==========================================================================
if (isRender && foundPath) {
  console.log('\n' + '-'.repeat(40));
  console.log('STEP 8: Creating symlink for consistent path');
  console.log('-'.repeat(40));
  
  const symlinkPath = '/opt/render/.cache/puppeteer/chrome-latest';
  try {
    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }
    fs.symlinkSync(foundPath, symlinkPath);
    console.log(`✅ Created symlink: ${symlinkPath} -> ${foundPath}`);
  } catch (error) {
    console.log('⚠️ Could not create symlink:', error.message);
  }
}

// ==========================================================================
// STEP 9: SETUP COMPLETE - EXPORT PATH FOR FUTURE USE
// ==========================================================================
console.log('\n' + '-'.repeat(40));
console.log('STEP 9: Setup complete');
console.log('-'.repeat(40));

// Create a marker file to indicate successful installation
const markerFile = path.join(CACHE_DIR, '.installed');
try {
  fs.writeFileSync(markerFile, JSON.stringify({
    installedAt: new Date().toISOString(),
    path: foundPath,
    version: foundVersion,
    platform: process.platform
  }, null, 2));
  console.log(`✅ Created installation marker: ${markerFile}`);
} catch (error) {
  console.log('⚠️ Could not create marker file:', error.message);
}

// ==========================================================================
// FINAL SUMMARY
// ==========================================================================
console.log('\n' + '='.repeat(80));
console.log('✅ CHROME INSTALLATION COMPLETED SUCCESSFULLY');
console.log('='.repeat(80));
console.log(`📍 Chrome path: ${foundPath}`);
console.log(`📦 Chrome version: ${foundVersion || 'unknown'}`);
console.log(`📂 Cache directory: ${CACHE_DIR}`);
console.log(`💻 Platform: ${process.platform}`);
console.log(`🌎 Environment: ${isRender ? 'Render' : 'Local'}`);
console.log('\n🔧 For your application:');
console.log(`   Set PUPPETEER_EXECUTABLE_PATH=${foundPath}`);
console.log('   or let Puppeteer auto-detect');
console.log('\n' + '='.repeat(80));