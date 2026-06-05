type PublicEventPageProps = {
  params: { slug: string }
}

export default function PublicEventPage({ params }: PublicEventPageProps) {
  const { slug } = params

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <h1 className="text-2xl font-semibold">Public: {slug}</h1>
    </main>
  )
}
