import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import LinkedInScraper, { ScrapeResult, LinkedInProfileData } from '@/lib/puppeteer-scraper';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
// 🔍 RENDER-SPECIFIC CHROME FINDER
// ==========================================================================
async function findChromeOnRender(): Promise<string | null> {
  console.log('\n🔍 Looking for Chrome on Render...');
  
  const isRender = !!process.env.RENDER;
  console.log(`🌎 Environment: ${isRender ? 'Render' : 'Local'}`);
  console.log(`💻 Platform: ${process.platform}`);

  // Priority paths for Render
  const pathsToCheck = [
    // Render cache directory (where our install script puts Chrome)
    '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
    '/opt/render/.cache/puppeteer/chrome',
    
    // System Chrome locations
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    
    // Fallback paths
    '/app/.apt/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];

  // First, check the Render cache directory thoroughly
  const chromeCacheDir = '/opt/render/.cache/puppeteer/chrome';
  if (fs.existsSync(chromeCacheDir)) {
    console.log(`📂 Found chrome cache directory: ${chromeCacheDir}`);
    
    try {
      const versions = fs.readdirSync(chromeCacheDir);
      console.log(`📂 Found Chrome versions: ${versions.join(', ')}`);
      
      for (const version of versions) {
        const chromePath = path.join(chromeCacheDir, version, 'chrome-linux64', 'chrome');
        console.log(`🔍 Checking: ${chromePath}`);
        
        if (fs.existsSync(chromePath)) {
          console.log(`✅ Found Chrome at: ${chromePath}`);
          
          // Make sure it's executable
          try {
            fs.chmodSync(chromePath, 0o755);
            console.log('✅ Chrome is executable');
          } catch (e) {
            console.log('⚠️ Could not modify permissions, but continuing');
          }
          
          // Verify it works
          try {
            const version = execSync(`"${chromePath}" --version`, { encoding: 'utf8' });
            console.log(`✅ Chrome version: ${version.trim()}`);
          } catch (e) {
            console.log('⚠️ Could not verify Chrome version');
          }
          
          return chromePath;
        }
      }
    } catch (error) {
      console.error('❌ Error scanning chrome directory:', error);
    }
  } else {
    console.log('❌ Chrome cache directory not found');
  }

  // Check each path pattern
  for (const pattern of pathsToCheck) {
    if (pattern.includes('*')) {
      const basePath = pattern.split('*')[0];
      const parentDir = path.dirname(basePath);
      
      try {
        if (fs.existsSync(parentDir)) {
          const files = fs.readdirSync(parentDir);
          const matchingDir = files.find(f => f.startsWith('linux-'));
          
          if (matchingDir) {
            const fullPath = path.join(parentDir, matchingDir, 'chrome-linux64', 'chrome');
            if (fs.existsSync(fullPath)) {
              console.log(`✅ Found Chrome at: ${fullPath}`);
              return fullPath;
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual paths
      }
    } else {
      if (fs.existsSync(pattern)) {
        console.log(`✅ Found Chrome at: ${pattern}`);
        return pattern;
      }
    }
  }

  console.log('❌ Chrome not found in any location');
  return null;
}

// ==========================================================================
// 🔧 ENSURE CHROME IS INSTALLED (RENDER-OPTIMIZED)
// ==========================================================================
async function ensureChromeInstalled(): Promise<string | null> {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 CHROME INSTALLATION CHECK');
  console.log('='.repeat(60));

  // First try to find existing Chrome
  let chromePath = await findChromeOnRender();
  
  if (chromePath) {
    console.log(`\n✅ Using Chrome at: ${chromePath}`);
    return chromePath;
  }

  // If on Render and Chrome not found, try to install it now
  if (process.env.RENDER) {
    console.log('\n⚠️ Chrome not found, attempting to install now...');
    
    const cacheDir = '/opt/render/.cache/puppeteer';
    
    try {
      // Create cache directory
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
        console.log(`✅ Created cache directory: ${cacheDir}`);
      }

      // Set environment variables
      process.env.PUPPETEER_CACHE_DIR = cacheDir;
      process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';

      // Download Chrome
      console.log('\n📥 Downloading Chrome...');
      execSync('npx puppeteer browsers install chrome', {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: cacheDir,
          PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
        },
        timeout: 300000 // 5 minutes
      });

      console.log('\n✅ Chrome download completed');
      
      // Search again after download
      chromePath = await findChromeOnRender();
      
      if (chromePath) {
        return chromePath;
      }
    } catch (error: any) {
      console.error('❌ Failed to install Chrome:', error.message);
    }
  }

  // Final attempt: Let Puppeteer try to find it automatically
  console.log('\n⚠️ Using Puppeteer default Chrome discovery');
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

// Increase timeout for Render
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
        { success: false, error: 'Valid LinkedIn URL required (must contain linkedin.com)' },
        { status: 400 }
      );
    }

    console.log(`🔗 URL: ${url}`);
    console.log(`🎯 Max Profiles: ${maxLikes}`);
    console.log(`📊 Format: ${format}`);

    // ✅ STEP 1: Ensure Chrome is installed
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 1: Chrome Installation Check');
    console.log('-'.repeat(40));
    
    const chromePath = await ensureChromeInstalled();
    
    if (!chromePath) {
      const errorMessage = `Chrome browser not found. Please check your deployment configuration.`;
      console.error('❌', errorMessage);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Chrome browser not found. Please check your deployment configuration.',
          solution: 'Make sure your package.json has "postinstall": "puppeteer browsers install chrome"',
          environment: {
            render: !!process.env.RENDER,
            platform: process.platform
          }
        },
        { status: 503 }
      );
    }
    
    // Set environment variable for Puppeteer
    process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
    console.log(`✅ Chrome path set to: ${chromePath}`);

    // ✅ STEP 2: Get cookies
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 2: Cookie Retrieval');
    console.log('-'.repeat(40));
    
    const cookies = await getLinkedInCookie();
    if (!cookies) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active LinkedIn cookies found. Please add a valid li_at cookie to the database.',
          instructions: 'Go to /cookies page to add your LinkedIn li_at cookie.'
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
            chrome_path: chromePath,
            cookie_valid: !!cookies,
            platform: process.platform,
            is_render: !!process.env.RENDER
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
          error: 'No profiles found to scrape. This could mean: 1) The post has no likes, 2) The like modal couldn\'t be opened, or 3) LinkedIn blocked the request',
          duration: `${totalTime} seconds`
        },
        { status: 404 }
      );
    }

    // ✅ STEP 5: Format data
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 5: Formatting Results');
    console.log('-'.repeat(40));
    
    const formattedData = {
      likes: result.data.likes.map(l => ({
        name: l.name && l.name !== 'Not specified' ? l.name : 'LinkedIn Member',
        profileUrl: l.profileUrl || '',
        jobTitle: l.jobTitle && l.jobTitle !== 'Not specified' ? l.jobTitle : 'Not specified',
        company: l.company && l.company !== 'Not specified' ? l.company : 'Not specified'
      })),
      posts: result.data.posts || []
    };

    // Remove duplicates based on profile URL
    const uniqueLikes = Array.from(
      new Map(formattedData.likes.map(item => [item.profileUrl, item])).values()
    );
    formattedData.likes = uniqueLikes;

    console.log(`📊 Final data: ${formattedData.likes.length} unique profiles`);

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
    console.log('\n✅ Request completed successfully');
    return NextResponse.json({
      success: true,
      data: formattedData,
      message: 'LinkedIn scraping completed successfully!',
      timestamp: new Date().toISOString(),
      duration: `${totalTime} seconds`,
      statistics: {
        total_profiles: formattedData.likes.length,
        total_posts: formattedData.posts.length
      },
      sample: formattedData.likes.slice(0, 3)
    });

  } catch (error: any) {
    console.error('\n❌ API ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Clean up
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
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// ==========================================================================
// 📊 GET ENDPOINT FOR STATUS CHECKS
// ==========================================================================
export async function GET() {
  console.log('\n📊 Status check requested');
  
  const chromePath = await findChromeOnRender();
  const isRender = !!process.env.RENDER;
  
  return NextResponse.json({
    success: true,
    message: 'LinkedIn Scraper API - Render Optimized',
    version: '2.0.0',
    status: {
      chrome: {
        installed: !!chromePath,
        path: chromePath || 'Not found',
        cache_dir: process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer'
      },
      scraper: {
        active: activeScraper ? 'Running' : 'Not running',
        initialized: activeScraper?.getBrowserStatus().isInitialized || false
      },
      environment: {
        render: isRender,
        platform: process.platform,
        node_version: process.version,
        node_env: process.env.NODE_ENV
      }
    },
    features: [
      '✅ Render-optimized Chrome installation',
      '✅ Automatic Chrome path detection',
      '✅ Detailed logging for debugging',
      '✅ CSV export with 4 columns',
      '✅ Deduplicated results'
    ],
    endpoints: {
      POST: '/api/analyze - Start scraping (requires JSON body with url, maxLikes, format)',
      GET: '/api/analyze - This status message'
    },
    example_request: {
      url: 'https://www.linkedin.com/in/some-profile/',
      maxLikes: 20,
      format: 'json' // or 'csv'
    }
  });
}

// ==========================================================================
// 🧹 CLEANUP ON PROCESS TERMINATION
// ==========================================================================
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

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});