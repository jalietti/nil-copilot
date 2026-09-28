import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'
import { DeleteAccount } from './delete-account'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, school, sport, division, instagram_followers, tiktok_followers, other_followers, citizenship_status',
    )
    .eq('id', user.id)
    .single()

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Account</h1>
        <p className="text-sm text-neutral-600">Signed in as {user.email}</p>
      </div>

      <section>
        <h2 className="mb-1 font-medium">Your profile</h2>
        <p className="mb-4 text-sm text-neutral-600">
          Keep follower counts current — they shape what the copilot asks brands for. Your answers
          about interests and deals live in the{' '}
          <Link href="/interview" className="underline">
            interview
          </Link>
          .
        </p>
        {profile && <ProfileForm userId={user.id} mode="edit" initial={profile} />}
      </section>

      <section className="text-sm text-neutral-700">
        <h2 className="mb-2 font-medium">What NIL Copilot stores about you</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your profile: name, school, sport, follower counts, and citizenship/visa status</li>
          <li>Your interview answers and the voice profile made from them</li>
          <li>Your brand matches, deals, drafted emails, and brand replies you pasted in</li>
        </ul>
        <p className="mt-2">
          Other athletes never see any of it. Nothing is sent to a brand unless you send it
          yourself.
        </p>
      </section>

      <DeleteAccount />
    </main>
  )
}
