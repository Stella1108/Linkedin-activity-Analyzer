// LinkedIn data types
export interface LinkedInProfileData {
  id: number;
  name: string;
  li_at: string;
  jsessionid?: string;
  bcookie?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface LikeData {
  name: string;
  profileUrl: string;
  headline: string;
  location?: string;
  connectionLevel?: string;
  likedAt?: string;
}

export interface CommentData {
  name: string;
  profileUrl: string;
  headline: string;
  comment: string;
  commentedAt?: string;
  likesCount?: number;
}

export interface PostData {
  author: string;
  authorProfileUrl: string;
  content: string;
  postUrl: string;
  postedAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    post?: PostData;
    likes: LikeData[];
    comments: CommentData[];
    profileUrl: string;
    scrapedAt: string;
  };
  error?: string;
  message?: string;
}

export interface AnalysisRequest {
  url: string;
  type: 'profile' | 'post';
  scrapeLikes: boolean;
  scrapeComments: boolean;
}

// Cookie parameter type for Puppeteer
export interface CookieParam {
  name: string;
  value: string;
  domain?: string;
  url?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}