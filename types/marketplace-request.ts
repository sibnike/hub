import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

/** Structured AI output for marketplace request (flow 3a). */
export type MarketplaceRequestParsed = {
  search: MarketplaceSearchFilter
  requested_date: string | null
  quantity: string | null
  requester_proposed_price: number | null
}

export type MarketplaceRequestStatus = 'open' | 'closed'

export type MarketplaceRequestTargetStatus =
  | 'sent'
  | 'viewed'
  | 'responded'
  | 'declined'
  | 'selected'

export type MarketplaceRequestRow = {
  id: string
  requester_name: string
  requester_contact: string
  request_text: string
  ai_parsed: MarketplaceRequestParsed | null
  access_token: string
  status: MarketplaceRequestStatus
  created_at: string
}

export type MarketplaceRequestTargetRow = {
  id: string
  request_id: string
  tenant_id: string
  vitrina_submission_id: string | null
  status: MarketplaceRequestTargetStatus
  proposed_price: number | null
  response_message: string | null
  responded_at: string | null
  created_at: string
}

export type MatchedRequestTenant = {
  tenant_id: string
  tenant_slug: string | null
  tenant_name: string | null
  rank: number
  source: 'company' | 'listing' | 'both'
}

export type CreateMarketplaceRequestInput = {
  requester_name: string
  requester_contact: string
  request_text: string
  target_limit?: number
}

export type DispatchTargetResult = {
  target_id: string
  tenant_id: string
  tenant_slug: string | null
  ok: boolean
  vitrina_submission_id?: string
  duplicate?: boolean
  error?: string
}

export type CreateMarketplaceRequestResult = {
  request: MarketplaceRequestRow
  targets: MarketplaceRequestTargetRow[]
  matched_count: number
  parsed: MarketplaceRequestParsed
  parsed_by_ai: boolean
  dispatched_count: number
  dispatch_results: DispatchTargetResult[]
}
