import Link from 'next/link'
import { Logo, buttonClass, cardClass } from '@/components/ui'
import { MailIcon, LockIcon, GlobeIcon } from '@/components/icons'
import { LegalLinks } from '@/components/legal-page'

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo compact />
        <nav aria-label="Account" className="flex gap-2">
          <Link href="/login" className={buttonClass({ variant: 'ghost' })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass({ variant: 'primary' })}>
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-5 py-14 sm:px-8 sm:py-16">
          <div className="flex min-w-0 flex-1 basis-[480px] flex-col gap-6">
            <span className="eyebrow self-start rounded-full bg-surface-2 px-3 py-1.5 font-sans !text-[13px] !font-semibold !tracking-normal !text-muted normal-case">
              Invite-only pilot
            </span>
            <h1 className="display text-[clamp(56px,8vw,96px)]">
              NIL deals that fit who you are.
            </h1>
            <p className="max-w-[520px] text-[19px] leading-relaxed text-muted">
              Your copilot finds brands you actually care about, drafts the outreach, and helps
              you negotiate. You send every email yourself.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass({ variant: 'primary', size: 'lg' })}>
                Get started
              </Link>
              <Link href="/login" className={buttonClass({ variant: 'secondary', size: 'lg' })}>
                Log in
              </Link>
            </div>
            <span className="text-sm text-muted">Setup takes about 4 minutes.</span>
          </div>

          <div
            aria-hidden="true"
            className="flex min-w-0 flex-1 basis-[420px] flex-col gap-3.5 max-w-[520px]"
          >
            <div
              className={`${cardClass} flex flex-col gap-3 p-5 shadow-[0_12px_32px_rgba(22,33,42,0.08)]`}
            >
              <div className="flex items-center gap-3">
                <span className="display grid size-11 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-lg">
                  RS
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-[16px]">Ridgeline Supply Co.</strong>
                  <span className="text-[13px] text-muted">Recycled trail gear</span>
                </div>
                <span className="eyebrow shrink-0 rounded-full bg-accent-soft px-2 py-1 !text-accent-text">
                  New match
                </span>
              </div>
              <div className="rounded-[10px] bg-surface-2 px-3.5 py-3 text-sm leading-relaxed">
                <span className="eyebrow mb-1 block !text-[11px]">Why it fits you</span>
                You named sustainable outdoor gear and trail running.
              </div>
            </div>
            <div
              className={`${cardClass} ml-10 flex flex-col gap-3 p-5 shadow-[0_12px_32px_rgba(22,33,42,0.08)]`}
            >
              <span className="text-[13px] text-muted">Draft · edited by you</span>
              <span className="h-2.5 w-[92%] rounded-md bg-surface-2" />
              <span className="h-2.5 w-[80%] rounded-md bg-surface-2" />
              <span className="h-2.5 w-[86%] rounded-md bg-surface-2" />
              <span className="h-2.5 w-[54%] rounded-md bg-surface-2" />
              <span className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-semibold text-accent-ink">
                Open in my email
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 pb-16 sm:px-8">
          <h2 id="how" className="display text-[44px]">
            How it works
          </h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <li className={`${cardClass} flex flex-col gap-3 p-7`}>
              <span className="display text-[56px] text-accent-text">01</span>
              <h3 className="text-xl font-semibold">Tell us who you are</h3>
              <p className="leading-relaxed text-muted">
                A 4-minute interview: your sport, what you&apos;re into, and what a deal is worth
                to you.
              </p>
            </li>
            <li className={`${cardClass} flex flex-col gap-3 p-7`}>
              <span className="display text-[56px] text-accent-text">02</span>
              <h3 className="text-xl font-semibold">Get brands that fit</h3>
              <p className="leading-relaxed text-muted">
                Your copilot researches the live web for brands that match you, not the same
                protein powder everyone sees.
              </p>
            </li>
            <li className={`${cardClass} flex flex-col gap-3 p-7`}>
              <span className="display text-[56px] text-accent-text">03</span>
              <h3 className="text-xl font-semibold">Send it yourself</h3>
              <p className="leading-relaxed text-muted">
                It drafts the pitch and the counter. You tweak it, open it in your own email, and
                hit send.
              </p>
            </li>
          </ol>
        </section>

        <section aria-labelledby="promise" className="bg-band text-band-ink">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-12 px-5 py-20 sm:px-8">
            <h2
              id="promise"
              className="display flex-1 basis-[380px] text-[clamp(48px,6vw,72px)]"
            >
              We draft.
              <br />
              You send.
              <br />
              Always.
            </h2>
            <ul className="flex flex-1 basis-[420px] flex-col gap-6">
              <li className="flex gap-3.5">
                <MailIcon size={24} className="mt-0.5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <strong className="text-lg">From your own inbox</strong>
                  <span className="leading-relaxed text-band-muted">
                    Every email opens in your email app. Nothing goes out unless you click send.
                  </span>
                </span>
              </li>
              <li className="flex gap-3.5">
                <LockIcon size={24} className="mt-0.5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <strong className="text-lg">We never read your inbox</strong>
                  <span className="leading-relaxed text-band-muted">
                    You paste in the replies you want help with. That&apos;s it.
                  </span>
                </span>
              </li>
              <li className="flex gap-3.5">
                <GlobeIcon size={24} className="mt-0.5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <strong className="text-lg">International athletes, covered up front</strong>
                  <span className="leading-relaxed text-band-muted">
                    Visa guidance before your first pitch, and a reminder to check with your DSO
                    before you agree to anything.
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-5 py-20 text-center sm:px-8">
          <h2 className="display text-[clamp(44px,6vw,64px)]">
            Your next deal starts with one email.
          </h2>
          <p className="text-lg text-muted">
            Setup takes about 4 minutes. Then one click starts your first brand search.
          </p>
          <Link href="/signup" className={buttonClass({ variant: 'primary', size: 'lg' })}>
            Get started
          </Link>
        </section>
      </main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-5 py-6 text-sm text-muted sm:px-8">
          <span>Made by a Bronco.</span>
          <span>NIL Copilot gives general information, not legal or tax advice.</span>
          <LegalLinks />
        </div>
      </footer>
    </div>
  )
}
