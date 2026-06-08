import { NextResponse } from 'next/server'
import { clearVisitorSessionCookie } from '@/lib/visitor/cookie'

export async function POST() {
  await clearVisitorSessionCookie()
  return NextResponse.json({ ok: true })
}
