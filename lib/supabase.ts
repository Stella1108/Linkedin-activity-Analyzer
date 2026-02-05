import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getActiveLinkedInProfile() {
  const { data, error } = await supabaseAdmin
    .from('linkedin_profile_data')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching LinkedIn profile:', error);
    return null;
  }

  return data;
}