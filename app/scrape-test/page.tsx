'use client';

import { useState } from 'react';

export default function ScrapeTestPage() {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('profile');
  const [keepOpen, setKeepOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          type,
          keepOpen
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        alert(`✅ Scraping completed! Check the browser window.\nFound: ${data.statistics.likes} likes, ${data.statistics.comments} comments`);
      } else {
        setError(data.error);
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setError(err.message);
      alert(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">LinkedIn Scraper Test</h1>
      <p className="mb-6 text-gray-600">
        This will launch a visible Chrome browser where you can watch the scraping process.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                LinkedIn URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/username/ or https://www.linkedin.com/posts/..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter a profile URL or post URL
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Scrape Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="profile">Profile Activity</option>
                <option value="post">Specific Post</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="keepOpen"
                checked={keepOpen}
                onChange={(e) => setKeepOpen(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="keepOpen" className="ml-2 text-sm">
                Keep browser open after scraping (for manual inspection)
              </label>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">⚠️</div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> A Chrome browser will open automatically. 
                    You need to watch it and possibly login manually if cookies are expired.
                    The browser must remain visible during scraping.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? 'Launching Browser and Scraping...' : 'Start Scraping'}
            </button>
          </form>
        </div>

        {/* Instructions Section */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">How it works:</h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li>Click "Start Scraping" button</li>
            <li>A Chrome browser will automatically open</li>
            <li>You will see LinkedIn loading with your cookies</li>
            <li>If not logged in, you'll need to login manually</li>
            <li>Watch as the browser:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Opens new tabs for profiles/posts</li>
                <li>Scrolls and interacts with pages</li>
                <li>Extracts likes and comments</li>
                <li>Closes tabs when done</li>
              </ul>
            </li>
            <li>Results will appear here when complete</li>
          </ol>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Tips:</h3>
            <ul className="text-blue-700 space-y-1">
              <li>• Keep the browser window visible</li>
              <li>• Don't interact with the browser during scraping</li>
              <li>• If login fails, check your cookies in the database</li>
              <li>• Test with public profiles first</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{result.statistics?.likes || 0}</div>
              <div className="text-green-600">Likes Found</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{result.statistics?.comments || 0}</div>
              <div className="text-blue-600">Comments Found</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{result.browserStatus}</div>
              <div className="text-purple-600">Browser Status</div>
            </div>
          </div>

          {result.data?.post && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Post Details:</h3>
              <div className="border rounded-lg p-4">
                <p className="font-medium">{result.data.post.author}</p>
                <p className="text-gray-600 text-sm mt-1">{result.data.post.content}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.data?.likes && result.data.likes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Likes ({result.data.likes.length})</h3>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {result.data.likes.map((like: any, index: number) => (
                    <div key={index} className="p-3 border-b">
                      <p className="font-medium">{like.name}</p>
                      <p className="text-sm text-gray-600">{like.headline}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.data?.comments && result.data.comments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Comments ({result.data.comments.length})</h3>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {result.data.comments.map((comment: any, index: number) => (
                    <div key={index} className="p-3 border-b">
                      <p className="font-medium">{comment.name}</p>
                      <p className="text-sm text-gray-600">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            Clear Error
          </button>
        </div>
      )}
    </div>
  );
}