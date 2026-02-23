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
  
  // Clear any stored session data
  if (typeof window !== 'undefined') {
    // Clear all supabase related items from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  }
  
  return { error };
}

export async function getCurrentUser() {
  try {
    // First check if we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return { user: null, error: sessionError };
    }
    
    // If no session, return null user (not an error)
    if (!session) {
      console.log('No active session found');
      return { user: null, error: null };
    }
    
    // If we have a session, get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Get user error:', userError);
      return { user: null, error: userError };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('Unexpected error in getCurrentUser:', error);
    return { user: null, error };
  }
}

export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  } catch (error) {
    console.error('Unexpected error in getSession:', error);
    return { session: null, error };
  }
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
  
  if (message.includes('Auth session missing') || message.includes('AuthSessionMissingError')) {
    return 'Your session has expired. Please login again.';
  }
  
  return message;
}