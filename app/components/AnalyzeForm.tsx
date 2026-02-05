'use client';

import { useState } from 'react';
import { AnalysisRequest } from '@/lib/types';
import { Link, Settings, Sparkles, Shield, AlertCircle } from 'lucide-react';

interface AnalyzeFormProps {
  onAnalyze: (data: AnalysisRequest) => void;
  isLoading: boolean;
  hasCookies: boolean;
}

export default function AnalyzeForm({ onAnalyze, isLoading, hasCookies }: AnalyzeFormProps) {
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'profile' | 'post'>('profile');
  const [scrapeLikes, setScrapeLikes] = useState(true);
  const [scrapeComments, setScrapeComments] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasCookies) {
      alert('LinkedIn authentication required. Please add li_at cookies to the database first.');
      return;
    }
    
    if (!url.trim()) {
      alert('Please enter a LinkedIn URL');
      return;
    }

    onAnalyze({
      url: url.trim(),
      type,
      scrapeLikes,
      scrapeComments
    });
  };

  const detectType = (url: string) => {
    if (url.includes('/in/')) {
      setType('profile');
    } else if (url.includes('/post/') || url.includes('/activity/')) {
      setType('post');
    }
  };

  const exampleUrls = {
    profile: 'https://www.linkedin.com/in/satyanadella/',
    post: 'https://www.linkedin.com/posts/microsoft_announcement-activity-1234567890'
  };

  const loadExample = (exampleType: 'profile' | 'post') => {
    setUrl(exampleUrls[exampleType]);
    setType(exampleType);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="px-8 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Analyze LinkedIn Content</h3>
            <p className="text-gray-600 mt-1">Get detailed engagement analytics using authenticated cookies</p>
          </div>
          <div className="flex items-center space-x-2">
            {hasCookies ? (
              <div className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-green-50 to-emerald-50 rounded-full">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Authenticated</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 rounded-full">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-600">No Cookies</span>
              </div>
            )}
            <Sparkles className="h-5 w-5 text-blue-500" />
          </div>
        </div>

        {!hasCookies && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 mb-1">LinkedIn Authentication Required</h4>
                <p className="text-sm text-amber-700">
                  You need to add LinkedIn cookies to analyze profiles. Click "Manage Cookies" in the navigation to add your li_at cookie.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-900">
                LinkedIn URL
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => loadExample('profile')}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Profile Example
                </button>
                <button
                  type="button"
                  onClick={() => loadExample('post')}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Post Example
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <Link className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  detectType(e.target.value);
                }}
                placeholder="https://www.linkedin.com/in/username/ or https://www.linkedin.com/posts/..."
                className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 outline-none transition-all duration-200 ${
                  hasCookies 
                    ? 'bg-gray-50 border-gray-200 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300' 
                    : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!hasCookies || isLoading}
              />
            </div>
            <p className="text-sm text-gray-500">
              Enter any LinkedIn profile or post URL to analyze (requires authenticated cookies)
            </p>
          </div>

          {/* URL Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('profile')}
                disabled={!hasCookies || isLoading}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  type === 'profile'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${(!hasCookies || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    type === 'profile' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}>
                    {type === 'profile' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Profile</div>
                    <div className="text-sm text-gray-500">Analyze user profile activity</div>
                  </div>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setType('post')}
                disabled={!hasCookies || isLoading}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  type === 'post'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${(!hasCookies || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    type === 'post' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                  }`}>
                    {type === 'post' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Post</div>
                    <div className="text-sm text-gray-500">Analyze specific post engagement</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={!hasCookies}
              className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                hasCookies ? 'text-gray-700 hover:text-blue-600' : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
            </button>
            
            {showAdvanced && hasCookies && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900">
                    Data Collection
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scrapeLikes}
                        onChange={() => setScrapeLikes(!scrapeLikes)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        disabled={!hasCookies || isLoading}
                      />
                      <div>
                        <div className="font-medium text-gray-900">Collect Likes Data</div>
                        <div className="text-sm text-gray-500">Extract information about people who liked the content</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scrapeComments}
                        onChange={() => setScrapeComments(!scrapeComments)}
                        className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                        disabled={!hasCookies || isLoading}
                      />
                      <div>
                        <div className="font-medium text-gray-900">Collect Comments Data</div>
                        <div className="text-sm text-gray-500">Extract comment content and user information</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!hasCookies || isLoading || !url}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform ${
              !hasCookies || isLoading || !url
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {!hasCookies ? (
              <div className="flex items-center justify-center space-x-3">
                <AlertCircle className="h-5 w-5" />
                <span>Add Cookies First</span>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center space-x-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Authenticated Analysis...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <Sparkles className="h-5 w-5" />
                <span>Start Authenticated Analysis</span>
              </div>
            )}
          </button>
        </form>
      </div>
      
      {/* Tips */}
      <div className="mt-8 border-t border-gray-100 bg-gray-50 px-8 py-6 rounded-b-2xl">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Authentication Required</h4>
            <p className="text-sm text-gray-600">
              This tool uses real LinkedIn cookies (li_at) for authenticated scraping. 
              Analysis may take 30-60 seconds depending on engagement. 
              <a href="/admin" className="text-blue-600 hover:underline ml-1">Manage cookies here</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}