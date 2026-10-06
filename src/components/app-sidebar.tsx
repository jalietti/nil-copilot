'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, HomeIcon, TargetIcon } from './icons'
import { SignOutButton } from './sign-out-button'
import { Logo } from './ui'

// Two destinations only (Hick's law): Home holds the whole pipeline, Brands
// finds new ones. Account lives behind the avatar. On narrow screens the
// sidebar becomes a top bar.

const NAV = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon, match: ['/dashboard', '/deals'] },
  { href: '/brands', label: 'Brands', Icon: TargetIcon, match: ['/brands'] },
]

const navItem =
  'flex h-11 items-center gap-2 rounded-[10px] px-2.5 text-[15px] md:gap-3 md:px-3 font-medium text-muted hover:bg-surface-2 hover:text-ink'

export function AppSidebar({ name, matchesToReview }: { name: string; matchesToReview: number }) {
  const pathname = usePathname()
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line-soft bg-surface px-4 py-3 md:sticky md:top-0 md:h-screen md:w-[232px] md:flex-col md:flex-nowrap md:items-stretch md:border-r md:border-b-0 md:px-3.5 md:py-5"
    >
      <div className="mr-auto pr-1 md:mr-0 md:px-2.5 md:pb-5">
        <Logo href="/dashboard" compact />
      </div>
      {NAV.map(({ href, label, Icon, match }) => {
        const active = match.some((m) => pathname.startsWith(m))
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`${navItem} ${active ? 'bg-surface-2 font-semibold text-ink' : ''}`}
          >
            <Icon />
            <span className="md:grow">{label}</span>
            {href === '/brands' && matchesToReview > 0 && (
              <span
                className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted"
                aria-label={`${matchesToReview} matches to review`}
              >
                {matchesToReview}
              </span>
            )}
          </Link>
        )
      })}
      <div className="hidden grow md:block" />
      <AccountMenu name={name} initials={initials} />
    </nav>
  )
}

function AccountMenu({ name, initials }: { name: string; initials: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`${navItem} w-full`}
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-wait-soft text-xs font-bold text-wait">
          {initials}
        </span>
        <span className="hidden grow truncate text-left text-ink md:block">{name || 'Account'}</span>
        <ChevronDownIcon size={16} className="hidden md:block" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line-soft bg-surface p-1.5 shadow-lg md:right-auto md:bottom-full md:left-0 md:mt-0 md:mb-1"
        >
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className={`${navItem} w-full`}>
            Profile &amp; account
          </Link>
          <SignOutButton className={`${navItem} w-full`} />
        </div>
      )}
    </div>
  )
}
