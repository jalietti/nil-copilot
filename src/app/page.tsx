import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">NIL Copilot</h1>
      <p className="text-neutral-600">
        Find brands that actually fit who you are, draft the outreach, and negotiate with a
        copilot in your corner. You&apos;re always the one who hits send.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className="rounded bg-black px-4 py-2 text-white">
          Get started
        </Link>
        <Link href="/login" className="rounded border border-neutral-300 px-4 py-2">
          Log in
        </Link>
      </div>
    </main>
  )
}
