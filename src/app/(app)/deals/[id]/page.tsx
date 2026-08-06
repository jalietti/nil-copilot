import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Brand, Deal, Message } from '@/lib/supabase/types'
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

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: true })

  const brand = deal.brands

  return (
    <main>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{brand.name}</h1>
        <span className="rounded bg-neutral-100 px-2 py-1 text-xs uppercase tracking-wide">
          {deal.status.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="mb-6 text-sm text-neutral-600">
        The copilot drafts; you always review and hit send from your own email. Nothing is ever
        sent for you.
      </p>
      <DealThread
        dealId={deal.id}
        dealStatus={deal.status}
        brandName={brand.name}
        contactEmail={brand.contact_email}
        messages={(messages ?? []) as Message[]}
      />
    </main>
  )
}
