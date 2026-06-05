import { BarChart3 } from 'lucide-react'

export function AnalyticsEmptyState({ message = 'Пока нет данных' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
