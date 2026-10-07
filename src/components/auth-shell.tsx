import type { ReactNode } from 'react'
import { Logo, cardClass } from '@/components/ui'

// Shared chrome for every public auth page: full-height page, logo top-left,
// a centered card. Keeps login/signup/forgot/reset visually identical.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="px-6 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className={`flex w-full max-w-[440px] flex-col gap-6 ${cardClass} p-8`}>
          <div className="flex flex-col gap-2">
            <h1 className="display text-[36px]">{title}</h1>
            {subtitle && <p className="text-[15px] leading-relaxed text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
