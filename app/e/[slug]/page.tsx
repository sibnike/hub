import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export default function EventRootPage({ params }: PageProps) {
  redirect(`/e/${params.slug}/catalog`)
}
