import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface ShareBody {
  userId?: unknown
  username?: unknown
  email?: unknown
  sharedUserId?: unknown
}

function parsePositiveId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const n = Number(input.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

function parseTripId(req: Request): number | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  const raw = segments[segments.length - 2]
  return parsePositiveId(raw)
}

async function loadTripOwner(tripId: number): Promise<number | null> {
  const result = await dbQuery<{ owner_id: string | number }>(
    'SELECT owner_id FROM trips WHERE id = $1 LIMIT 1',
    [tripId],
  )
  const row = result.rows[0]
  if (!row) return null
  return parsePositiveId(row.owner_id)
}

export async function GET(req: Request) {
  try {
    const tripId = parseTripId(req)
    const viewerId = parsePositiveId(new URL(req.url).searchParams.get('userId'))

    if (!tripId || !viewerId) {
      return NextResponse.json({ error: 'Valid tripId and userId are required.' }, { status: 400 })
    }

    const ownerId = await loadTripOwner(tripId)
    if (!ownerId) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    if (viewerId !== ownerId) {
      return NextResponse.json({ error: 'Only the owner can view share permissions.' }, { status: 403 })
    }

    const shares = await dbQuery<{
      shared_with_user_id: string | number
      shared_with_username: string
      shared_with_display_name: string | null
      shared_by_user_id: string | number | null
      shared_by_username: string | null
      created_at: string
    }>(
      `
        SELECT
          s.shared_with_user_id,
          sw.username AS shared_with_username,
          sw.display_name AS shared_with_display_name,
          s.shared_by_user_id,
          sb.username AS shared_by_username,
          s.created_at
        FROM trip_shares s
        JOIN accounts sw ON sw.id = s.shared_with_user_id
        LEFT JOIN accounts sb ON sb.id = s.shared_by_user_id
        WHERE s.trip_id = $1
        ORDER BY s.created_at ASC
      `,
      [tripId],
    )

    return NextResponse.json({
      tripId: String(tripId),
      ownerId: String(ownerId),
      shares: shares.rows.map(row => ({
        sharedUserId: String(row.shared_with_user_id),
        sharedUsername: row.shared_with_username,
        sharedDisplayName: row.shared_with_display_name,
        sharedByUserId: row.shared_by_user_id != null ? String(row.shared_by_user_id) : null,
        sharedByUsername: row.shared_by_username,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    console.error('trip shares GET error:', error)
    return NextResponse.json({ error: 'Failed to load share access.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const tripId = parseTripId(req)
    if (!tripId) {
      return NextResponse.json({ error: 'Valid tripId is required.' }, { status: 400 })
    }

    const body = (await req.json()) as ShareBody
    const ownerUserId = parsePositiveId(body.userId)
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!ownerUserId || !username || !email) {
      return NextResponse.json({ error: 'Valid userId, username, and email are required.' }, { status: 400 })
    }

    const ownerId = await loadTripOwner(tripId)
    if (!ownerId) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (ownerUserId !== ownerId) {
      return NextResponse.json({ error: 'Only the owner can share this trip.' }, { status: 403 })
    }

    const targetUser = await dbQuery<{
      id: string | number
      username: string
      email: string
      display_name: string | null
    }>(
      `
        SELECT id, username, email, display_name
        FROM accounts
        WHERE LOWER(username) = LOWER($1)
          AND LOWER(email) = LOWER($2)
        LIMIT 1
      `,
      [username, email],
    )

    const sharedUser = targetUser.rows[0]
    if (!sharedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    if (parsePositiveId(sharedUser.id) === ownerUserId) {
      return NextResponse.json({ error: "You can't share with yourself, silly." }, { status: 400 })
    }

    const inserted = await dbQuery<{
      trip_id: string | number
      shared_with_user_id: string | number
      shared_by_user_id: string | number | null
      created_at: string
    }>(
      `
        INSERT INTO trip_shares (trip_id, shared_with_user_id, shared_by_user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (trip_id, shared_with_user_id) DO UPDATE
          SET shared_by_user_id = EXCLUDED.shared_by_user_id
        RETURNING trip_id, shared_with_user_id, shared_by_user_id, created_at
      `,
      [tripId, sharedUser.id, ownerUserId],
    )

    const share = inserted.rows[0]
    return NextResponse.json({
      tripId: String(share.trip_id),
      sharedUser: {
        id: String(sharedUser.id),
        username: sharedUser.username,
        email: sharedUser.email,
        displayName: sharedUser.display_name,
      },
      sharedByUserId: share.shared_by_user_id != null ? String(share.shared_by_user_id) : null,
      createdAt: share.created_at,
    })
  } catch (error) {
    console.error('trip shares POST error:', error)
    return NextResponse.json({ error: 'Failed to share trip.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const tripId = parseTripId(req)
    if (!tripId) {
      return NextResponse.json({ error: 'Valid tripId is required.' }, { status: 400 })
    }

    const body = (await req.json()) as ShareBody
    const ownerUserId = parsePositiveId(body.userId)
    const sharedUserId = parsePositiveId(body.sharedUserId)

    if (!ownerUserId || !sharedUserId) {
      return NextResponse.json({ error: 'Valid userId and sharedUserId are required.' }, { status: 400 })
    }

    const ownerId = await loadTripOwner(tripId)
    if (!ownerId) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (ownerUserId !== ownerId) {
      return NextResponse.json({ error: 'Only the owner can remove share access.' }, { status: 403 })
    }

    const removed = await dbQuery(
      `
        DELETE FROM trip_shares
        WHERE trip_id = $1 AND shared_with_user_id = $2
      `,
      [tripId, sharedUserId],
    )

    if (removed.rowCount === 0) {
      return NextResponse.json({ error: 'Share access not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, tripId: String(tripId), sharedUserId: String(sharedUserId) })
  } catch (error) {
    console.error('trip shares DELETE error:', error)
    return NextResponse.json({ error: 'Failed to revoke share access.' }, { status: 500 })
  }
}