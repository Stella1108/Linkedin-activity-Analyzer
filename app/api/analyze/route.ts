import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ==========================================================================
// 🛡️ Helper function to safely get error message
// ==========================================================================
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
// ✅ CHECK IF COOKIES EXIST
// ==========================================================================
async function checkCookiesExist(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ==========================================================================
// 📥 MAIN POST HANDLER - QUEUES JOBS
// ==========================================================================
export async function POST(request: NextRequest) {
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
      console.error(`❌ Failed to parse request body: ${getErrorMessage(parseError)}`);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { url, maxLikes = 20, format = 'json' } = body;

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
    console.log(`📄 Format: ${format}`);

    // ✅ Check if cookies exist
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 1: Checking Cookie Availability');
    console.log('-'.repeat(40));
    
    const hasCookies = await checkCookiesExist();
    
    if (!hasCookies) {
      console.error('❌ No active cookies found');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active LinkedIn cookies found. Please add a valid li_at cookie to the database.'
        },
        { status: 503 }
      );
    }

    console.log('✅ Active cookies found');

    // ✅ Create job in queue
    console.log('\n' + '-'.repeat(40));
    console.log('STEP 2: Creating Job in Queue');
    console.log('-'.repeat(40));

    const { data: job, error: jobError } = await supabase
      .from('scraping_queue')
      .insert([{
        profile_url: url,
        max_likes: maxLikes,
        format: format,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      return NextResponse.json(
        { success: false, error: 'Failed to queue scraping job' },
        { status: 500 }
      );
    }

    console.log(`✅ Job created with ID: ${job.id}`);

    // ✅ Return immediately with job ID
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Scraping job queued successfully. The background worker will process it.',
      status: 'pending'
    });

  } catch (error) {
    console.error(`\n❌ API ERROR: ${getErrorMessage(error)}`);
    
    return NextResponse.json(
      { 
        success: false, 
        error: getErrorMessage(error) || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// ==========================================================================
// 📥 GET ENDPOINT FOR CHECKING JOB STATUS
// ==========================================================================
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    
    if (!jobId) {
      // Return API info if no jobId
      return NextResponse.json({
        success: true,
        message: 'LinkedIn Scraper API - Queue System',
        version: '4.0.0',
        endpoints: {
          POST: '/api/analyze - Queue a new scraping job',
          GET: '/api/analyze?jobId={id} - Check job status',
          DELETE: '/api/analyze?jobId={id} - Cancel a pending job'
        }
      });
    }

    // Get job status
    const { data: job, error } = await supabase
      .from('scraping_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // If job is completed and format was CSV, return CSV data
    if (job.status === 'completed' && job.format === 'csv' && job.result?.data?.likes) {
      const csvData = convertToCSV(job.result.data.likes);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="linkedin-profiles-${jobId}.csv"`,
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Return job status
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      format: job.format,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at
    });

  } catch (error) {
    console.error(`❌ GET Error: ${getErrorMessage(error)}`);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ==========================================================================
// ✅ DELETE ENDPOINT TO CANCEL JOBS
// ==========================================================================
export async function DELETE(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID required' },
        { status: 400 }
      );
    }

    // Only allow cancelling pending jobs
    const { data: job, error: fetchError } = await supabase
      .from('scraping_queue')
      .select('status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Delete the job
    const { error: deleteError } = await supabase
      .from('scraping_queue')
      .delete()
      .eq('id', jobId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error(`❌ DELETE Error: ${getErrorMessage(error)}`);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// Increase timeout for serverless
export const maxDuration = 60;
export const dynamic = 'force-dynamic';