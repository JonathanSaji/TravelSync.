import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { isGeneratedTrip } from '@/lib/buildTripOrder'
import { isIdeaItem, isPlanDetails } from '@/lib/sharedSandbox'

export const dynamic = 'force-dynamic'

interface SaveTripBody {
  userId?: unknown
  planDetails?: unknown
  ideas?: unknown
  trip?: unknown
}

interface UpdateTripBody {
  userId?: unknown
  tripId?: unknown
  planDetails?: unknown
  ideas?: unknown
  trip?: unknown
}

function parseUserId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const n = Number(input.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

async function loadTripOwner(tripId: number): Promise<number | null> {
  const owner = await dbQuery<{ owner_id: string | number }>(
    'SELECT owner_id FROM trips WHERE id = $1 LIMIT 1',
    [tripId],
  )
  const row = owner.rows[0]
  if (!row) return null
  return parseUserId(row.owner_id)
}

async function userCanEditTrip(tripId: number, userId: number): Promise<boolean> {
  const ownerId = await loadTripOwner(tripId)
  if (!ownerId) return false
  if (ownerId === userId) return true

  const access = await dbQuery<{ ok: number }>(
    `
      SELECT 1 AS ok
      FROM trip_shares
      WHERE trip_id = $1 AND shared_with_user_id = $2
      LIMIT 1
    `,
    [tripId, userId],
  )

  return Boolean(access.rows[0])
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveTripBody
    const userId = parseUserId(body.userId)

    if (!userId) {
      return NextResponse.json({ error: 'Valid userId is required.' }, { status: 400 })
    }

    if (!isPlanDetails(body.planDetails)) {
      return NextResponse.json({ error: 'Invalid planDetails payload.' }, { status: 400 })
    }

    if (!Array.isArray(body.ideas) || !body.ideas.every(isIdeaItem)) {
      return NextResponse.json({ error: 'Invalid ideas payload.' }, { status: 400 })
    }

    if (!isGeneratedTrip(body.trip)) {
      return NextResponse.json({ error: 'Invalid itinerary payload.' }, { status: 400 })
    }

    const inserted = await dbQuery<{
      id: string | number
      created_at: string
      updated_at: string
    }>(
      `
        INSERT INTO trips (owner_id, plan_details, ideas, itinerary)
        VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
        RETURNING id, created_at, updated_at
      `,
      [
        userId,
        JSON.stringify(body.planDetails),
        JSON.stringify(body.ideas),
        JSON.stringify(body.trip),
      ],
    )

    const trip = inserted.rows[0]
    return NextResponse.json({
      tripId: String(trip.id),
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    })
  } catch (error) {
    console.error('trips POST error:', error)
    return NextResponse.json({ error: 'Failed to save trip.' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const userId = parseUserId(new URL(req.url).searchParams.get('userId'))
    if (!userId) {
      return NextResponse.json({ error: 'Valid userId query param is required.' }, { status: 400 })
    }

    const myTrips = await dbQuery<{
      id: string | number
      owner_id: string | number
      owner_username: string
      owner_display_name: string | null
      plan_details: unknown
      ideas: unknown
      itinerary: unknown
      created_at: string
      updated_at: string
    }>(
      `
        SELECT
          t.id,
          t.owner_id,
          a.username AS owner_username,
          a.display_name AS owner_display_name,
          t.plan_details,
          t.ideas,
          t.itinerary,
          t.created_at,
          t.updated_at
        FROM trips t
        JOIN accounts a ON a.id = t.owner_id
        WHERE t.owner_id = $1
        ORDER BY t.updated_at DESC
      `,
      [userId],
    )

    const sharedTrips = await dbQuery<{
      id: string | number
      owner_id: string | number
      owner_username: string
      owner_display_name: string | null
      plan_details: unknown
      ideas: unknown
      itinerary: unknown
      created_at: string
      updated_at: string
    }>(
      `
        SELECT DISTINCT
          t.id,
          t.owner_id,
          a.username AS owner_username,
          a.display_name AS owner_display_name,
          t.plan_details,
          t.ideas,
          t.itinerary,
          t.created_at,
          t.updated_at
        FROM trips t
        JOIN trip_shares s ON s.trip_id = t.id
        JOIN accounts a ON a.id = t.owner_id
        WHERE s.shared_with_user_id = $1
        ORDER BY t.updated_at DESC
      `,
      [userId],
    )

    return NextResponse.json({
      myTrips: myTrips.rows.map(r => ({
        id: String(r.id),
        ownerId: String(r.owner_id),
        ownerUsername: r.owner_username,
        ownerDisplayName: r.owner_display_name,
        planDetails: r.plan_details,
        ideas: r.ideas,
        trip: r.itinerary,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      sharedTrips: sharedTrips.rows.map(r => ({
        id: String(r.id),
        ownerId: String(r.owner_id),
        ownerUsername: r.owner_username,
        ownerDisplayName: r.owner_display_name,
        planDetails: r.plan_details,
        ideas: r.ideas,
        trip: r.itinerary,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  } catch (error) {
    console.error('trips GET error:', error)
    return NextResponse.json({ error: 'Failed to load trips.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as UpdateTripBody
    const userId = parseUserId(body.userId)
    const tripId = parseUserId(body.tripId)

    if (!userId || !tripId) {
      return NextResponse.json({ error: 'Valid userId and tripId are required.' }, { status: 400 })
    }

    const ownerId = await loadTripOwner(tripId)
    if (!ownerId) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const canEdit = await userCanEditTrip(tripId, userId)
    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have access to update this trip.' }, { status: 403 })
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (body.planDetails !== undefined) {
      if (!isPlanDetails(body.planDetails)) {
        return NextResponse.json({ error: 'Invalid planDetails payload.' }, { status: 400 })
      }
      params.push(JSON.stringify(body.planDetails))
      updates.push(`plan_details = $${params.length}::jsonb`)
    }

    if (body.ideas !== undefined) {
      if (!Array.isArray(body.ideas) || !body.ideas.every(isIdeaItem)) {
        return NextResponse.json({ error: 'Invalid ideas payload.' }, { status: 400 })
      }
      params.push(JSON.stringify(body.ideas))
      updates.push(`ideas = $${params.length}::jsonb`)
    }

    if (body.trip !== undefined) {
      if (!isGeneratedTrip(body.trip)) {
        return NextResponse.json({ error: 'Invalid itinerary payload.' }, { status: 400 })
      }
      params.push(JSON.stringify(body.trip))
      updates.push(`itinerary = $${params.length}::jsonb`)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    params.push(tripId)
    const updated = await dbQuery<{ id: string | number; updated_at: string }>(
      `
        UPDATE trips
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING id, updated_at
      `,
      params,
    )

    const row = updated.rows[0]
    return NextResponse.json({
      tripId: String(row.id),
      updatedAt: row.updated_at,
    })
  } catch (error) {
    console.error('trips PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update trip.' }, { status: 500 })
  }
}
