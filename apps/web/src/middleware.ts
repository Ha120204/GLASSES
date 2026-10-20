import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = ['/login'];

export function middleware(request: NextRequest): NextResponse {
  const isPublic = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  const hasToken = Boolean(request.cookies.get('access_token')?.value);
  if (!hasToken && !isPublic) return NextResponse.redirect(new URL('/login', request.url));
  if (hasToken && request.nextUrl.pathname === '/login')
    return NextResponse.redirect(new URL('/', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
