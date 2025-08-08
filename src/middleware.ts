import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // If user is logged in and on the homepage, redirect to dashboard
  if (session && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If user is not logged in and tries to access dashboard, redirect to homepage
  if (!session && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
