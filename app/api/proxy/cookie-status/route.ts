import { NextResponse } from 'next/server';

const VPS_API_URL = 'http://76.13.101.148:3000';

export async function GET() {
  try {
    console.log('Proxying cookie-status request to VPS...');
    
    const response = await fetch(`${VPS_API_URL}/api/cookie-status`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`VPS responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy error for cookie-status:', error);
    return NextResponse.json(
      { 
        hasCookies: false, 
        message: 'Failed to connect to VPS: ' + error.message,
        cookieCount: 0 
      },
      { status: 503 }
    );
  }
}