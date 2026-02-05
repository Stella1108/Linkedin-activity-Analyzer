import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, Users, MessageSquare, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient(); // Add 'await' here
  const { data: { user } } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                LinkedIn Analyzer
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/login"
                className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-full mb-6">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-600">No Credit Card Required</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Professional{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                LinkedIn Analytics
              </span>{' '}
              Made Simple
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Extract valuable engagement data from LinkedIn profiles and posts using authenticated cookies. 
              Analyze likes, comments, and audience demographics in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 group"
              >
                <span>Start Free Analysis</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/login"
                className="px-8 py-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:shadow-lg transition-all duration-300 hover:border-blue-300"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Audience Insights</h3>
              <p className="text-gray-600">
                Discover who engages with your content. Get detailed profiles of people who like and comment on LinkedIn posts.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-r from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center mb-6">
                <MessageSquare className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Engagement Analytics</h3>
              <p className="text-gray-600">
                Track likes, comments, and engagement patterns. Export data to CSV for further analysis.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-r from-green-100 to-green-200 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Private</h3>
              <p className="text-gray-600">
                Your LinkedIn cookies are stored encrypted in our database. No data leaves your secure environment.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-10 md:p-16 mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
              <p className="text-gray-600 text-lg">Get insights in just 3 simple steps</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">1</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Sign Up Free</h3>
                <p className="text-gray-600">Create your account in 30 seconds</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-indigo-100">
                  <div className="text-2xl font-bold text-indigo-600">2</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Add LinkedIn Cookies</h3>
                <p className="text-gray-600">Store your li_at cookies securely</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-100">
                  <div className="text-2xl font-bold text-green-600">3</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Analyze Engagement</h3>
                <p className="text-gray-600">Get detailed insights from any post</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12 md:p-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to unlock LinkedIn insights?
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Join hundreds of professionals who use LinkedIn Analyzer to understand their audience better.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth/signup"
                  className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 group"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/auth/login"
                  className="px-8 py-4 bg-transparent border-2 border-white text-white font-medium rounded-xl hover:bg-white/10 transition-all duration-300"
                >
                  Sign In to Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  LinkedIn Analyzer
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-2">Professional LinkedIn Analytics Platform</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/auth/login" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Sign In
              </Link>
              <Link href="/auth/signup" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Sign Up
              </Link>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Privacy
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Terms
              </a>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-6 pt-6 border-t border-gray-100">
            © {new Date().getFullYear()} LinkedIn Analyzer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}