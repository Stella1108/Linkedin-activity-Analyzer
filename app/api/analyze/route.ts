import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import LinkedInScraper, { ScrapeResult, LinkedInProfileData } from '@/lib/puppeteer-scraper';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Global variable to track running scraper
let activeScraper: LinkedInScraper | null = null;

// ==========================================================================
// 🛡️ SAFE CSV CONVERSION - EXACT 4 COLUMNS IN CORRECT ORDER
// ==========================================================================
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';

  const headers = ['Name', 'Company', 'Job Title', 'Profile URL'];
  const csvRows = [];
  csvRows.push(headers.join(','));

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
      .maybeSingle(); // Changed from .single() to .maybeSingle() to avoid error when no results

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

// Increase timeout for Vercel
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let scraper: LinkedInScraper | null = null;

  console.log('\n' + '='.repeat(80));
  console.log('📥 RECEIVED SCRAPING REQUEST');
  console.log('='.repeat(80));

  try {
    // Parse request body with error handling
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

    // Get cookies
    console.log('\n🔍 Step 1: Getting LinkedIn cookies...');
    const cookies = await getLinkedInCookie();
    if (!cookies) {
      return NextResponse.json(
        { success: false, error: 'No active LinkedIn cookies found. Please add a valid li_at cookie to the database.' },
        { status: 503 }
      );
    }
    console.log(`✅ Using cookies for: ${cookies.name || 'LinkedIn User'}`);

    // Initialize scraper
    console.log('\n🚀 Step 2: Initializing scraper...');
    scraper = new LinkedInScraper();
    activeScraper = scraper;

    try {
      console.log('\n🖥️ Launching browser...');
      const startInit = Date.now();
      await scraper.initialize(cookies, url);
      console.log(`✅ Browser initialized in ${Math.round((Date.now() - startInit)/1000)}s`);
      console.log('⏳ Waiting 2 seconds for page stabilization...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (initError: any) {
      console.error('❌ Failed to initialize:', initError.message);
      
      // Clean up
      if (scraper) {
        await scraper.close();
        activeScraper = null;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Browser initialization failed: ${initError.message}. This could be due to: 
            1. Expired LinkedIn cookie
            2. LinkedIn blocking automated access
            3. Network issues`,
          details: initError.message
        },
        { status: 500 }
      );
    }

    // Perform scraping
    console.log('\n🎯 Step 3: Starting scraping...');
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
      console.error('❌ SCRAPING FAILED:', result.error);
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

    // Format data - ONLY 4 REQUIRED FIELDS with validation
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

    console.log(`\n📊 Final data: ${formattedData.likes.length} unique profiles`);

    // Return CSV if requested
    if (format === 'csv') {
      const csvData = convertToCSV(formattedData.likes);
      
      // Validate CSV data
      if (!csvData || csvData.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate CSV data' },
          { status: 500 }
        );
      }

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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'LinkedIn Scraper API - Correct Job Title & Company Extraction',
    version: '11.0.0',
    activeScraper: activeScraper ? 'Running' : 'Not running',
    endpoints: {
      POST: '/api/linkedin-scraper - Start scraping (requires JSON body with url, maxLikes, format)',
      GET: '/api/linkedin-scraper - This status message'
    },
    features: [
      '✅ Clean names - no "View profile" suffixes',
      '✅ Job titles properly extracted',
      '✅ Companies properly extracted',
      '✅ Handles "Company - Job Title" format correctly',
      '✅ Handles "Job Title - Company" format correctly',
      '✅ Profile URLs cleaned and validated',
      '✅ CSV export with 4 columns: Name, Company, Job Title, Profile URL',
      '✅ 100% deduplicated results'
    ],
    example_request: {
      url: 'https://www.linkedin.com/in/some-profile/',
      maxLikes: 20,
      format: 'json', // or 'csv'
      keepOpen: false
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

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});