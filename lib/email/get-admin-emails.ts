import { createAdminClient } from '@/lib/supabase/admin'

export async function getPlatformAdminEmails(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: rows } = await supabase.from('platform_admins').select('user_id')
  if (!rows?.length) return []

  const emails: string[] = []
  for (const row of rows) {
    const { data } = await supabase.auth.admin.getUserById(row.user_id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return emails
}

export async function getTenantAdminEmails(tenantId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('tenant_admins')
    .select('user_id')
    .eq('tenant_id', tenantId)

  if (!rows?.length) return []

  const emails: string[] = []
  for (const row of rows) {
    const { data } = await supabase.auth.admin.getUserById(row.user_id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return emails
}
