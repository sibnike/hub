'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PERIODS = [
  { label: '7д', value: 7 },
  { label: '30д', value: 30 },
  { label: '90д', value: 90 },
  { label: 'Всё время', value: 0 },
] as const

export function PeriodFilter({
  value,
  onChange,
}: {
  value: number
  onChange: (days: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {PERIODS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={value === p.value ? 'default' : 'outline'}
          className={cn(value === p.value && 'pointer-events-none')}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  )
}
