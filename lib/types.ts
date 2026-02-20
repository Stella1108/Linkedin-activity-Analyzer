export interface LikeData {
  name: string;
  profileUrl?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  connectionDegree?: string;
  connectionLevel?: number;
  likedAt: string;
  postAuthor: string;
  postContent: string;
}

export interface CommentData {
  name: string;
  profileUrl?: string;
  jobTitle?: string;
  company?: string;
  commentText: string;
  commentedAt: string;
  postAuthor: string;
  postContent: string;
}

export interface PostData {
  author: string;
  authorProfileUrl?: string;
  content: string;
  postUrl?: string;
  postedAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface LinkedInProfileData {
  li_at: string;
  name?: string;
  email?: string;
  is_active?: boolean;
  updated_at?: string;
  last_used?: string;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    likes: LikeData[];
    comments: CommentData[];
    profileUrl: string;
    scrapedAt: string;
    posts: PostData[];
    post?: PostData;
  };
  message?: string;
  error?: string;
  duration?: string;
  timestamp?: string;
  statistics?: {
    total_profiles: number;
    total_comments: number;
    total_posts: number;
  };
  sample?: any[];
}

export interface AnalysisRequest {
  url: string;
  type?: 'post' | 'profile' | 'auto';
  maxLikes?: number;
  maxComments?: number;
  keepOpen?: boolean;
  format?: 'json' | 'csv';
}

export interface CookieStatus {
  hasCookies: boolean;
  message: string;
  lastUpdated: string | null;
  cookieName?: string;
  cookieCount?: number;
}

export interface AnalysisProgress {
  message: string;
  step: number;
  totalSteps: number;
  currentUrl: string;
  browserVisible: boolean;
}

export interface AnalysisHistoryItem {
  id: string;
  created_at: string;
  profile_url: string;
  profile_name?: string;
  type?: string;
  success: boolean;
  likes_count?: number;
  comments_count?: number;
  posts_count?: number;
}

export interface ResultsTableData {
  likes: LikeData[];
  comments: CommentData[];
  posts: PostData[];
  post?: PostData;
}