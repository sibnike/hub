export type MarketplaceMemberStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type MarketplaceMemberRow = {
  id: string
  marketplace_id: string
  tenant_id: string
  status: MarketplaceMemberStatus
  requested_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string | null
  created_at: string
}

export type MarketplaceMemberWithTenant = MarketplaceMemberRow & {
  tenant: { id: string; name: string; slug: string } | null
}

export type AdminMemberPatchAction = 'approve' | 'reject' | 'suspend'
