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
// 🔍 CHECK IF CHROME IS INSTALLED AND GET ITS PATH (ENHANCED)
// ==========================================================================
async function ensureChromeInstalled(): Promise<string | null> {
  console.log('🔍 Checking Chrome installation...');
  
  // Log environment for debugging
  console.log('📂 Current working directory:', process.cwd());
  console.log('📂 Node modules path:', path.join(process.cwd(), 'node_modules'));
  
  // Possible Chrome paths (in order of preference)
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
    '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
    path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer', 'chrome', 'linux-*', 'chrome-linux64', 'chrome'),
    path.join('/opt/render/project/src', 'node_modules', '.cache', 'puppeteer', 'chrome', 'linux-*', 'chrome-linux64', 'chrome')
  ];

  // Check each path
  for (const pattern of possiblePaths) {
    if (!pattern) continue;
    
    // Handle wildcards
    if (pattern.includes('*')) {
      const basePath = pattern.split('*')[0];
      const parentDir = path.dirname(basePath);
      
      try {
        if (fs.existsSync(parentDir)) {
          const files = fs.readdirSync(parentDir);
          const matchingDir = files.find(f => f.startsWith('linux-'));
          if (matchingDir) {
            const fullPath = pattern.replace('*', matchingDir);
            if (fs.existsSync(fullPath)) {
              console.log(`✅ Chrome found at: ${fullPath}`);
              // Make it executable
              try {
                fs.chmodSync(fullPath, 0o755);
              } catch (e) {}
              return fullPath;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking path ${pattern}:`, error);
      }
    } else {
      if (fs.existsSync(pattern)) {
        console.log(`✅ Chrome found at: ${pattern}`);
        return pattern;
      }
    }
  }

  console.log('❌ Chrome not found in any expected location');
  
  // Try to download Chrome on Render
  if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    console.log('📥 Attempting to download Chrome...');
    
    // Create cache directory
    const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Set environment variable for cache directory
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';
    
    try {
      // Try multiple download methods
      const downloadCommands = [
        'npx puppeteer browsers install chrome',
        'node node_modules/puppeteer/install.mjs',
        'npm run postinstall'
      ];
      
      for (const cmd of downloadCommands) {
        try {
          console.log(`🔄 Trying: ${cmd}`);
          execSync(cmd, { 
            stdio: 'inherit',
            env: { 
              ...process.env, 
              PUPPETEER_CACHE_DIR: cacheDir,
              PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
            },
            timeout: 120000 // 2 minute timeout
          });
          console.log(`✅ Command succeeded: ${cmd}`);
          break;
        } catch (e) {
          console.log(`⚠️ Command failed: ${cmd}`);
        }
      }
      
      console.log('✅ Chrome download attempted');
      
      // Check again after download
      return await ensureChromeInstalled();
    } catch (downloadError) {
      console.error('❌ Failed to download Chrome:', downloadError);
      return null;
    }
  }
  
  return null;
}

// Function to get LinkedIn cookie from database
async function getLinkedInCookie(): Promise<LinkedInProfileData | null> {
  try {
    console.log('🔍 Fetching LinkedIn cookie from database...');

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

    return data as LinkedInProfileData;
  } catch (error: any) {
    console.error('❌ Error in getLinkedInCookie:', error.message);
    return null;
  }
}

// Increase timeout for Render
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let scraper: LinkedInScraper | null = null;

  console.log('\n' + '='.repeat(80));
  console.log('📥 RECEIVED SCRAPING REQUEST');
  console.log('='.repeat(80));

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

    // ✅ STEP 1: Ensure Chrome is installed
    console.log('\n🔍 Step 1: Checking Chrome installation...');
    const chromePath = await ensureChromeInstalled();
    
    if (!chromePath) {
      // Provide helpful instructions
      const errorMessage = `Chrome browser not found and could not be installed. 
        Please ensure your package.json has "postinstall": "puppeteer browsers install chrome" 
        and redeploy. If issue persists, check Render build logs.`;
      
      console.error('❌', errorMessage);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Chrome browser not found and could not be installed. Please check your deployment configuration.',
          solution: 'Add "postinstall": "puppeteer browsers install chrome" to package.json scripts',
          docs: 'https://pptr.dev/guides/configuration'
        },
        { status: 503 }
      );
    }
    
    // Set environment variable for Puppeteer
    process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
    console.log(`✅ Chrome path set to: ${chromePath}`);

    // ✅ STEP 2: Get cookies
    console.log('\n🔍 Step 2: Getting LinkedIn cookies...');
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
    console.log(`✅ Using cookies for: ${cookies.name || 'LinkedIn User'}`);

    // ✅ STEP 3: Initialize scraper
    console.log('\n🚀 Step 3: Initializing scraper...');
    scraper = new LinkedInScraper();
    activeScraper = scraper;

    try {
      console.log('\n🖥️ Launching browser...');
      const startInit = Date.now();
      await scraper.initialize(cookies, url);
      console.log(`✅ Browser initialized in ${Math.round((Date.now() - startInit)/1000)}s`);
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
            cookie_valid: !!cookies
          }
        },
        { status: 500 }
      );
    }

    // ✅ STEP 4: Perform scraping
    console.log('\n🎯 Step 4: Starting scraping...');
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
    console.log(`\n⏱️ Scraping time: ${totalTime} seconds`);

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

    // Format data
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

export async function GET() {
  const chromePath = await ensureChromeInstalled();
  
  return NextResponse.json({
    success: true,
    message: 'LinkedIn Scraper API',
    version: '1.0.0',
    chrome: {
      installed: !!chromePath,
      path: chromePath || 'Not found',
      cache_dir: process.env.PUPPETEER_CACHE_DIR || '/home/sbx_user1051/.cache/puppeteer'
    },
    environment: {
      render: !!process.env.RENDER,
      node_env: process.env.NODE_ENV
    }
  });
}

// Cleanup on process termination
process.on('SIGTERM', async () => { 
  console.log('SIGTERM received, cleaning up...');
  if (activeScraper) {
    await activeScraper.close();
    activeScraper = null;
  }
});

process.on('SIGINT', async () => { 
  console.log('SIGINT received, cleaning up...');
  if (activeScraper) {
    await activeScraper.close();
    activeScraper = null;
  }
});