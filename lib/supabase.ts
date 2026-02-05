// lib/supabase.ts - CLIENT COMPONENTS ONLY
import { createClient } from '@supabase/supabase-js';

// These environment variables are available in the browser
// because they start with NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth functions (for client components)
export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';
  
  const message = error.message || error.toString();
  
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials.';
  }
  
  if (message.includes('User already registered')) {
    return 'An account with this email already exists. Please login instead.';
  }
  
  if (message.includes('Email not confirmed')) {
    return 'Please check your email to confirm your account before logging in.';
  }
  
  if (message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }
  
  if (message.includes('Invalid email')) {
    return 'Please enter a valid email address.';
  }
  
  return message;
}