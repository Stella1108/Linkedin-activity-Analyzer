import { NextRequest, NextResponse } from 'next/server';

const VPS_API_URL = 'http://76.13.101.148:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying analyze request to VPS:', { url: body.url, maxLikes: body.maxLikes });
    
    const response = await fetch(`${VPS_API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VPS error response:', errorText);
      return NextResponse.json(
        { success: false, error: `VPS error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy error for analyze:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to VPS: ' + error.message },
      { status: 503 }
    );
  }
}