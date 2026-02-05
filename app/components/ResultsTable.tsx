'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { LikeData, CommentData, PostData } from '@/lib/types';
import { format } from 'date-fns';
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users, MessageSquare } from 'lucide-react';

interface ResultsTableProps {
  data: {
    post?: PostData;
    likes: LikeData[];
    comments: CommentData[];
    profileUrl: string;
    scrapedAt: string;
  };
}

// Custom pagination hook
const usePaginationHook = <T,>(data: T[], itemsPerPage: number = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    currentPage,
    totalPages,
    paginatedData,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startItem: startIndex + 1,
    endItem: Math.min(endIndex, data.length),
    totalItems: data.length,
  };
};

const LikesTable = ({ data }: { data: LikeData[] }) => {
  const {
    currentPage,
    totalPages,
    paginatedData,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage,
    hasPrevPage,
    startItem,
    endItem,
    totalItems,
  } = usePaginationHook(data, 10);

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<LikeData>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row, getValue }) => (
          <a
            href={row.original.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium flex items-center space-x-2"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {getValue<string>()?.split(' ').map(n => n[0]).join('').toUpperCase() || ''}
              </span>
            </div>
            <span>{getValue<string>() || 'N/A'}</span>
          </a>
        ),
      },
      {
        accessorKey: 'headline',
        header: 'Title & Company',
        cell: ({ getValue }) => {
          const value = getValue<string>();
          let title = value || '';
          let company = '';
          
          if (value) {
            const atIndex = value.indexOf(' at ');
            if (atIndex > -1) {
              title = value.substring(0, atIndex).trim();
              company = value.substring(atIndex + 4).split(' · ')[0].trim();
            }
          }
          
          return (
            <div>
              <div className="font-medium text-gray-900">{title}</div>
              {company && (
                <div className="text-sm text-gray-600">{company}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ getValue }) => (
          <span className="text-gray-500">{getValue<string>() || 'N/A'}</span>
        ),
      },
      {
        accessorKey: 'likedAt',
        header: 'Liked At',
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return (
            <div className="text-sm">
              <div className="text-gray-500">
                {value ? format(new Date(value), 'MMM dd, yyyy') : 'N/A'}
              </div>
              {value && (
                <div className="text-xs text-gray-400">
                  {format(new Date(value), 'hh:mm a')}
                </div>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center cursor-pointer">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <span className="ml-1">
                        {{
                          asc: ' ▲',
                          desc: ' ▼',
                        }[header.column.getIsSorted() as string] ?? ''}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id}
                  className="hover:bg-blue-50 transition-colors duration-150"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="text-gray-600">No likes data available for this post</div>
                    <div className="text-sm text-gray-400">Try analyzing a different LinkedIn URL</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Pagination */}
      {data.length > 10 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="mb-3 sm:mb-0">
            <p className="text-sm text-gray-700">
              Showing <span className="font-semibold">{startItem}</span> to{' '}
              <span className="font-semibold">{endItem}</span> of{' '}
              <span className="font-semibold">{totalItems}</span> likes
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => goToPage(1)}
                disabled={!hasPrevPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={prevPage}
                disabled={!hasPrevPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  className="w-12 px-2 py-1 text-center border border-gray-300 rounded-md text-sm"
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>
              
              <button
                onClick={nextPage}
                disabled={!hasNextPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={!hasNextPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CommentsTable = ({ data }: { data: CommentData[] }) => {
  const {
    currentPage,
    totalPages,
    paginatedData,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage,
    hasPrevPage,
    startItem,
    endItem,
    totalItems,
  } = usePaginationHook(data, 10);

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<CommentData>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Commenter',
        cell: ({ row, getValue }) => (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-semibold text-sm">
                  {getValue<string>()?.split(' ').map(n => n[0]).join('').toUpperCase() || ''}
                </span>
              </div>
            </div>
            <div>
              <a
                href={row.original.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium block"
              >
                {getValue<string>() || 'N/A'}
              </a>
              <div className="text-sm text-gray-500">
                {row.original.headline?.split(' at ')[0] || ''}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'comment',
        header: 'Comment',
        cell: ({ getValue }) => (
          <div className="max-w-2xl">
            <p className="text-gray-700 line-clamp-3">{getValue<string>() || 'No comment text'}</p>
          </div>
        ),
      },
      {
        id: 'company',
        header: 'Company',
        cell: ({ row }) => {
          const headline = row.original.headline || '';
          let company = '';
          
          if (headline) {
            const atIndex = headline.indexOf(' at ');
            if (atIndex > -1) {
              company = headline.substring(atIndex + 4).split(' · ')[0].trim();
            }
          }
          
          return (
            <div className="text-sm">
              {company ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {company}
                </span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'stats',
        header: 'Stats',
        cell: ({ row }) => (
          <div className="text-right">
            <div className="flex items-center justify-end space-x-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {row.original.likesCount || 0}
                </div>
                <div className="text-xs text-gray-500">Likes</div>
              </div>
              <div className="text-sm text-gray-500">
                {row.original.commentedAt ? (
                  <div>
                    <div>{format(new Date(row.original.commentedAt), 'MMM dd')}</div>
                    <div className="text-xs">{format(new Date(row.original.commentedAt), 'hh:mm a')}</div>
                  </div>
                ) : 'N/A'}
              </div>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-indigo-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center cursor-pointer">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <span className="ml-1">
                        {{
                          asc: ' ▲',
                          desc: ' ▼',
                        }[header.column.getIsSorted() as string] ?? ''}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id}
                  className="hover:bg-indigo-50 transition-colors duration-150"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="text-gray-600">No comments data available for this post</div>
                    <div className="text-sm text-gray-400">Try analyzing a different LinkedIn URL</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Pagination */}
      {data.length > 10 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="mb-3 sm:mb-0">
            <p className="text-sm text-gray-700">
              Showing <span className="font-semibold">{startItem}</span> to{' '}
              <span className="font-semibold">{endItem}</span> of{' '}
              <span className="font-semibold">{totalItems}</span> comments
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => goToPage(1)}
                disabled={!hasPrevPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={prevPage}
                disabled={!hasPrevPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  className="w-12 px-2 py-1 text-center border border-gray-300 rounded-md text-sm"
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>
              
              <button
                onClick={nextPage}
                disabled={!hasNextPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={!hasNextPage}
                className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// The rest of your ResultsTable component remains the same...
// Keep all the export functions and the main ResultsTable function as they are
// Only replace the LikesTable and CommentsTable components above

export default function ResultsTable({ data }: ResultsTableProps) {
  const [activeTab, setActiveTab] = useState<'likes' | 'comments' | 'post'>('likes');

  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        `"${String(cell || '').replace(/"/g, '""')}"`
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportLikes = () => {
    const headers = ['Name', 'Profile URL', 'Title', 'Company', 'Location', 'Liked At'];
    const rows = data.likes.map(like => {
      let title = like.headline || '';
      let company = '';
      
      if (like.headline) {
        const atIndex = like.headline.indexOf(' at ');
        if (atIndex > -1) {
          title = like.headline.substring(0, atIndex).trim();
          company = like.headline.substring(atIndex + 4).split(' · ')[0].trim();
        }
      }
      
      return [
        like.name || '',
        like.profileUrl || '',
        title,
        company,
        like.location || '',
        like.likedAt || ''
      ];
    });
    downloadCSV(`linkedin-likes-${Date.now()}.csv`, headers, rows);
  };

  const exportComments = () => {
    const headers = ['Name', 'Profile URL', 'Title', 'Company', 'Comment', 'Likes', 'Commented At'];
    const rows = data.comments.map(comment => {
      let title = comment.headline || '';
      let company = '';
      
      if (comment.headline) {
        const atIndex = comment.headline.indexOf(' at ');
        if (atIndex > -1) {
          title = comment.headline.substring(0, atIndex).trim();
          company = comment.headline.substring(atIndex + 4).split(' · ')[0].trim();
        }
      }
      
      return [
        comment.name || '',
        comment.profileUrl || '',
        title,
        company,
        comment.comment || '',
        comment.likesCount || 0,
        comment.commentedAt || ''
      ];
    });
    downloadCSV(`linkedin-comments-${Date.now()}.csv`, headers, rows);
  };

  const exportAll = () => {
    const headers = ['Type', 'Name', 'Profile URL', 'Title', 'Company', 'Content/Location', 'Likes', 'Timestamp'];
    const likeRows = data.likes.map(like => {
      let title = like.headline || '';
      let company = '';
      
      if (like.headline) {
        const atIndex = like.headline.indexOf(' at ');
        if (atIndex > -1) {
          title = like.headline.substring(0, atIndex).trim();
          company = like.headline.substring(atIndex + 4).split(' · ')[0].trim();
        }
      }
      
      return [
        'Like',
        like.name || '',
        like.profileUrl || '',
        title,
        company,
        like.location || '',
        '',
        like.likedAt || ''
      ];
    });
    
    const commentRows = data.comments.map(comment => {
      let title = comment.headline || '';
      let company = '';
      
      if (comment.headline) {
        const atIndex = comment.headline.indexOf(' at ');
        if (atIndex > -1) {
          title = comment.headline.substring(0, atIndex).trim();
          company = comment.headline.substring(atIndex + 4).split(' · ')[0].trim();
        }
      }
      
      return [
        'Comment',
        comment.name || '',
        comment.profileUrl || '',
        title,
        company,
        comment.comment || '',
        comment.likesCount || 0,
        comment.commentedAt || ''
      ];
    });
    
    downloadCSV(`linkedin-engagement-${Date.now()}.csv`, headers, [...likeRows, ...commentRows]);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('post')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'post'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Post Information
            </button>
            <button
              onClick={() => setActiveTab('likes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'likes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Likes ({data.likes.length})
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'comments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Comments ({data.comments.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Post Info Tab */}
        {activeTab === 'post' && data.post && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-6 rounded-xl border border-blue-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">
                        {data.post.author?.split(' ').map(n => n[0]).join('').toUpperCase() || 'NA'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{data.post.author || 'Unknown Author'}</h3>
                      {data.post.authorProfileUrl && (
                        <a
                          href={data.post.authorProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View LinkedIn Profile
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">Posted</div>
                      <div className="text-gray-900 font-medium">
                        {data.post.postedAt ? format(new Date(data.post.postedAt), 'PPP') : 'N/A'}
                      </div>
                      {data.post.postedAt && (
                        <div className="text-sm text-gray-500">
                          {format(new Date(data.post.postedAt), 'hh:mm a')}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">Post URL</div>
                      {data.post.postUrl ? (
                        <a
                          href={data.post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm break-all block truncate"
                        >
                          {data.post.postUrl}
                        </a>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-500 mb-2">Content Preview</div>
                    <div className="text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {data.post.content || 'No content available'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600">{data.post.likesCount || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Likes</div>
              </div>
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-indigo-600">{data.post.commentsCount || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Comments</div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{data.likes.length}</div>
                <div className="text-sm text-gray-600 mt-1">Scraped Likes</div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-600">{data.comments.length}</div>
                <div className="text-sm text-gray-600 mt-1">Scraped Comments</div>
              </div>
            </div>
          </div>
        )}

        {/* Likes Tab */}
        {activeTab === 'likes' && <LikesTable data={data.likes} />}

        {/* Comments Tab */}
        {activeTab === 'comments' && <CommentsTable data={data.comments} />}
      </div>

      {/* Export Options */}
      <div className="border-t border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-900">Scraped using authenticated LinkedIn cookies</div>
            <div>Scraped at: {format(new Date(data.scrapedAt), 'PPP pp')}</div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportLikes}
              disabled={data.likes.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Likes ({data.likes.length})
            </button>
            <button
              onClick={exportComments}
              disabled={data.comments.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Comments ({data.comments.length})
            </button>
            <button
              onClick={exportAll}
              disabled={data.likes.length === 0 && data.comments.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}