import type { NextRequest } from 'next/server'
import { buildCsp, generateNonce } from '@/lib/csp'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
  // Next reads the nonce from the request's CSP header while rendering and
  // stamps it on its scripts; the browser enforces the response header.
  const response = await updateSession(request, { 'Content-Security-Policy': csp, 'x-nonce': nonce })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
