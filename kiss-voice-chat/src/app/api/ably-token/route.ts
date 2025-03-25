import { NextRequest, NextResponse } from 'next/server';
import * as Ably from 'ably/promises';

export async function GET(request: NextRequest) {
  const client = new Ably.Rest(process.env.ABLY_API_KEY || 'REPLACE_WITH_YOUR_ABLY_API_KEY');
  const tokenParams = { clientId: Math.random().toString(36).substring(2, 15) };
  
  try {
    const tokenRequest = await client.auth.createTokenRequest(tokenParams);
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Error creating Ably token request:', error);
    return NextResponse.json({ error: 'Error creating Ably token request' }, { status: 500 });
  }
}
