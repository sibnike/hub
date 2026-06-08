import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export function InviteRequired({ slug }: { slug: string }) {
  return (
    <div className="container max-w-lg py-16">
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Доступ по приглашению</h1>
          <p className="text-sm text-muted-foreground">
            Для просмотра каталога и карты выставки необходимо получить ссылку-приглашение от
            организатора.
          </p>
          <p className="text-sm text-muted-foreground">
            Если у вас уже есть ссылка — перейдите по ней для регистрации.
          </p>
          <Link href={`/e/${slug}/guide`} className="text-sm text-primary hover:underline">
            Уже зарегистрированы? Войти в гайд
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
