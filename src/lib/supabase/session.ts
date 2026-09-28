import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

// Refreshes the auth session on every request. Called from src/proxy.ts
// (Next 16's replacement for middleware.ts). `forwardHeaders` are added to the
// request passed on to rendering (the CSP nonce); they're applied after any
// refreshed session cookies so those still reach server components.
export async function updateSession(
  request: NextRequest,
  forwardHeaders: Record<string, string> = {},
) {
  const next = () => {
    const headers = new Headers(request.headers)
    for (const [key, value] of Object.entries(forwardHeaders)) headers.set(key, value)
    return NextResponse.next({ request: { headers } })
  }
  let response = next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = next()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and getUser() — a bug here
  // makes sessions randomly drop.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/auth')

  // API routes authenticate themselves (e.g. Inngest verifies its own signing
  // key) and must never be bounced to the HTML login page — doing so would make
  // the background-job endpoint unreachable from Inngest's servers.
  const isApiRoute = pathname.startsWith('/api')

  if (!user && !isAuthRoute && !isApiRoute && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
