'use client'

import { Button } from '@/components/ui/button'
import type { MapStandRow } from '@/types/map'

type QrPrintGridProps = {
  eventSlug: string
  stands: MapStandRow[]
}

const PAGE_SIZE = 9

function standName(stand: MapStandRow): string {
  return stand.cache?.name ?? stand.stand_number ?? 'Стенд'
}

export function QrPrintGrid({ eventSlug, stands }: QrPrintGridProps) {
  const pages: MapStandRow[][] = []
  for (let i = 0; i < stands.length; i += PAGE_SIZE) {
    pages.push(stands.slice(i, i + PAGE_SIZE))
  }

  return (
    <>
      <div className="no-print">
        <Button onClick={() => window.print()}>Печать</Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Или «Сохранить как PDF» в диалоге печати браузера
        </p>
      </div>

      {pages.map((pageStands, pageIndex) => (
        <div
          key={pageIndex}
          className={`qr-page qr-grid grid grid-cols-3 gap-6 ${pageIndex < pages.length - 1 ? 'page-break' : ''}`}
        >
          {pageStands.map((stand) => (
            <div key={stand.id} className="qr-cell flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/organizer/events/${eventSlug}/qr/${stand.id}`}
                alt={`QR ${stand.stand_number ?? stand.id}`}
                className="qr-image"
                width={189}
                height={189}
              />
              <p className="mt-2 text-sm font-semibold leading-tight">{standName(stand)}</p>
              {stand.stand_number ? (
                <p className="text-xs text-muted-foreground">Стенд {stand.stand_number}</p>
              ) : null}
              {stand.pavilion ? (
                <p className="text-xs text-muted-foreground">{stand.pavilion}</p>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      <style jsx global>{`
        .qr-image {
          width: 5cm;
          height: 5cm;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .qr-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .qr-cell {
            break-inside: avoid;
          }

          .page-break {
            page-break-after: always;
          }

          @page {
            size: A4;
            margin: 1.5cm;
          }
        }
      `}</style>
    </>
  )
}
