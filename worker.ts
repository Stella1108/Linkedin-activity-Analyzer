// worker.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import LinkedInScraper, { LinkedInProfileData, ScrapeResult } from './lib/puppeteer-scraper';

// Types for database tables
interface ScrapingJob {
  id: string;
  profile_url: string;
  max_likes: number;
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

console.log('='.repeat(60));
console.log('🚀 BACKGROUND WORKER STARTED');
console.log('='.repeat(60));
console.log(`🕐 Time: ${new Date().toISOString()}`);
console.log('📦 Waiting for jobs...\n');

// Helper function for delays
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Get active LinkedIn cookie
async function getLinkedInCookie(): Promise<CookieData | null> {
  try {
    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Database error fetching cookie:', error.message);
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
    return data as CookieData;
  } catch (error) {
    console.error('❌ Error in getLinkedInCookie:', error);
    return null;
  }
}

// Process a single job
async function processJob(job: ScrapingJob): Promise<void> {
  console.log('\n' + '-'.repeat(40));
  console.log(`📥 PROCESSING JOB: ${job.id}`);
  console.log('-'.repeat(40));
  console.log(`🔗 URL: ${job.profile_url}`);
  console.log(`🎯 Max Profiles: ${job.max_likes}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);

  const scraper = new LinkedInScraper();
  let browserClosed = false;

  try {
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
    console.log(`✅ Browser initialized in ${Math.round((Date.now() - startInit) / 1000)}s`);

    // Wait for page stabilization
    console.log('⏳ Waiting for page stabilization...');
    await delay(5000);

    // Perform scraping
    console.log('\n🔍 Starting scraping...');
    const startScrape = Date.now();
    const result = await scraper.scrapeProfileActivity(job.profile_url, job.max_likes);
    const scrapeTime = Math.round((Date.now() - startScrape) / 1000);
    console.log(`✅ Scraping completed in ${scrapeTime}s`);

    // Close browser
    console.log('\n🔌 Closing browser...');
    await scraper.close();
    browserClosed = true;

    // Update job as completed
    if (result.success) {
      console.log(`\n✅ Job completed successfully!`);
      console.log(`📊 Profiles extracted: ${result.data?.likes?.length || 0}`);

      await supabase
        .from('scraping_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: result
        })
        .eq('id', job.id);

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
        console.error('Error closing browser:', closeError);
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
    console.log('-'.repeat(40) + '\n');
  }
}

// Main worker loop
async function main() {
  let errorCount = 0;
  const maxErrors = 10;

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
        // No jobs, wait 5 seconds
        process.stdout.write('.');
        await delay(5000);
      }

    } catch (error: any) {
      errorCount++;
      console.error(`\n❌ Worker error (${errorCount}/${maxErrors}):`, error.message);

      if (errorCount >= maxErrors) {
        console.error('\n❌ Too many errors, worker stopping...');
        process.exit(1);
      }

      // Wait longer after errors
      await delay(30000);
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🔴 SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🔴 SIGINT received, shutting down...');
  process.exit(0);
});

// Start the worker
main().catch(error => {
  console.error('❌ Fatal worker error:', error);
  process.exit(1);
});