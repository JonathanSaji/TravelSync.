import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { sendEmail } from '@/lib/email'
import type { PlanDetails } from '@/types'
import type { GeneratedTrip } from '@/lib/buildTripOrder'
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
      owner_username: string
      owner_email: string
      plan_details: PlanDetails
      itinerary: GeneratedTrip
      confirmed: boolean
      trip_status: string
    }>(
      `
        SELECT
          t.${ownerColumn} AS owner_id,
          a.username AS owner_username,
          a.email AS owner_email,
          t.plan_details,
          t.itinerary,
          t.confirmed,
          t.trip_status
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

    const confirmerResult = await dbQuery<{ username: string; email: string }>(
      `SELECT username, email FROM public.accounts WHERE id = $1 LIMIT 1`,
      [userId],
    )
    const confirmer = confirmerResult.rows[0]

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

    const planDetails = tripRow.plan_details
    const tripName = planDetails.name?.trim() || tripRow.itinerary.tripName || 'Your trip'
    const location = planDetails.location?.trim() || 'your destination'
    const whoConfirmed = confirmer?.username || (isOwnerConfirmation ? tripRow.owner_username : 'A participant')

    // Build recipient list: owner + all shared users
    const recipients: { email: string }[] = [
      { email: tripRow.owner_email },
      ...sharedResult.rows.map(r => ({ email: r.email })),
    ]

    // Send emails automatically on attendance confirmation (non-blocking).
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const subject = `${whoConfirmed} confirmed attendance for ${tripName}`
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;background:#f7f5f0;padding:20px;color:#2c2b28;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edeae2;border-radius:12px;padding:20px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#7a9e8e;font-weight:700;">TravelSync Attendance</p>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:500;">${tripName}</h2>
              <p style="margin:0 0 16px;color:#5c5a56;">📍 ${location}</p>
              <p style="margin:0 0 10px;line-height:1.6;">
                <strong>${whoConfirmed}</strong> confirmed their attendance for this trip.
              </p>
              <p style="margin:0;line-height:1.6;color:#5c5a56;">
                Open TravelSync to confirm your own attendance and review the itinerary.
              </p>
            </div>
          </div>
        `
        await sendEmail({ to: recipient.email, subject, html })
      } catch (emailErr) {
        console.error(`Failed to send confirmation email to ${recipient.email}:`, emailErr)
      }
    })

    // Fire emails without blocking the response
    void Promise.all(emailPromises)

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
