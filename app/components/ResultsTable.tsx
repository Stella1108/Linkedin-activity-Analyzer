'use client';

import { Download, ExternalLink, User, Briefcase, Building2 } from 'lucide-react';

interface ResultsTableProps {
  data: {
    likes: any[];
    comments: any[];
    posts: any[];
    post?: any;
  };
}

export default function ResultsTable({ data }: ResultsTableProps) {
  // CSV with correct order: Name, Company, Job Title, Profile URL
  const downloadCSV = () => {
    const csvData = convertToCSV(data.likes);
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

  return (
    <div className="space-y-8">
      {/* Download Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={downloadCSV}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all duration-300"
        >
          <Download className="h-4 w-4" />
          <span>Download CSV ({data.likes.length} profiles)</span>
        </button>
      </div>

      {/* LIKES TABLE - CORRECT COLUMN ORDER: Name | Company | Job Title | Profile */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-white" />
              <h3 className="text-xl font-bold text-white">People Who Liked ({data.likes.length})</h3>
            </div>
            <div className="text-blue-100">
              Automatically extracted from posts
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.likes.map((like: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  {/* NAME COLUMN */}
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mr-3">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {like.name || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* COMPANY COLUMN - Using company field */}
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-900">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className="max-w-xs truncate font-medium">
                        {like.company || 'Not specified'}
                      </span>
                    </div>
                  </td>
                  
                  {/* JOB TITLE COLUMN - Using jobTitle field */}
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Briefcase className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className="max-w-xs truncate">
                        {like.jobTitle || like.headline || 'Not specified'}
                      </span>
                    </div>
                  </td>
                  
                  {/* PROFILE URL COLUMN */}
                  <td className="px-6 py-4">
                    {like.profileUrl ? (
                      <a 
                        href={like.profileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Profile
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">No URL</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.likes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No likes data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* COMMENTS TABLE - CORRECT COLUMN ORDER: Name | Company | Job Title | Comment | Profile */}
      {data.comments && data.comments.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mt-8">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Briefcase className="h-6 w-6 text-white" />
                <h3 className="text-xl font-bold text-white">Comments ({data.comments.length})</h3>
              </div>
              <div className="text-green-100">
                Extracted from post
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.comments.map((comment: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    {/* NAME COLUMN */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-r from-green-100 to-teal-100 rounded-full flex items-center justify-center mr-2">
                          <User className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {comment.name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    
                    {/* COMPANY COLUMN */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {comment.company || 'Not specified'}
                      </span>
                    </td>
                    
                    {/* JOB TITLE COLUMN */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {comment.jobTitle || comment.headline || 'Not specified'}
                      </span>
                    </td>
                    
                    {/* COMMENT TEXT COLUMN */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {comment.commentText || ''}
                      </p>
                    </td>
                    
                    {/* PROFILE URL COLUMN */}
                    <td className="px-6 py-4">
                      {comment.profileUrl ? (
                        <a 
                          href={comment.profileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">No URL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POSTS SECTION */}
      {data.posts && data.posts.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-6 w-6 text-white">📄</div>
                <h3 className="text-xl font-bold text-white">Posts Found ({data.posts.length})</h3>
              </div>
              <div className="text-purple-100">
                Recent activity
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.posts.map((post: any, index: number) => (
                <div key={index} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{post.author}</h4>
                        <p className="text-sm text-gray-600">
                          {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                        👍 {post.likesCount || 0}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                        💬 {post.commentsCount || 0}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-3">{post.content}</p>
                  {post.postUrl && (
                    <a 
                      href={post.postUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Original Post
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}