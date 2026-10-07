import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui'
import { LEGAL_CONTACT_EMAIL, LEGAL_UPDATED_LABEL } from '@/lib/legal'

// Shared chrome for the public Privacy Policy and Terms pages: readable
// single-column text, reachable signed in or out.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto max-w-[760px] px-5 py-5 sm:px-8">
        <Logo compact />
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-5 pb-16 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="display text-[clamp(40px,6vw,56px)]">{title}</h1>
          <p className="text-sm text-muted">Last updated {LEGAL_UPDATED_LABEL}</p>
        </div>
        {children}
      </main>
      <LegalFooter />
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function ContactEmail() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-accent-text">
      {LEGAL_CONTACT_EMAIL}
    </a>
  )
}

export function LegalLinks() {
  return (
    <nav aria-label="Legal" className="flex gap-4">
      <Link href="/privacy" className="hover:text-ink">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-ink">
        Terms
      </Link>
    </nav>
  )
}

function LegalFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto flex max-w-[760px] flex-wrap justify-between gap-3 px-5 py-6 text-sm text-muted sm:px-8">
        <Link href="/" className="hover:text-ink">
          NIL Copilot
        </Link>
        <LegalLinks />
      </div>
    </footer>
  )
}
