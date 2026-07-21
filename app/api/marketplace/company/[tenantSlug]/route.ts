import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Next.js 14 caches GET handlers and Supabase fetch() — profile must be live after Vitrina sync. */
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type RouteParams = { params: { tenantSlug: string } }

/** Public read: company_cache snapshot for TourHub seller profile (live mode). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const tenantSlug = params.tenantSlug?.trim()
  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 })
  }
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { data: company, error: companyError } = await supabase
    .schema('hub')
    .from('company_cache')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 })
  }
  if (!company) {
    return NextResponse.json({ error: 'Company cache not found' }, { status: 404 })
  }

  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    company,
  })
}
