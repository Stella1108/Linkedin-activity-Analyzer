// app/api/test/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: {
      hasCookie: !!process.env.LINKEDIN_LI_AT_COOKIE,
      cookieLength: process.env.LINKEDIN_LI_AT_COOKIE?.length || 0,
      nodeEnv: process.env.NODE_ENV
    }
  });
}