import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/sign-out-button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="font-medium">
            Dashboard
          </Link>
          <Link href="/brands">Brands</Link>
          <Link href="/interview">Interview</Link>
          <Link href="/account">Account</Link>
        </nav>
        <SignOutButton />
      </header>
      {children}
    </div>
  )
}
