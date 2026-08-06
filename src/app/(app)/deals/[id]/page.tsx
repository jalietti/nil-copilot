export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">Deal</h1>
      <p className="text-sm text-neutral-600">
        Outreach drafting for deal {id} lands here. (Built in step 7.)
      </p>
    </main>
  )
}
