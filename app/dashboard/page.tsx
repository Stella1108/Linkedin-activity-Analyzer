'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnalyzeForm from '../components/AnalyzeForm';
import ResultsTable from '../components/ResultsTable';
import { 
  AnalysisRequest, 
  ScrapeResult, 
  CookieStatus, 
  AnalysisProgress, 
  AnalysisHistoryItem,
  ResultsTableData 
} from '@/lib/types';
import { 
  BarChart3, Users, MessageSquare, Globe, Database, CheckCircle, 
  AlertCircle, RefreshCw, LogOut, User, Settings, X, Menu, 
  Download, ExternalLink, History, Cookie, FileText 
} from 'lucide-react';
import { signOut, getCurrentUser } from '@/lib/supabase';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [isCheckingCookies, setIsCheckingCookies] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    message: '',
    step: 0,
    totalSteps: 7,
    currentUrl: '',
    browserVisible: false
  });

  useEffect(() => {
    checkAuth();
    checkCookieStatus();
    loadAnalysisHistory();
  }, []);

  const checkAuth = async () => {
    const { user, error } = await getCurrentUser();
    if (error || !user) {
      router.push('/auth/login');
      return;
    }
    setCurrentUser(user);
  };

  const checkCookieStatus = async () => {
    setIsCheckingCookies(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cookie-status`);
      const data = await response.json();
      
      if (response.ok) {
        setCookieStatus({
          hasCookies: data.hasCookies,
          message: data.message,
          lastUpdated: data.lastUpdated,
          cookieName: data.cookieName,
          cookieCount: data.cookieCount || 0
        });
      } else {
        setCookieStatus({
          hasCookies: false,
          message: 'Error checking cookie status',
          lastUpdated: null,
          cookieCount: 0
        });
      }
    } catch (err) {
      console.error('Error checking cookie status:', err);
      setCookieStatus({
        hasCookies: false,
        message: 'Failed to connect to server',
        lastUpdated: null,
        cookieCount: 0
      });
    } finally {
      setIsCheckingCookies(false);
    }
  };

  const loadAnalysisHistory = async () => {
    try {
      const response = await fetch('/api/analyses/recent');
      if (response.ok) {
        const data = await response.json();
        setAnalysisHistory(data);
      }
    } catch (err) {
      console.error('Error loading analysis history:', err);
    }
  };

  const storeScrapedData = async (result: ScrapeResult, profileUrl: string) => {
    try {
      const response = await fetch('/api/analyses/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_url: profileUrl,
          result: result,
          user_id: currentUser?.id
        }),
      });
      
      if (response.ok) {
        console.log('✅ Scraped data stored in database');
        loadAnalysisHistory();
      } else {
        console.error('Failed to store scraped data');
      }
    } catch (err) {
      console.error('Error storing scraped data:', err);
    }
  };

  const handleAnalyze = async (request: AnalysisRequest) => {
    if (!cookieStatus?.hasCookies) {
      setError('No active LinkedIn cookies found in database. Please add li_at cookies to the linkedin_profile_data table.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    
    setAnalysisProgress({
      message: 'Initializing browser...',
      step: 1,
      totalSteps: 7,
      currentUrl: request.url,
      browserVisible: false
    });

    try {
      console.log('Starting analysis with request:', request);
      
      const requestBody: any = {
        url: request.url,
        type: request.type || 'auto',
        maxLikes: request.maxLikes || 20,
        keepOpen: request.keepOpen || false,
        format: request.format || 'json'
      };

      Object.keys(requestBody).forEach(key => {
        if (requestBody[key] === undefined) {
          delete requestBody[key];
        }
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('Analysis response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      const steps = [
        { message: 'Initializing browser...', step: 1 },
        { message: 'Logging into LinkedIn...', step: 2 },
        { message: 'Navigating to profile...', step: 3, browserVisible: true },
        { message: 'Loading page content...', step: 4 },
        { message: 'Extracting data...', step: 5 },
        { message: 'Processing results...', step: 6 },
        { message: 'Finalizing analysis...', step: 7 }
      ];
      
      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          const step = steps[currentStep];
          setAnalysisProgress(prev => ({
            ...prev,
            message: step.message || '',
            step: step.step || 0,
            browserVisible: step.browserVisible || false
          }));
          currentStep++;
        } else {
          clearInterval(progressInterval);
        }
      }, 5000);

      if (data.success) {
        setResult(data);
        await storeScrapedData(data, request.url);
        loadAnalysisHistory();
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

      setTimeout(() => {
        clearInterval(progressInterval);
        setAnalysisProgress({
          message: '',
          step: 0,
          totalSteps: 7,
          currentUrl: '',
          browserVisible: false
        });
      }, 35000);

    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
    router.refresh();
  };

  // ==========================================================================
  // ✅ UPDATED: CSV CONVERSION WITH CORRECT COLUMN ORDER
  // ==========================================================================
  const downloadCSV = () => {
    if (!result?.data?.likes) return;
    
    const csvData = convertToCSV(result.data.likes);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-likes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) return '';
    
    const headers = ['Name', 'Company', 'Job Title', 'Profile URL'];
    
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = [
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${(row.company || 'Not specified').replace(/"/g, '""')}"`,
        `"${(row.jobTitle || row.headline || 'Not specified').replace(/"/g, '""')}"`,
        `"${(row.profileUrl || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  };

  const getResultsTableData = (): ResultsTableData => {
    if (!result?.data) {
      return {
        likes: [],
        comments: [],
        posts: [],
        post: undefined
      };
    }

    return {
      likes: result.data.likes || [],
      comments: result.data.comments || [],
      posts: result.data.posts || [],
      post: result.data.post
    };
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5 text-gray-600" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-600" />
                )}
              </button>
              <Link href="/" className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    LinkedIn Analyzer
                  </span>
                  <p className="text-xs text-gray-500">Dashboard</p>
                </div>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={checkCookieStatus}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50"
              >
                <RefreshCw className={`h-4 w-4 ${isCheckingCookies ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
              
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {currentUser.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <Settings className="h-4 w-4 text-gray-600" />
                </button>
                
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{currentUser.email}</p>
                    <p className="text-xs text-gray-500 mt-1">Free Plan</p>
                  </div>
                  <div className="p-2">
                    <Link href="/cookies" className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                      Cookie Management
                    </Link>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                      Account Settings
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center space-x-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}></div>
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl animate-slide-in">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    LinkedIn Analyzer
                  </span>
                </div>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {currentUser.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{currentUser.email}</p>
                    <p className="text-xs text-gray-500">Free Plan</p>
                  </div>
                </div>
              </div>
              
              <nav className="space-y-1">
                <Link 
                  href="/" 
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md"
                >
                  Home
                </Link>
                <button className="w-full text-left px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">
                  Dashboard
                </button>
                <Link 
                  href="/cookies" 
                  className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Cookie Management
                </Link>
                <Link 
                  href="/results" 
                  className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Results
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Welcome Card */}
            <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Welcome back, {currentUser.user_metadata?.name || currentUser.email?.split('@')[0]}
                  </h1>
                  <p className="text-gray-600">
                    Professional LinkedIn engagement analytics using authenticated cookies
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    cookieStatus?.hasCookies 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {cookieStatus?.hasCookies ? 'Cookies Active' : 'No Cookies'}
                  </div>
                  <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    Free Plan
                  </div>
                </div>
              </div>
            </div>

            {/* Cookie Status */}
            <div className="mb-8">
              {isCheckingCookies ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Checking cookie status...</span>
                  </div>
                </div>
              ) : cookieStatus && (
                <div className={`rounded-xl p-6 ${
                  cookieStatus.hasCookies 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                    : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
                }`}>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      {cookieStatus.hasCookies ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className={`text-lg font-semibold ${
                          cookieStatus.hasCookies ? 'text-green-800' : 'text-amber-800'
                        }`}>
                          {cookieStatus.message}
                        </h3>
                        <Link 
                          href="/cookies" 
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Cookie className="h-4 w-4" />
                          <span>Manage</span>
                        </Link>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {cookieStatus.lastUpdated && (
                          <div>
                            <p className="text-sm text-gray-500">Last Used</p>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(cookieStatus.lastUpdated).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {cookieStatus.cookieCount && (
                          <div>
                            <p className="text-sm text-gray-500">Active Cookies</p>
                            <p className="text-sm font-medium text-gray-900">
                              {cookieStatus.cookieCount} cookies
                            </p>
                          </div>
                        )}
                      </div>
                      {!cookieStatus.hasCookies && (
                        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                          <p className="text-sm text-amber-700 mb-2">
                            To add LinkedIn cookies to the database:
                          </p>
                          <ol className="text-sm text-gray-600 space-y-1 list-decimal pl-4">
                            <li>Login to LinkedIn in Chrome</li>
                            <li>Get your "li_at" cookie from DevTools</li>
                            <li>Add it to the Cookies page</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Globe className="h-6 w-6 text-white" />
                    <h2 className="text-2xl font-bold text-white">Start New Analysis</h2>
                  </div>
                  <div className="text-sm text-blue-100">
                    Using authenticated browser
                  </div>
                </div>
                <p className="text-blue-100 mt-2">
                  Enter a LinkedIn URL to analyze engagement data
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

            {/* Progress Indicator */}
            {isLoading && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-10 w-10 text-blue-600 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Analysis in Progress</h3>
                  <p className="text-gray-600 mb-1">Analyzing: {analysisProgress.currentUrl}</p>
                  <p className="text-sm text-gray-500">Using database cookies for authentication</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Step {analysisProgress.step} of {analysisProgress.totalSteps}</span>
                    <span>{analysisProgress.message}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(analysisProgress.step / analysisProgress.totalSteps) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">1</div>
                      <p className="text-sm text-gray-600 mt-1">Browser Opens</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">2</div>
                      <p className="text-sm text-gray-600 mt-1">LinkedIn Login</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">3</div>
                      <p className="text-sm text-gray-600 mt-1">Navigate</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">4</div>
                      <p className="text-sm text-gray-600 mt-1">Extract Data</p>
                    </div>
                  </div>

                  {analysisProgress.browserVisible && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          A Chrome browser window has opened. Please keep it visible and do not close it during analysis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-100 rounded-2xl p-8 mb-8 animate-fade-in">
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
                        Check Cookie Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {result && result.success && result.data && (
              <div className="animate-fade-in">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-8 mb-8 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">{result.message || 'Analysis Complete'}</h3>
                        <p className="text-gray-600">Data extracted and stored successfully</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={downloadCSV}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download CSV</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Total Profiles</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {(result.data.likes && result.data.likes.length) || 0}
                          </div>
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
                          <div className="text-2xl font-bold text-indigo-600">
                            {(result.data.comments && result.data.comments.length) || 0}
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-indigo-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Posts Found</div>
                          <div className="text-2xl font-bold text-purple-600">
                            {(result.data.posts && result.data.posts.length) || 0}
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Post Engagement</div>
                          <div className="text-2xl font-bold text-green-600">
                            {result.data.post ? (result.data.post.likesCount || 0) + (result.data.post.commentsCount || 0) : 0}
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">Analysis Results</h3>
                    <p className="text-gray-600">Extracted data from LinkedIn</p>
                  </div>
                  <div className="p-6">
                    <ResultsTable data={getResultsTableData()} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {currentUser.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {currentUser.user_metadata?.name || currentUser.email}
                  </h3>
                  <p className="text-gray-600 text-sm">{currentUser.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      Free Plan
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      Active
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Account Type</span>
                  <span className="font-medium text-gray-900">Free</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Analyses Today</span>
                  <span className="font-medium text-gray-900">{analysisHistory.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Active Cookies</span>
                  <span className="font-medium text-gray-900">{cookieStatus?.cookieCount || 0}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button 
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Recent Analyses</h3>
                <button 
                  onClick={loadAnalysisHistory}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              
              {analysisHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No recent analyses</p>
                  <p className="text-sm text-gray-400 mt-1">Start your first analysis above</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysisHistory.slice(0, 5).map((analysis, index) => (
                    <div 
                      key={analysis.id || index} 
                      className="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            analysis.success ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-xs text-gray-500">
                            {new Date(analysis.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          {analysis.type || 'profile'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {analysis.profile_name || analysis.profile_url?.split('/in/')[1] || 'Unknown Profile'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>👍 {analysis.likes_count || 0}</span>
                        <span>💬 {analysis.comments_count || 0}</span>
                        <Link 
                          href={`/results/${analysis.id}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {analysisHistory.length > 5 && (
                    <Link 
                      href="/results"
                      className="block text-center text-sm text-blue-600 hover:text-blue-800 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      View all analyses →
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href="/cookies"
                  className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Cookie className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Manage Cookies</p>
                    <p className="text-xs text-gray-500">Add or update LinkedIn cookies</p>
                  </div>
                </Link>
                
                <button 
                  onClick={checkCookieStatus}
                  className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Check Cookie Status</p>
                    <p className="text-xs text-gray-500">Verify database connection</p>
                  </div>
                </button>
                
                <button 
                  onClick={downloadCSV}
                  disabled={!result}
                  className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors w-full text-left ${
                    result 
                      ? 'border-gray-100 hover:bg-gray-50 group' 
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    result ? 'bg-indigo-50 group-hover:bg-indigo-100' : 'bg-gray-50'
                  }`}>
                    <Download className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Download Results</p>
                    <p className="text-xs text-gray-500">Export as CSV file</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
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
              <p className="text-gray-600 text-sm mt-2">Professional LinkedIn Analytics</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Home
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Dashboard
              </Link>
              <Link href="/cookies" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">
                Cookies
              </Link>
              <button 
                onClick={handleSignOut}
                className="text-gray-600 hover:text-blue-600 transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-6 pt-6 border-t border-gray-100">
            © {new Date().getFullYear()} LinkedIn Analyzer. Logged in as {currentUser.email}
          </div>
        </div>
      </footer>
    </div>
  );
}