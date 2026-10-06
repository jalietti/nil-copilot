import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { count: matchesToReview }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('brand_matches')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', user.id)
      .eq('status', 'suggested'),
  ])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar name={profile?.full_name ?? ''} matchesToReview={matchesToReview ?? 0} />
      <div className="min-w-0 grow px-5 pt-8 pb-16 sm:px-8 lg:px-12 lg:pt-10">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </div>
    </div>
  )
}
