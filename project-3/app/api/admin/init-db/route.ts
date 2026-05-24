import { NextResponse } from 'next/server'
import { ensureTravelSyncTables, getTravelSyncTables } from '@/lib/ensureTravelSyncTables'

export const dynamic = 'force-dynamic'

function hasValidAdminKey(req: Request): boolean {
  const expected = process.env.DB_ADMIN_KEY?.trim()
  if (!expected) return true

  const fromHeader = req.headers.get('x-admin-key')?.trim()
  return fromHeader === expected
}

export async function GET() {
  try {
    const tables = await getTravelSyncTables()
    return NextResponse.json({ tables, ready: tables.length === 2 })
  } catch (error) {
    console.error('init-db GET error:', error)
    return NextResponse.json({ error: 'Failed to check table status.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasValidAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized init-db request.' }, { status: 401 })
  }

  try {
    await ensureTravelSyncTables()
    const tables = await getTravelSyncTables()
    return NextResponse.json({ ok: true, tables })
  } catch (error) {
    console.error('init-db POST error:', error)
    return NextResponse.json({ error: 'Failed to initialize TravelSync tables.' }, { status: 500 })
  }
}
