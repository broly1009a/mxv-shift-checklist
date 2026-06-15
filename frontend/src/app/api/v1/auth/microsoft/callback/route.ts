import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // NextJS Frontend reads the API URL from environment variables
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  // Construct redirect URL to the backend's Microsoft callback endpoint
  const redirectUrl = new URL(`${backendUrl}/api/v1/auth/microsoft/callback`);
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);
  if (error_description) redirectUrl.searchParams.set('error_description', error_description);

  return NextResponse.redirect(redirectUrl.toString());
}
