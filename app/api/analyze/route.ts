import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import LinkedInScraper from '@/lib/puppeteer-scraper';
import { LinkedInProfileData } from '@/lib/types';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getLinkedInCookie(): Promise<LinkedInProfileData | null> {
  try {
    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching LinkedIn cookie from database:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Update the last used timestamp
    await supabase
      .from('linkedin_profile_data')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', data.id);

    return data as LinkedInProfileData;
  } catch (error) {
    console.error('Error in getLinkedInCookie:', error);
    return null;
  }
}

// Global variable to track running scraper
let activeScraper: LinkedInScraper | null = null;

export async function POST(request: NextRequest) {
  let scraper: LinkedInScraper | null = null;
  
  try {
    const body = await request.json();
    const { url, type, keepOpen = false } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate LinkedIn URL
    if (!url.includes('linkedin.com')) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid LinkedIn URL' },
        { status: 400 }
      );
    }

    // Get cookies from database
    const cookies = await getLinkedInCookie();
    
    if (!cookies) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active LinkedIn cookies found in database. Please add li_at cookies to the linkedin_profile_data table.' 
        },
        { status: 503 }
      );
    }

    console.log(`📋 Using LinkedIn cookies from database user: ${cookies.name}`);

    // Create scraper instance
    scraper = new LinkedInScraper();
    activeScraper = scraper;

    // Step 1: Initialize the scraper (opens visible browser)
    console.log('\n' + '='.repeat(80));
    console.log('🚀 INITIALIZING VISIBLE BROWSER WITH ENHANCED SCRAPING');
    console.log('='.repeat(80));
    console.log('👁️  A Chrome browser will open shortly...');
    console.log('   Please keep it visible during the entire process.');
    console.log('   This process may take several minutes due to detailed scraping.');
    console.log('\n📊 SCRAPING PROCESS:');
    console.log('   1. Browser opens and logs into LinkedIn');
    console.log('   2. Navigates to your provided URL');
    console.log('   3. Scrolls through the page to load content');
    console.log('   4. Finds posts and engagement data');
    console.log('   5. Opens likes modal and scrapes user profiles');
    console.log('   6. Visits each profile for detailed information');
    console.log('   7. Returns structured data in table format');
    
    try {
      console.log('\n⏳ Initializing browser (this may take up to 2 minutes)...');
      await scraper.initialize(cookies);
      console.log('✅ Browser initialized and visible');
      
      const status = scraper.getBrowserStatus();
      console.log(`📊 Browser Status: Connected=${status.isConnected}, Initialized=${status.isInitialized}`);
      
    } catch (initError: any) {
      console.error('❌ Failed to initialize browser:', initError.message);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to initialize browser: ${initError.message}`,
          data: null,
          browserStatus: 'failed',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Step 2: Perform scraping based on type
    let result;
    const startTime = Date.now();
    
    if (type === 'profile' || url.includes('/in/')) {
      console.log('\n' + '='.repeat(80));
      console.log('👨‍💼 STARTING DETAILED PROFILE SCRAPING');
      console.log('='.repeat(80));
      console.log('👁️  Watch the browser window for live actions!');
      console.log('   This will:');
      console.log('   1. Open the profile page');
      console.log('   2. Scroll to load all activities');
      console.log('   3. Find recent posts');
      console.log('   4. Scrape likes and open each profile for details');
      console.log('   5. Scrape comments');
      console.log('\n⏳ This process may take 5-15 minutes depending on the number of likes...');
      
      result = await scraper.scrapeProfileActivity(url);
      
    } else if (url.includes('/feed/') || url.includes('/posts/') || url.includes('/activity/')) {
      console.log('\n' + '='.repeat(80));
      console.log('📝 STARTING DETAILED POST SCRAPING');
      console.log('='.repeat(80));
      console.log('👁️  Watch the browser window for live actions!');
      console.log('   This will:');
      console.log('   1. Open the post page');
      console.log('   2. Scroll to load all content');
      console.log('   3. Extract post details');
      console.log('   4. Scrape likes and open each profile for details');
      console.log('   5. Scrape comments');
      console.log('\n⏳ This process may take 5-15 minutes depending on the number of likes...');
      
      result = await scraper.scrapePost(url);
      
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 STARTING GENERAL SCRAPING');
      console.log('='.repeat(80));
      console.log('👁️  Watch the browser window for live actions!');
      console.log('\n⏳ This process may take 5-15 minutes...');
      
      result = await scraper.scrapeProfileActivity(url);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`\n⏱️  Total scraping time: ${duration} seconds`);

    // Step 3: Handle browser closing based on keepOpen flag
    if (keepOpen) {
      console.log('\n' + '='.repeat(60));
      console.log('🖥️  BROWSER REMAINING OPEN');
      console.log('='.repeat(60));
      console.log('The browser window will remain open for manual inspection.');
      console.log('You can close it manually or it will auto-close after 10 minutes.');
      
      // Auto-close after 10 minutes
      setTimeout(async () => {
        if (activeScraper === scraper) {
          const status = scraper?.getBrowserStatus();
          if (status?.isConnected) {
            console.log('⏰ Auto-closing browser after timeout...');
            await scraper?.close();
            activeScraper = null;
          }
        }
      }, 10 * 60 * 1000);
      
    } else {
      // Close the scraper
      console.log('\n' + '='.repeat(60));
      console.log('🔌 CLOSING BROWSER');
      console.log('='.repeat(60));
      if (scraper) {
        await scraper.close();
        activeScraper = null;
      }
    }

    // Step 4: Return the result
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          data: null,
          browserStatus: keepOpen ? 'open' : 'closed',
          timestamp: new Date().toISOString(),
          duration: `${duration} seconds`
        },
        { status: 500 }
      );
    }

    // Format data for table display
    const formattedData = {
      post: result.data.post,
      likes: result.data.likes.map((like: any) => ({
        name: like.name,
        profileUrl: like.profileUrl,
        headline: like.headline,
        company: like.company || 'Not specified',
        location: like.location || 'Not specified',
        likedAt: like.likedAt
      })),
      comments: result.data.comments.map((comment: any) => ({
        name: comment.name,
        profileUrl: comment.profileUrl,
        headline: comment.headline,
        comment: comment.comment.length > 100 ? comment.comment.substring(0, 100) + '...' : comment.comment,
        commentedAt: comment.commentedAt,
        likesCount: comment.likesCount
      }))
    };

    return NextResponse.json({
      success: true,
      data: formattedData,
      message: result.message || 'Scraping completed successfully',
      browserStatus: keepOpen ? 'open' : 'closed',
      timestamp: new Date().toISOString(),
      duration: `${duration} seconds`,
      statistics: {
        likes: result.data.likes.length,
        comments: result.data.comments.length,
        hasPost: !!result.data.post,
        profileUrl: result.data.profileUrl
      },
      // Add structured data for table display
      tableData: {
        likes: formattedData.likes,
        comments: formattedData.comments,
        post: formattedData.post ? [formattedData.post] : []
      }
    });

  } catch (error: any) {
    console.error('❌ API Error:', error);
    
    // Close scraper on error
    if (scraper) {
      try {
        await scraper.close();
        if (activeScraper === scraper) {
          activeScraper = null;
        }
      } catch (closeError) {
        console.error('Error closing scraper:', closeError);
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        data: null,
        browserStatus: 'closed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check browser status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'status') {
    return NextResponse.json({
      success: true,
      message: 'LinkedIn Scraper API - Enhanced Version',
      timestamp: new Date().toISOString(),
      activeScraper: activeScraper ? {
        isInitialized: activeScraper.getBrowserStatus().isInitialized,
        isConnected: activeScraper.getBrowserStatus().isConnected
      } : null,
      features: [
        'Detailed profile scraping with company extraction',
        'Individual profile visits for each liker',
        'Enhanced CSS selectors for better element detection',
        'Slow scrolling to trigger lazy loading',
        'Structured table data output',
        'Extended timeouts for slow LinkedIn pages'
      ],
      instructions: [
        'POST /api/analyze with { "url": "linkedin-url", "type": "profile|post", "keepOpen": true|false }',
        'Browser will open automatically and you can watch the scraping process',
        'Set keepOpen=true to keep browser open for manual inspection',
        'Process may take 5-15 minutes for detailed scraping'
      ]
    });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Invalid action',
    availableActions: ['status'],
    timestamp: new Date().toISOString()
  });
}

// Cleanup on server shutdown
process.on('SIGTERM', async () => {
  if (activeScraper) {
    console.log('🔄 Cleaning up active scraper on SIGTERM');
    await activeScraper.close();
  }
});

process.on('SIGINT', async () => {
  if (activeScraper) {
    console.log('🔄 Cleaning up active scraper on SIGINT');
    await activeScraper.close();
  }
});