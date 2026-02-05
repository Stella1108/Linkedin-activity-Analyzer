import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function checkCookieStatus() {
  try {
    const { data, error } = await supabase
      .from('linkedin_profile_data')
      .select('id, name, is_active, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        hasCookies: false,
        message: 'No active LinkedIn cookies found. Please add li_at cookies to the database.',
        lastUpdated: null
      };
    }

    const lastUpdated = new Date(data.updated_at);
    const hoursAgo = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return {
      hasCookies: true,
      message: `Using cookies from ${data.name} (last used ${Math.floor(hoursAgo)} hours ago)`,
      lastUpdated: data.updated_at
    };
  } catch (error) {
    console.error('Error checking cookie status:', error);
    return {
      hasCookies: false,
      message: 'Error checking cookie status',
      lastUpdated: null
    };
  }
}