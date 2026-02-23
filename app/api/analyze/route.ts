import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import LinkedInScraper, { ScrapeResult, LinkedInProfileData } from '@/lib/puppeteer-scraper';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Global variable to track running scraper
let activeScraper: LinkedInScraper | null = null;

// ==========================================================================
// 🛡️ SAFE CSV CONVERSION
// ==========================================================================
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  const headers = ['Name', 'Company', 'Job Title', 'Profile URL'];
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const escape = (str: string) => {
      if (!str) return '""';
      return `"${String(str).replace(/"/g, '""')}"`;
    };
    const values = [
      escape(row.name || ''),
      escape(row.company || 'Not specified'),
      escape(row.jobTitle || 'Not specified'),
      escape(row.profileUrl || '')
    ];
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

// ==========================================================================
// 🔍 CROSS-PLATFORM CHROME FINDER (Works on Windows, Mac, Linux, Render)
// ==========================================================================
async function findChromePath(): Promise<string | null> {
  console.log('\n🔍 Looking for Chrome...');
  console.log(`🌎 Environment: ${process.env.RENDER ? 'Render' : 'Local'}`);
  console.log(`💻 Platform: ${process.platform}`);
  console.log(`📂 Current directory: ${process.cwd()}`);

  const platform = process.platform;
  const isRender = !!process.env.RENDER;

  // Platform-specific paths
  const paths: { [key: string]: string[] } = {
    win32: [
      // Standard installation paths
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // User-specific paths
      ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`] : []),
      ...(process.env.ProgramFiles ? [`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`] : []),
      ...(process.env['ProgramFiles(x86)'] ? [`${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`] : []),
      // Puppeteer cache
      path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer', 'chrome', 'win64-*', 'chrome-win64', 'chrome.exe'),
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(process.env.HOME || '', 'Library/Caches/puppeteer/chrome'),
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ]
  };

  // Add Render-specific paths
  if (isRender) {
    paths.linux.push(
      '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
      '/opt/render/.cache/puppeteer/chrome',
      '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
      '/app/.apt/usr/bin/google-chrome'
    );
  }

  // Get paths for current platform
  const possiblePaths = paths[platform] || paths.linux;

  // First, check if Chrome is in PATH (for local development)
  if (!isRender) {
    try {
      const whichCommand = platform === 'win32' ? 'where chrome' : 'which google-chrome';
      const whichResult = execSync(whichCommand, { encoding: 'utf8' }).trim().split('\n')[0];
      if (whichResult && fs.existsSync(whichResult)) {
        console.log(`✅ Found Chrome in PATH: ${whichResult}`);
        return whichResult;
      }
    } catch (error) {
      console.log('ℹ️ Chrome not found in PATH, checking specific paths...');
    }
  }

  // Check each path pattern
  for (const pattern of possiblePaths) {
    if (!pattern) continue;
    
    try {
      // Handle wildcards (*) for version-specific directories
      if (pattern.includes('*')) {
        const basePath = pattern.split('*')[0];
        const parentDir = path.dirname(basePath);
        
        if (fs.existsSync(parentDir)) {
          const files = fs.readdirSync(parentDir);
          // Find matching directory based on platform
          let matchingDir: string | undefined;
          
          if (platform === 'win32') {
            matchingDir = files.find(f => f.includes('win64'));
          } else if (platform === 'darwin') {
            matchingDir = files.find(f => f.includes('mac'));
          } else {
            matchingDir = files.find(f => f.includes('linux'));
          }
          
          if (matchingDir) {
            const fullPath = pattern.replace('*', matchingDir);
            if (fs.existsSync(fullPath)) {
              console.log(`✅ Found Chrome at: ${fullPath}`);
              
              // Make executable on Unix-like systems
              if (platform !== 'win32') {
                try {
                  fs.chmodSync(fullPath, 0o755);
                } catch (e) {}
              }
              
              return fullPath;
            }
          }
        }
      } else {
        if (fs.existsSync(pattern)) {
          console.log(`✅ Found Chrome at: ${pattern}`);
          return pattern;
        }
      }
    } catch (error) {
      // Ignore errors for individual paths
      continue;
    }
  }

  console.log('❌ Chrome not found in any location');
  return null;
}

// ==========================================================================
// 📥 DOWNLOAD CHROME (Platform specific)
// ==========================================================================
async function downloadChrome(): Promise<boolean> {
  console.log('\n📥 Attempting to download Chrome...');
  
  const isRender = !!process.env.RENDER;
  const platform = process.platform;
  
  // Set cache directory based on platform
  let cacheDir: string;
  
  if (isRender) {
    cacheDir = '/opt/render/.cache/puppeteer';
  } else if (platform === 'win32') {
    cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer');
  } else {
    cacheDir = path.join(os.homedir(), '.cache', 'puppeteer');
  }
  
  console.log(`📂 Cache directory: ${cacheDir}`);

  try {
    // Create cache directory
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
    }

    // Set environment variables
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';

    // Download Chrome
    console.log('⏳ This may take a few minutes...');
    
    const downloadCommand = platform === 'win32' 
      ? 'npx.cmd puppeteer browsers install chrome'
      : 'npx puppeteer browsers install chrome';
    
    execSync(downloadCommand, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir,
        PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
      },
      timeout: 300000 // 5 minutes
    });

    console.log('✅ Chrome download completed');
    return true;
  } catch (error: any) {
    console.error('❌ Failed to download Chrome:', error.message);
    return false;
  }
}

// ==========================================================================
// 🔧 ENSURE CHROME IS AVAILABLE (Cross-platform)
// ==========================================================================
async function ensureChromeAvailable(): Promise<string | null> {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 CHROME AVAILABILITY CHECK');
  console.log('='.repeat(60));

  const isRender = !!process.env.RENDER;
  const platform = process.platform;

  // First try to find existing Chrome
  let chromePath = await findChromePath();
  
  if (chromePath) {
    console.log(`\n✅ Using Chrome at: ${chromePath}`);
    
    // Verify it's executable (non-Windows)
    if (platform !== 'win32') {
      try {
        fs.accessSync(chromePath, fs.constants.X_OK);
      } catch (error) {
        console.log('⚠️ Chrome found but not executable, attempting to fix...');
        try {
          fs.chmodSync(chromePath, 0o755);
        } catch (e) {
          console.log('⚠️ Could not modify permissions');
        }
      }
    }
    
    return chromePath;
  }

  // If not found on Render, try to download
  if (isRender) {
    console.log('\n⚠️ Chrome not found on Render, attempting to download...');
    const downloaded = await downloadChrome();
    
    if (downloaded) {
      // Search again after download
      chromePath = await findChromePath();
      if (chromePath) {
        return chromePath;
      }
    }
  }

  // For local development, provide helpful instructions
  if (!isRender) {
    console.log('\n⚠️ Chrome not found. For local development:');
    
    if (platform === 'win32') {
      console.log('   📌 Option 1: Install Chrome from https://www.google.com/chrome/');
      console.log('   📌 Option 2: Run: npx puppeteer browsers install chrome');
      console.log('\n   💡 Chrome is usually installed at:');
      console.log('      C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    } else if (platform === 'darwin') {
      console.log('   📌 Option 1: Install Chrome from https://www.google.com/chrome/');
      console.log('   📌 Option 2: Run: npx puppeteer browsers install chrome');
      console.log('\n   💡 Chrome is usually installed at:');
      console.log('      /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    } else {
      console.log('   📌 Run: sudo apt-get install google-chrome-stable');
      console.log('   📌 Or run: npx puppeteer browsers install chrome');
    }
    
    // For local dev, let Puppeteer auto-detect
    console.log('\n⚠️ Proceeding with Puppeteer auto-detection...');
    return null;
  }

  console.log('\n❌ Chrome could not be found or installed');
  return null;
}

// ==========================================================================
// 📊 GET LINKEDIN COOKIE FROM DATABASE
// ==========================================================================
async function getLinkedInCookie(): Promise<LinkedInProfileData | null> {
  try {
    console.log('\n🔍 Fetching LinkedIn cookie from database...');

    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Database error:', error.message);
      return null;
    }

    if (!data) {
      console.error('❌ No active LinkedIn cookies found');
      return null;
    }

    if (!data.li_at || !data.li_at.startsWith('AQED')) {
      console.error('❌ Invalid li_at cookie format');
      return null;
    }

    // Update last used timestamp
    await supabase
      .from('linkedin_profile_data')
      .update({
        updated_at: new Date().toISOString(),
        last_used: new Date().toISOString()
      })
      .eq('id', data.id);

    console.log(`✅ Using cookies for: ${data.name || 'LinkedIn User'}`);
    return data as LinkedInProfileData;
  } catch (error: any) {
    console.error('❌ Error in getLinkedInCookie:', error.message);
    return null;
  }
}

// Increase timeout for serverless
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ==========================================================================
// 📥 MAIN POST HANDLER
// ==========================================================================
export async function POST(request: NextRequest) {
  let scraper: LinkedInScraper | null = null;

  console.log('\n' + '='.repeat(80));
  console.log('📥 RECEIVED SCRAPING REQUEST');
  console.log('='.repeat(80));
  console.log(`🕐 Time: ${new Date().toISOString()}`);

  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { url, keepOpen = false, maxLikes = 20, format = 'json' } = body;

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'LinkedIn URL is required' },
        { status: 400 }
      );
    }

    if (!url.includes('linkedin.com')) {
      return NextResponse.json(
        { success: false, error: 'Valid LinkedIn URL required' },
        { status: 400 }
      );
    }

    console.log(`🔗 URL: ${url}`);
    console.log(`🎯 Max Profiles: ${maxLikes}`);

    // ✅ STEP 1: Ensure Chrome is available
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 1: Chrome Availability Check');
    console.log('-'.repeat(40));
    
    const chromePath = await ensureChromeAvailable();
    
    if (chromePath) {
      process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
      console.log(`✅ Chrome path set to: ${chromePath}`);
    } else {
      console.log('⚠️ No Chrome path specified, Puppeteer will auto-detect');
    }

    // ✅ STEP 2: Get cookies
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 2: Cookie Retrieval');
    console.log('-'.repeat(40));
    
    const cookies = await getLinkedInCookie();
    if (!cookies) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active LinkedIn cookies found. Please add a valid li_at cookie to the database.'
        },
        { status: 503 }
      );
    }

    // ✅ STEP 3: Initialize scraper
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 3: Scraper Initialization');
    console.log('-'.repeat(40));
    
    scraper = new LinkedInScraper();
    activeScraper = scraper;

    try {
      console.log('🖥️ Launching browser...');
      const startInit = Date.now();
      await scraper.initialize(cookies, url);
      console.log(`✅ Browser initialized in ${Math.round((Date.now() - startInit)/1000)}s`);
      console.log('⏳ Waiting 2 seconds for page stabilization...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (initError: any) {
      console.error('❌ Failed to initialize:', initError.message);
      
      if (scraper) {
        await scraper.close();
        activeScraper = null;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Browser initialization failed: ${initError.message}`,
          details: {
            platform: process.platform,
            chrome_path: chromePath || 'auto-detected'
          }
        },
        { status: 500 }
      );
    }

    // ✅ STEP 4: Perform scraping
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 4: Scraping Profile Activity');
    console.log('-'.repeat(40));
    
    let result: ScrapeResult;
    const startTime = Date.now();

    try {
      result = await scraper.scrapeProfileActivity(url, maxLikes);
    } catch (scrapeError: any) {
      console.error('❌ Scraping error:', scrapeError.message);
      result = {
        success: false,
        error: scrapeError.message,
        data: {
          likes: [],
          comments: [],
          profileUrl: url,
          scrapedAt: new Date().toISOString(),
          posts: []
        }
      };
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n⏱️ Scraping completed in ${totalTime} seconds`);

    // Close browser if not keeping open
    if (!keepOpen || !result.success) {
      console.log('\n🔌 Closing browser...');
      if (scraper) {
        await scraper.close();
        activeScraper = null;
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Unknown scraping error',
          duration: `${totalTime} seconds` 
        },
        { status: 500 }
      );
    }

    // Check if we have any data
    if (!result.data || !result.data.likes || result.data.likes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No profiles found to scrape',
          duration: `${totalTime} seconds`
        },
        { status: 404 }
      );
    }

    // ✅ STEP 5: Format data
    const formattedData = {
      likes: result.data.likes.map(l => ({
        name: l.name && l.name !== 'Not specified' ? l.name : 'LinkedIn Member',
        profileUrl: l.profileUrl || '',
        jobTitle: l.jobTitle && l.jobTitle !== 'Not specified' ? l.jobTitle : 'Not specified',
        company: l.company && l.company !== 'Not specified' ? l.company : 'Not specified'
      })),
      posts: result.data.posts || []
    };

    // Remove duplicates
    const uniqueLikes = Array.from(
      new Map(formattedData.likes.map(item => [item.profileUrl, item])).values()
    );
    formattedData.likes = uniqueLikes;

    console.log(`\n📊 Final data: ${formattedData.likes.length} unique profiles`);

    // Return CSV if requested
    if (format === 'csv') {
      const csvData = convertToCSV(formattedData.likes);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="linkedin-profiles-${Date.now()}.csv"`,
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: formattedData,
      message: 'LinkedIn scraping completed successfully!',
      timestamp: new Date().toISOString(),
      duration: `${totalTime} seconds`,
      statistics: {
        total_profiles: formattedData.likes.length,
        total_posts: formattedData.posts.length
      }
    });

  } catch (error: any) {
    console.error('\n❌ API ERROR:', error.message);
    
    if (scraper) {
      try {
        await scraper.close();
      } catch (closeError) {
        console.error('Error closing scraper:', closeError);
      }
      activeScraper = null;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// ==========================================================================
// 📊 GET ENDPOINT FOR STATUS CHECKS
// ==========================================================================
export async function GET() {
  const chromePath = await findChromePath();
  const isRender = !!process.env.RENDER;
  
  return NextResponse.json({
    success: true,
    message: 'LinkedIn Scraper API - Cross Platform',
    version: '3.0.0',
    chrome: {
      installed: !!chromePath,
      path: chromePath || 'Not found (Puppeteer will auto-detect)',
      platform: process.platform
    },
    environment: {
      render: isRender,
      platform: process.platform,
      node_version: process.version,
      node_env: process.env.NODE_ENV
    },
    instructions: {
      local: 'For local development, ensure Chrome is installed or run: npx puppeteer browsers install chrome',
      render: 'On Render, Chrome is installed during build via postinstall script'
    }
  });
}

// Cleanup on process termination
process.on('SIGTERM', async () => { 
  console.log('\n🔴 SIGTERM received, cleaning up...');
  if (activeScraper) {
    await activeScraper.close();
    activeScraper = null;
  }
});

process.on('SIGINT', async () => { 
  console.log('\n🔴 SIGINT received, cleaning up...');
  if (activeScraper) {
    await activeScraper.close();
    activeScraper = null;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});