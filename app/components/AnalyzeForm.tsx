// components/AnalyzeForm.tsx

'use client';

import { useState } from 'react';
import { AnalysisRequest } from '@/lib/types';

interface AnalyzeFormProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isLoading: boolean;
  hasCookies: boolean;
}

export default function AnalyzeForm({ onAnalyze, isLoading, hasCookies }: AnalyzeFormProps) {
  const [formData, setFormData] = useState<Omit<AnalysisRequest, 'maxLikes'> & { maxLikes: string }>({
    url: '',
    type: 'auto',
    maxLikes: '20', // Keep as string in state
    keepOpen: false,
    format: 'json'
  });
  const [error, setError] = useState<string>('');

  const validateUrl = (url: string) => {
    if (!url.trim()) {
      setError('Please enter a LinkedIn URL');
      return false;
    }
    
    if (!url.includes('linkedin.com')) {
      setError('Please enter a valid LinkedIn URL');
      return false;
    }
    
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateUrl(formData.url)) {
      return;
    }

    if (!hasCookies) {
      setError('No active LinkedIn cookies found. Please add cookies to the database first.');
      return;
    }

    // Convert maxLikes from string to number when submitting
    const requestData: AnalysisRequest = {
      ...formData,
      maxLikes: parseInt(formData.maxLikes) || 20
    };

    onAnalyze(requestData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: checkbox.checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            LinkedIn URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="url"
            value={formData.url}
            onChange={handleInputChange}
            placeholder="https://www.linkedin.com/in/username or https://www.linkedin.com/posts/..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            disabled={isLoading}
            required
          />
          <p className="mt-2 text-sm text-gray-500">
            Supports profiles (/in/username) and posts (/posts/ or /activity/)
          </p>
        </div>

        {/* Advanced Options */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={isLoading}
            >
              <option value="auto">Auto-detect</option>
              <option value="profile">Profile Analysis</option>
              <option value="post">Post Analysis</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Likes to Extract
            </label>
            <input
              type="number"
              name="maxLikes"
              value={formData.maxLikes}
              onChange={handleInputChange}
              min="1"
              max="100"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">Maximum number of profiles to extract (1-100)</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Format
            </label>
            <select
              name="format"
              value={formData.format}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={isLoading}
            >
              <option value="json">JSON (Web View)</option>
              <option value="csv">CSV (Download)</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-3 pt-6">
            <input
              type="checkbox"
              id="keepOpen"
              name="keepOpen"
              checked={formData.keepOpen}
              onChange={handleInputChange}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="keepOpen" className="text-sm text-gray-700">
              Keep browser open for debugging
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Cookie Status Warning */}
        {!hasCookies && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm font-medium mb-1">⚠️ No Active LinkedIn Cookies</p>
            <p className="text-amber-700 text-sm">
              Please add valid LinkedIn cookies to the database before starting analysis.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isLoading || !hasCookies}
            className={`w-full px-6 py-4 font-medium rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 ${
              hasCookies 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:scale-[1.02]' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>{hasCookies ? 'Start Analysis' : 'Add Cookies First'}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
          
          {hasCookies && (
            <p className="mt-3 text-sm text-gray-500 text-center">
              This process opens a Chrome browser and may take 5-15 minutes depending on the profile.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}