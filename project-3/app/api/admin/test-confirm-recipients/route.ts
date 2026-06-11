import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { ensureTravelSyncTables } from '@/lib/ensureTravelSyncTables'

export const dynamic = 'force-dynamic'

function parsePositiveId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const n = Number(input.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

export async function POST(req: Request) {
  await ensureTravelSyncTables()

  const body = (await req.json()) as { tripId?: unknown; userId?: unknown }
  const tripId = parsePositiveId(body.tripId)
  const userId = parsePositiveId(body.userId)

  if (!tripId || !userId) {
    return NextResponse.json(
      { error: 'Valid tripId and userId are required.' },
      { status: 400 },
    )
  }

  const ownerColumn = await getTripOwnerColumn()

  // Load trip + owner info
  const tripResult = await dbQuery<{
    owner_id: string | number
    owner_username: string
    owner_email: string
  }>(
    `
      SELECT
        t.${ownerColumn} AS owner_id,
        a.username AS owner_username,
        a.email AS owner_email
      FROM "TravelSync".trips t
      JOIN public.accounts a ON a.id = t.${ownerColumn}
      WHERE t.id = $1
      LIMIT 1
    `,
    [tripId],
  )

  if (!tripResult.rows[0]) {
    return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
  }

  const tripRow = tripResult.rows[0]
  const ownerId = parsePositiveId(tripRow.owner_id)
  const isOwnerConfirmation = userId === ownerId

  // Confirm access: must be owner or shared user
  if (!isOwnerConfirmation) {
    const access = await dbQuery<{ ok: number }>(
      `SELECT 1 AS ok FROM "TravelSync".trip_shares WHERE trip_id = $1 AND shared_with_user_id = $2 LIMIT 1`,
      [tripId, userId],
    )
    if (!access.rows[0]) {
      return NextResponse.json(
        { error: 'You do not have access to this trip.' },
        { status: 403 },
      )
    }
  }

  // Load all shared users' info (username + email)
  const sharedResult = await dbQuery<{
    username: string
    email: string
  }>(
    `
      SELECT a.username, a.email
      FROM "TravelSync".trip_shares s
      JOIN public.accounts a ON a.id = s.shared_with_user_id
      WHERE s.trip_id = $1
    `,
    [tripId],
  )

  // Build recipient list: owner + all shared users
  const recipients = [
    { email: tripRow.owner_email, username: tripRow.owner_username },
    ...sharedResult.rows.map(r => ({ email: r.email, username: r.username })),
  ]

  // Load confirmer info
  const confirmerResult = await dbQuery<{ username: string; email: string }>(
    `SELECT username, email FROM public.accounts WHERE id = $1 LIMIT 1`,
    [userId],
  )
  const confirmer = confirmerResult.rows[0]

  return NextResponse.json({
    ok: true,
    confirmingUserId: userId,
    confirmingUsername: confirmer?.username,
    confirmingEmail: confirmer?.email,
    tripId,
    tripOwnerId: ownerId,
    isOwnerConfirmation,
    recipients,
    recipientCount: recipients.length,
  })
}
