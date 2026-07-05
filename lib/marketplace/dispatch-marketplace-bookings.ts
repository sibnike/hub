import { randomUUID } from 'crypto'
import {
  createVitrinaHubSubmission,
  type VitrinaSubmissionField,
} from '@/lib/integrations/vitrina-submissions'
import { getHubMarketplaceSourceUrl } from '@/lib/integrations/vitrina-ingest'
import type {
  BookingDispatchResult,
  CartItemInput,
  GuidedSearchParams,
} from '@/types/marketplace-guided-search'

export type DispatchMarketplaceBookingsInput = {
  marketplaceSlug: string
  requesterTenantId: string
  requesterName: string
  requesterContact: string
  params: GuidedSearchParams
  items: CartItemInput[]
}

function buildBookingFields(input: {
  item: CartItemInput
  params: GuidedSearchParams
  requesterName: string
  requesterContact: string
}): VitrinaSubmissionField[] {
  const fields: VitrinaSubmissionField[] = [
    { key: 'requester_name', label: 'Заявитель', value: input.requesterName },
    { key: 'requester_contact', label: 'Контакт', value: input.requesterContact },
    { key: 'page_slug', label: 'Страница', value: input.item.page_slug },
    { key: 'listing_title', label: 'Предложение', value: input.item.title },
  ]

  const dateFrom = input.item.date_from ?? input.params.date_from
  const dateTo = input.item.date_to ?? input.params.date_to ?? dateFrom
  const people = input.item.people ?? input.params.people

  if (dateFrom) {
    fields.push({ key: 'date_from', label: 'Дата с', value: dateFrom })
  }
  if (dateTo && dateTo !== dateFrom) {
    fields.push({ key: 'date_to', label: 'Дата по', value: dateTo })
  } else if (dateFrom) {
    fields.push({ key: 'requested_date', label: 'Дата', value: dateFrom })
  }

  if (people != null) {
    fields.push({ key: 'people', label: 'Количество', value: String(people) })
  }

  if (input.params.city) {
    fields.push({ key: 'city', label: 'Город', value: input.params.city })
  }

  if (input.params.notes) {
    fields.push({ key: 'notes', label: 'Примечания', value: input.params.notes })
  }

  return fields
}

export async function dispatchMarketplaceBookings(
  input: DispatchMarketplaceBookingsInput
): Promise<{ results: BookingDispatchResult[]; booked_count: number }> {
  const sourceUrl = getHubMarketplaceSourceUrl()
  const results: BookingDispatchResult[] = []
  let bookedCount = 0

  for (const item of input.items) {
    const externalId = `mkt-book-${randomUUID()}`

    try {
      const vitrina = await createVitrinaHubSubmission({
        externalId,
        tenantSlug: item.tenant_slug,
        title: `Бронирование с маркетплейса: ${item.title}`,
        fields: buildBookingFields({
          item,
          params: input.params,
          requesterName: input.requesterName,
          requesterContact: input.requesterContact,
        }),
        metadata: {
          source_type: 'marketplace',
          source_partner: input.marketplaceSlug,
          requester_tenant_id: input.requesterTenantId,
          marketplace_slug: input.marketplaceSlug,
          listing_id: item.listing_id,
          page_slug: item.page_slug,
          source_url: `${sourceUrl.replace(/\/marketplace$/, '')}/m/${input.marketplaceSlug}`,
        },
      })

      bookedCount += 1
      results.push({
        listing_id: item.listing_id,
        tenant_slug: item.tenant_slug,
        page_slug: item.page_slug,
        ok: true,
        submission_id: vitrina.submission_id,
        duplicate: vitrina.duplicate,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Booking failed'
      console.error('[dispatchMarketplaceBookings]', item.listing_id, message)
      results.push({
        listing_id: item.listing_id,
        tenant_slug: item.tenant_slug,
        page_slug: item.page_slug,
        ok: false,
        error: message,
      })
    }
  }

  return { results, booked_count: bookedCount }
}
