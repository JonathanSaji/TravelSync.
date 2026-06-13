import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { triggerTrackerSyncTripReminder } from '@/lib/trackerSync'
import { ensureTravelSyncTables } from '@/lib/ensureTravelSyncTables'

export const dynamic = 'force-dynamic'

interface ConfirmBody {
  userId?: unknown
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
  // URL pattern: /api/trips/[tripId]/confirm
  const raw = segments[segments.length - 2]
  return parsePositiveId(raw)
}

export async function POST(req: Request) {
  try {
    await ensureTravelSyncTables()
    const tripId = parseTripId(req)
    const body = (await req.json()) as ConfirmBody
    const userId = parsePositiveId(body.userId)

    if (!tripId || !userId) {
      return NextResponse.json({ error: 'Valid tripId and userId are required.' }, { status: 400 })
    }

    const ownerColumn = await getTripOwnerColumn()

    // Load trip + owner info
    const tripResult = await dbQuery<{
      owner_id: string | number
      confirmed: boolean
      trip_status: string
    }>(
      `
        SELECT
          t.${ownerColumn} AS owner_id,
          t.confirmed,
          t.trip_status
        FROM "TravelSync".trips t
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
        return NextResponse.json({ error: 'You do not have access to this trip.' }, { status: 403 })
      }
    }

    // Store attendance on the confirming account, not globally for every participant.
    if (isOwnerConfirmation) {
      await dbQuery(
        `UPDATE "TravelSync".trips SET confirmed = TRUE, trip_status = 'confirmed', updated_at = NOW() WHERE id = $1`,
        [tripId],
      )
    } else {
      await dbQuery(
        `
          UPDATE "TravelSync".trip_shares
          SET attendance_confirmed = TRUE,
              attendance_confirmed_at = NOW()
          WHERE trip_id = $1 AND shared_with_user_id = $2
        `,
        [tripId, userId],
      )
    }

    triggerTrackerSyncTripReminder({ tripId, userId }).catch(err => {
      console.error(`TrackerSync immediate trigger failed for trip ${tripId} user ${userId}:`, err)
    })

    return NextResponse.json({
      ok: true,
      attendanceConfirmed: true,
      isOwnerConfirmation,
      tripConfirmed: isOwnerConfirmation ? true : Boolean(tripRow.confirmed),
      tripStatus: isOwnerConfirmation ? 'confirmed' : (tripRow.trip_status ?? 'planned'),
    })
  } catch (error) {
    console.error('confirm trip POST error:', error)
    return NextResponse.json({ error: 'Failed to confirm trip.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTravelSyncTables()
    const tripId = parseTripId(req)
    const body = (await req.json()) as ConfirmBody
    const userId = parsePositiveId(body.userId)

    if (!tripId || !userId) {
      return NextResponse.json({ error: 'Valid tripId and userId are required.' }, { status: 400 })
    }

    const ownerColumn = await getTripOwnerColumn()

    // Load trip + owner info
    const tripResult = await dbQuery<{
      owner_id: string | number
      confirmed: boolean
      trip_status: string
    }>(
      `
        SELECT
          t.${ownerColumn} AS owner_id,
          t.confirmed,
          t.trip_status
        FROM "TravelSync".trips t
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

    // Remove attendance from the confirming account
    if (isOwnerConfirmation) {
      await dbQuery(
        `UPDATE "TravelSync".trips SET confirmed = FALSE, trip_status = 'planned', updated_at = NOW() WHERE id = $1`,
        [tripId],
      )

      // Reset reminder send logs for the trip so reconfirming can trigger fresh reminders.
      await dbQuery(
        `DELETE FROM "TravelSync".trip_reminder_logs WHERE trip_id = $1`,
        [tripId],
      )
    } else {
      await dbQuery(
        `
          UPDATE "TravelSync".trip_shares
          SET attendance_confirmed = FALSE,
              attendance_confirmed_at = NULL
          WHERE trip_id = $1 AND shared_with_user_id = $2
        `,
        [tripId, userId],
      )

      // Reset reminder send logs for this participant so reconfirming can trigger fresh reminders.
      await dbQuery(
        `DELETE FROM "TravelSync".trip_reminder_logs WHERE trip_id = $1 AND user_id = $2`,
        [tripId, userId],
      )
    }

    return NextResponse.json({
      ok: true,
      attendanceConfirmed: false,
      isOwnerConfirmation,
    })
  } catch (error) {
    console.error('confirm trip PATCH error:', error)
    return NextResponse.json({ error: 'Failed to unconfirm trip.' }, { status: 500 })
  }
}
