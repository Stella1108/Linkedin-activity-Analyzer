'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, signOut, supabase } from '@/lib/supabase';

interface AuthContextType {
  user: any;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check current user
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN') {
          const { user } = await getCurrentUser();
          setUser(user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          router.push('/auth/login');
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refreshed, update user
          const { user } = await getCurrentUser();
          setUser(user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  const checkUser = async () => {
    try {
      setLoading(true);
      const { user, error } = await getCurrentUser();
      
      if (error) {
        console.error('Error checking user:', error);
      }
      
      setUser(user || null);
      
      // If user is not logged in and on a protected route, redirect to login
      if (!user && pathname?.startsWith('/dashboard')) {
        router.push('/auth/login');
      }
      
      // If user is logged in and on auth pages, redirect to dashboard
      if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error in checkUser:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    router.push('/auth/login');
  };

  const refreshUser = async () => {
    await checkUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);