import { createClient, SupabaseClient } from '@supabase/supabase-js';
import LinkedInScraper, { LinkedInProfileData, ScrapeResult } from './lib/puppeteer-scraper';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Types for database tables
interface ScrapingJob {
  id: string;
  profile_url: string;
  max_likes: number;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  user_id?: string;
  result?: ScrapeResult;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface CookieData {
  id: string;
  li_at: string;
  name?: string;
  email?: string;
  is_active: boolean;
  updated_at: string;
  last_used?: string;
}

// Initialize Supabase with environment variables
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ==========================================================================
// 🛡️ Helper function to safely get error message
// ==========================================================================
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ==========================================================================
// 🔍 CHROME PATH FINDER FOR WORKER
// ==========================================================================
async function findChromePath(): Promise<string | null> {
  console.log('\n🔍 Worker: Looking for Chrome...');
  
  const platform = process.platform;
  const isRender = !!process.env.RENDER;

  // Windows
  if (platform === 'win32' && !isRender) {
    const windowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`] : []),
    ];
    
    for (const winPath of windowsPaths) {
      if (fs.existsSync(winPath)) {
        console.log(`✅ Worker found Chrome at: ${winPath}`);
        return winPath;
      }
    }
  }
  
  // Linux/Render
  if (platform === 'linux' || isRender) {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/app/.apt/usr/bin/google-chrome',
    ];
    
    // Check common Linux paths
    for (const linuxPath of linuxPaths) {
      if (fs.existsSync(linuxPath)) {
        console.log(`✅ Worker found Chrome at: ${linuxPath}`);
        return linuxPath;
      }
    }
    
    // Check puppeteer cache on Render
    const chromeCacheDir = '/opt/render/.cache/puppeteer/chrome';
    if (fs.existsSync(chromeCacheDir)) {
      try {
        const versions = fs.readdirSync(chromeCacheDir);
        for (const version of versions) {
          const chromePath = path.join(chromeCacheDir, version, 'chrome-linux64', 'chrome');
          if (fs.existsSync(chromePath)) {
            console.log(`✅ Worker found Chrome in cache: ${chromePath}`);
            try {
              fs.chmodSync(chromePath, 0o755);
            } catch (e) {}
            return chromePath;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error scanning chrome cache: ${getErrorMessage(error)}`);
      }
    }
  }
  
  // Mac
  if (platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macPath)) {
      console.log(`✅ Worker found Chrome at: ${macPath}`);
      return macPath;
    }
  }

  console.log('⚠️ Worker: Chrome not found, Puppeteer will auto-detect');
  return null;
}

// ==========================================================================
// 📥 DOWNLOAD CHROME IF NEEDED (for Render)
// ==========================================================================
async function ensureChromeAvailable(): Promise<string | null> {
  // First try to find existing Chrome
  let chromePath = await findChromePath();
  
  if (chromePath) {
    return chromePath;
  }

  // If on Render and Chrome not found, try to download
  if (process.env.RENDER) {
    console.log('\n📥 Worker: Chrome not found, attempting to download...');
    
    try {
      const cacheDir = '/opt/render/.cache/puppeteer';
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
      }

      process.env.PUPPETEER_CACHE_DIR = cacheDir;
      process.env.PUPPETEER_SKIP_CHROME_DOWNLOAD = 'false';

      console.log('⏳ Downloading Chrome (this may take a few minutes)...');
      
      execSync('npx puppeteer browsers install chrome', {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: cacheDir,
          PUPPETEER_SKIP_CHROME_DOWNLOAD: 'false'
        },
        timeout: 300000 // 5 minutes
      });

      console.log('✅ Chrome download completed');
      
      // Search again after download
      return await findChromePath();
      
    } catch (error) {
      console.error(`❌ Failed to download Chrome: ${getErrorMessage(error)}`);
      return null;
    }
  }

  return null;
}

// ==========================================================================
// 📊 GET ACTIVE LINKEDIN COOKIE
// ==========================================================================
async function getLinkedInCookie(): Promise<CookieData | null> {
  try {
    console.log('   🔍 Fetching LinkedIn cookie from database...');

    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error(`   ❌ Database error fetching cookie: ${error.message}`);
      return null;
    }

    if (!data) {
      console.error('   ❌ No active LinkedIn cookies found');
      return null;
    }

    if (!data.li_at || !data.li_at.startsWith('AQED')) {
      console.error('   ❌ Invalid li_at cookie format');
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

    console.log(`   ✅ Using cookies for: ${data.name || 'LinkedIn User'}`);
    return data as CookieData;
    
  } catch (error) {
    console.error(`   ❌ Error in getLinkedInCookie: ${getErrorMessage(error)}`);
    return null;
  }
}

// ==========================================================================
// 🔄 PROCESS A SINGLE JOB
// ==========================================================================
async function processJob(job: ScrapingJob): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`📥 PROCESSING JOB: ${job.id}`);
  console.log('='.repeat(60));
  console.log(`🔗 URL: ${job.profile_url}`);
  console.log(`🎯 Max Profiles: ${job.max_likes}`);
  console.log(`📄 Format: ${job.format}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);

  const scraper = new LinkedInScraper();
  let browserClosed = false;

  try {
    // Ensure Chrome is available
    const chromePath = await ensureChromeAvailable();
    if (chromePath) {
      process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
    }

    // Get LinkedIn cookie
    const cookieData = await getLinkedInCookie();
    if (!cookieData) {
      throw new Error('No active LinkedIn cookie available');
    }

    // Convert cookie data to LinkedInProfileData format
    const profileData: LinkedInProfileData = {
      li_at: cookieData.li_at,
      name: cookieData.name,
      email: cookieData.email,
      is_active: cookieData.is_active,
      updated_at: cookieData.updated_at,
      last_used: cookieData.last_used
    };

    // Initialize scraper
    console.log('\n🖥️ Launching browser...');
    const startInit = Date.now();
    await scraper.initialize(profileData, job.profile_url);
    console.log(`   ✅ Browser initialized in ${Math.round((Date.now() - startInit) / 1000)}s`);

    // Wait for page stabilization
    console.log('   ⏳ Waiting for page stabilization...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Perform scraping
    console.log('\n🔍 Starting scraping...');
    const startScrape = Date.now();
    const result = await scraper.scrapeProfileActivity(job.profile_url, job.max_likes);
    const scrapeTime = Math.round((Date.now() - startScrape) / 1000);
    console.log(`   ✅ Scraping completed in ${scrapeTime}s`);

    // Close browser
    console.log('\n🔌 Closing browser...');
    await scraper.close();
    browserClosed = true;

    // Update job as completed
    if (result.success) {
      console.log(`\n✅ Job completed successfully!`);
      console.log(`📊 Profiles extracted: ${result.data?.likes?.length || 0}`);

      // Format data
      const formattedData = {
        likes: result.data?.likes?.map(l => ({
          name: l.name && l.name !== 'Not specified' ? l.name : 'LinkedIn Member',
          profileUrl: l.profileUrl || '',
          jobTitle: l.jobTitle && l.jobTitle !== 'Not specified' ? l.jobTitle : 'Not specified',
          company: l.company && l.company !== 'Not specified' ? l.company : 'Not specified'
        })) || [],
        posts: result.data?.posts || []
      };

      // Remove duplicates
      const uniqueLikes = Array.from(
        new Map(formattedData.likes.map(item => [item.profileUrl, item])).values()
      );
      formattedData.likes = uniqueLikes;

      await supabase
        .from('scraping_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: {
            success: true,
            data: formattedData,
            message: 'Scraping completed successfully',
            timestamp: new Date().toISOString(),
            statistics: {
              total_profiles: formattedData.likes.length,
              total_posts: formattedData.posts.length
            }
          }
        })
        .eq('id', job.id);

      console.log(`📊 Final data: ${formattedData.likes.length} unique profiles`);

    } else {
      throw new Error(result.error || 'Scraping failed');
    }

  } catch (error: any) {
    console.error('\n❌ Job failed:', error.message);

    // Close browser if still open
    if (!browserClosed) {
      try {
        await scraper.close();
      } catch (closeError) {
        console.error('   Error closing browser:', closeError);
      }
    }

    // Update job as failed
    await supabase
      .from('scraping_queue')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error.message
      })
      .eq('id', job.id);

  } finally {
    console.log('='.repeat(60) + '\n');
  }
}

// ==========================================================================
// 🚀 MAIN WORKER LOOP
// ==========================================================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 BACKGROUND WORKER STARTED');
  console.log('='.repeat(60));
  console.log(`🕐 Time: ${new Date().toISOString()}`);
  console.log(`🌎 Environment: ${process.env.RENDER ? 'Render' : 'Local'}`);
  console.log(`💻 Platform: ${process.platform}`);
  console.log('📦 Waiting for jobs...\n');

  let errorCount = 0;
  const maxErrors = 10;
  let jobsProcessed = 0;

  while (true) {
    try {
      // Check for pending jobs
      const { data: pendingJobs, error } = await supabase
        .from('scraping_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        throw error;
      }

      if (pendingJobs && pendingJobs.length > 0) {
        // Reset error count on successful job fetch
        errorCount = 0;
        jobsProcessed++;
        
        const job = pendingJobs[0] as ScrapingJob;

        // Mark job as processing
        await supabase
          .from('scraping_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Process the job
        await processJob(job);

      } else {
        // No jobs, show heartbeat
        if (jobsProcessed === 0) {
          process.stdout.write('.');
        } else {
          process.stdout.write('💤');
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error: any) {
      errorCount++;
      console.error(`\n❌ Worker error (${errorCount}/${maxErrors}):`, error.message);

      if (errorCount >= maxErrors) {
        console.error('\n❌ Too many errors, worker stopping...');
        process.exit(1);
      }

      // Wait longer after errors
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// ==========================================================================
// 🛑 GRACEFUL SHUTDOWN
// ==========================================================================
process.on('SIGTERM', () => {
  console.log('\n🔴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🔴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the worker
main().catch(error => {
  console.error('❌ Fatal worker error:', error);
  process.exit(1);
});