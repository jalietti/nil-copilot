import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client: bypasses RLS. Server-side only (Inngest jobs writing
// the brands cache, discovery run updates). Never import from client code.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
