import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The interview is now step 3-4 of /onboarding. This route only redirects:
// no interview row yet means onboarding never finished it, otherwise send
// athletes to the editable copy on the Account page.
export default async function InterviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: interview } = await supabase
    .from('interviews')
    .select('id')
    .eq('athlete_id', user.id)
    .maybeSingle()

  redirect(interview ? '/account#interview' : '/onboarding')
}
