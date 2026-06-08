import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type PageProps = { params: { slug: string } }

export default function InvalidLinkPage({ params }: PageProps) {
  return (
    <div className="container max-w-md py-16">
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Ссылка недействительна</h1>
          <p className="text-sm text-muted-foreground">
            Ссылка подтверждения устарела или уже была использована.
          </p>
          <Button render={<Link href={`/e/${params.slug}`} />}>На главную события</Button>
        </CardContent>
      </Card>
    </div>
  )
}
