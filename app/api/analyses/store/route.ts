import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile_url, result, user_id } = body;

    if (!profile_url || !result || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📦 Storing analysis results...');
    
    // Extract profile name from URL
    const profileName = profile_url.split('/in/')[1]?.split('/')[0] || 'unknown';
    
    // Prepare data for storage
    const analysisData = {
      user_id: user_id,
      profile_url: profile_url,
      profile_name: profileName,
      type: 'profile',
      success: result.success,
      error_message: result.error,
      
      // Store counts
      likes_count: result.data?.likes?.length || 0,
      comments_count: result.data?.comments?.length || 0,
      posts_count: result.data?.posts?.length || 0,
      
      // Store extracted data (as JSON)
      extracted_data: result.data ? {
        likes: result.data.likes || [],
        comments: result.data.comments || [],
        posts: result.data.posts || [],
        post: result.data.post || null,
        profileUrl: result.data.profileUrl,
        scrapedAt: result.data.scrapedAt
      } : null,
      
      // Store sample data for quick display
      sample_likes: result.data?.likes?.slice(0, 3) || [],
      sample_posts: result.data?.posts?.slice(0, 2) || [],
      
      // Statistics
      total_extracted: (result.data?.likes?.length || 0) + 
                      (result.data?.comments?.length || 0) + 
                      (result.data?.posts?.length || 0),
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert into analyses table
    const { data, error } = await supabase
      .from('analyses')
      .insert([analysisData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error.message);
      return NextResponse.json(
        { success: false, error: 'Failed to store analysis results' },
        { status: 500 }
      );
    }

    console.log(`✅ Analysis stored with ID: ${data.id}`);
    console.log(`📊 Likes: ${analysisData.likes_count}, Posts: ${analysisData.posts_count}`);

    return NextResponse.json({
      success: true,
      analysis_id: data.id,
      message: 'Analysis results stored successfully',
      stored_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error storing analysis:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}