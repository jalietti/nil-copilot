import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Brand, Deal, Message } from '@/lib/supabase/types'
import { dealVisaReminder } from '@/lib/visa-guidance'
import { DealThread } from './deal-thread'

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: dealRow } = await supabase
    .from('deals')
    .select('*, brands(*)')
    .eq('id', id)
    .maybeSingle()
  if (!dealRow) notFound()
  const deal = dealRow as unknown as Deal & { brands: Brand }

  const [{ data: messages }, { data: match }, { data: profile }] = await Promise.all([
    supabase.from('messages').select('*').eq('deal_id', id).order('created_at', { ascending: true }),
    supabase
      .from('brand_matches')
      .select('contact_email')
      .eq('athlete_id', user.id)
      .eq('brand_id', deal.brand_id)
      .maybeSingle(),
    supabase.from('profiles').select('citizenship_status').eq('id', user.id).single(),
  ])
  const visaReminder = dealVisaReminder(profile?.citizenship_status ?? null, deal.status)

  const brand = deal.brands

  return (
    <DealThread
      dealId={deal.id}
      dealStatus={deal.status}
      brandName={brand.name}
      domain={brand.domain}
      contactEmail={match?.contact_email ?? brand.contact_email}
      messages={(messages ?? []) as Message[]}
      visaReminder={visaReminder}
    />
  )
}
