import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function InvalidInvite({ slug, reason }: { slug: string; reason: 'inactive' | 'invalid' }) {
  const message =
    reason === 'inactive'
      ? 'Регистрация по этой ссылке закрыта.'
      : 'Ссылка-приглашение недействительна или устарела.'

  return (
    <div className="container max-w-md py-16">
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Нет доступа</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            Обратитесь к организатору выставки для получения новой ссылки.
          </p>
          <Button render={<Link href={`/e/${slug}`} />}>На главную события</Button>
        </CardContent>
      </Card>
    </div>
  )
}
