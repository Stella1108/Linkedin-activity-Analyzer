'use client';

import { useState, useEffect } from 'react';
import AnalyzeForm from './components/AnalyzeForm';
import ResultsTable from './components/ResultsTable';
import { AnalysisRequest, ScrapeResult } from '@/lib/types';
import { BarChart3, Users, MessageSquare, Globe, Shield, Zap, Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookieStatus, setCookieStatus] = useState<{
    hasCookies: boolean, 
    message: string, 
    lastUpdated: string | null,
    cookieName?: string
  } | null>(null);
  const [isCheckingCookies, setIsCheckingCookies] = useState(true);

  // Check cookie status on component mount
  useEffect(() => {
    checkCookieStatus();
  }, []);

  const checkCookieStatus = async () => {
    setIsCheckingCookies(true);
    try {
      const response = await fetch('/api/cookie-status');
      const data = await response.json();
      
      if (response.ok) {
        setCookieStatus({
          hasCookies: data.hasCookies,
          message: data.message,
          lastUpdated: data.lastUpdated,
          cookieName: data.cookieName
        });
      } else {
        setCookieStatus({
          hasCookies: false,
          message: 'Error checking cookie status',
          lastUpdated: null
        });
      }
    } catch (err) {
      console.error('Error checking cookie status:', err);
      setCookieStatus({
        hasCookies: false,
        message: 'Failed to connect to server',
        lastUpdated: null
      });
    } finally {
      setIsCheckingCookies(false);
    }
  };

  const handleAnalyze = async (request: AnalysisRequest) => {
    // First check if we have valid cookies
    if (!cookieStatus?.hasCookies) {
      setError('No active LinkedIn cookies found in database. Please add li_at cookies to the linkedin_profile_data table.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
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
              <button 
                onClick={checkCookieStatus}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isCheckingCookies ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-full mb-4">
            <Database className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">Database-Powered LinkedIn Analytics</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Professional LinkedIn{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Engagement Analytics
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Extract valuable engagement data from LinkedIn profiles and posts using authenticated cookies from database. 
            Analyze likes, comments, and audience demographics.
          </p>
          
          {/* Cookie Status */}
          {isCheckingCookies ? (
            <div className="max-w-2xl mx-auto mb-10 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-center space-x-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600">Checking database for LinkedIn cookies...</span>
              </div>
            </div>
          ) : cookieStatus && (
            <div className={`max-w-2xl mx-auto mb-10 p-4 rounded-xl ${
              cookieStatus.hasCookies 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
            }`}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {cookieStatus.hasCookies ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${
                    cookieStatus.hasCookies ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    {cookieStatus.message}
                  </h3>
                  {cookieStatus.lastUpdated && (
                    <p className="text-sm text-gray-600 mt-1">
                      Last used: {new Date(cookieStatus.lastUpdated).toLocaleString()}
                    </p>
                  )}
                  {cookieStatus.cookieName && (
                    <p className="text-sm text-gray-600 mt-1">
                      Active cookie from: <span className="font-medium">{cookieStatus.cookieName}</span>
                    </p>
                  )}
                  {!cookieStatus.hasCookies && (
                    <div className="mt-3">
                      <p className="text-sm text-amber-700 mb-2">
                        To add LinkedIn cookies to the database, use the following SQL:
                      </p>
                      <div className="bg-gray-800 text-gray-100 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                        INSERT INTO linkedin_profile_data (name, li_at, jsessionid, bcookie, is_active) <br />
                        VALUES ('Your Name', 'li_at_cookie_value', 'jsessionid_value', 'bcookie_value', true);
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Stats */}
          <div className="flex justify-center space-x-8 mb-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">Database</div>
              <div className="text-sm text-gray-500">Cookie Storage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">24/7</div>
              <div className="text-sm text-gray-500">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">Secure</div>
              <div className="text-sm text-gray-500">Encrypted</div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:border-blue-200">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Database-Powered</h3>
            <p className="text-gray-600 text-sm">
              Uses LinkedIn cookies stored securely in PostgreSQL database. No manual cookie input needed.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:border-indigo-200">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Audience Insights</h3>
            <p className="text-gray-600 text-sm">
              Discover who engages with content and build targeted audience profiles.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:border-blue-200">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-gray-600 text-sm">
              Cookies stored encrypted. No user data leaves your infrastructure.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Analyze Form */}
          <div className="mb-12">
            <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                <div className="flex items-center space-x-3">
                  <Globe className="h-6 w-6 text-white" />
                  <h2 className="text-2xl font-bold text-white">Start Analysis</h2>
                </div>
                <p className="text-blue-100 mt-2">
                  Enter a LinkedIn URL to analyze engagement data using cookies from database
                </p>
              </div>
              <div className="p-8">
                <AnalyzeForm 
                  onAnalyze={handleAnalyze} 
                  isLoading={isLoading} 
                  hasCookies={cookieStatus?.hasCookies || false}
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 mb-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
                <div className="relative z-10">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-10 w-10 text-blue-600 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Authenticated Scraping in Progress</h3>
                  <p className="text-gray-600 mb-2">Using LinkedIn cookies from database to gather insights</p>
                  <p className="text-sm text-gray-500 mb-4">This may take 30-60 seconds depending on engagement</p>
                  {cookieStatus?.cookieName && (
                    <p className="text-sm text-blue-600 mb-2">
                      Using cookies from: <span className="font-semibold">{cookieStatus.cookieName}</span>
                    </p>
                  )}
                  <div className="inline-flex items-center space-x-2 text-sm text-blue-600">
                    <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-8 animate-fade-in">
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-100 rounded-2xl p-8 shadow-lg">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Error</h3>
                    <p className="text-red-700 mb-4">{error}</p>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setError(null)}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all duration-300"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={checkCookieStatus}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all duration-300"
                      >
                        Refresh Cookie Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {result && result.success && result.data && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-8 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">{result.message || 'Analysis Complete'}</h3>
                        <p className="text-gray-600">LinkedIn data scraped using database cookies</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Scraped at</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {new Date(result.data.scrapedAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Cards */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Total Likes</div>
                          <div className="text-2xl font-bold text-blue-600">{result.data.likes.length}</div>
                        </div>
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Total Comments</div>
                          <div className="text-2xl font-bold text-indigo-600">{result.data.comments.length}</div>
                        </div>
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-indigo-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Post Engagement</div>
                          <div className="text-2xl font-bold text-green-600">
                            {result.data.post ? result.data.post.likesCount + result.data.post.commentsCount : 0}
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Results Table */}
              <ResultsTable data={result.data} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 bg-white">
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
              <p className="text-gray-600 text-sm mt-2">Uses LinkedIn cookies from PostgreSQL database</p>
            </div>
            <div className="flex space-x-6">
              <button 
                onClick={checkCookieStatus}
                className="text-gray-600 hover:text-blue-600 transition-colors text-sm"
              >
                Cookie Status
              </button>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">Privacy</a>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">Terms</a>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-6 pt-6 border-t border-gray-100">
            © {new Date().getFullYear()} LinkedIn Analyzer. Uses LinkedIn cookies from database table: linkedin_profile_data
          </div>
        </div>
      </footer>
    </div>
  );
}