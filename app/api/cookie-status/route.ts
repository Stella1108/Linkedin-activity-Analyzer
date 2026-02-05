import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('id, name, li_at, is_active, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { 
          hasCookies: false, 
          message: 'Error fetching LinkedIn cookies from database',
          lastUpdated: null
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        hasCookies: false,
        message: 'No LinkedIn cookies found in database. Please add li_at cookies to the linkedin_profile_data table.',
        lastUpdated: null
      });
    }

    const cookieData = data[0];
    
    // Update the last used timestamp
    await supabase
      .from('linkedin_profile_data')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cookieData.id);

    return NextResponse.json({
      hasCookies: true,
      message: `Using LinkedIn cookies from: ${cookieData.name}`,
      lastUpdated: cookieData.updated_at,
      cookieName: cookieData.name
    });

  } catch (error: any) {
    console.error('Cookie status error:', error);
    return NextResponse.json(
      { 
        hasCookies: false, 
        message: 'Error checking cookie status',
        lastUpdated: null
      },
      { status: 500 }
    );
  }
}