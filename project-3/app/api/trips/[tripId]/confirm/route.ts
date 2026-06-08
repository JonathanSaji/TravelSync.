import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { sendEmail } from '@/lib/email'
import { buildConfirmedEmail } from '@/lib/emailTemplates'
import type { PlanDetails } from '@/types'
import type { GeneratedTrip } from '@/lib/buildTripOrder'

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
    }>(
      `
        SELECT
          t.${ownerColumn} AS owner_id,
          a.username AS owner_username,
          a.email AS owner_email,
          t.plan_details,
          t.itinerary,
          t.confirmed
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

    // Confirm access: must be owner or shared user
    if (userId !== ownerId) {
      const access = await dbQuery<{ ok: number }>(
        `SELECT 1 AS ok FROM "TravelSync".trip_shares WHERE trip_id = $1 AND shared_with_user_id = $2 LIMIT 1`,
        [tripId, userId],
      )
      if (!access.rows[0]) {
        return NextResponse.json({ error: 'You do not have access to this trip.' }, { status: 403 })
      }
    }

    // Mark as confirmed
    await dbQuery(
      `UPDATE "TravelSync".trips SET confirmed = TRUE, trip_status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [tripId],
    )

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
    const trip = tripRow.itinerary

    // Build recipient list: owner + all shared users
    const recipients: { username: string; email: string; isOwner: boolean }[] = [
      { username: tripRow.owner_username, email: tripRow.owner_email, isOwner: true },
      ...sharedResult.rows.map(r => ({ username: r.username, email: r.email, isOwner: false })),
    ]

    // Send emails (non-blocking — don't let email failures block the response)
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const { subject, html } = buildConfirmedEmail({
          recipientName: recipient.username,
          planDetails,
          trip,
          isOwner: recipient.isOwner,
        })
        await sendEmail({ to: recipient.email, subject, html })
      } catch (emailErr) {
        console.error(`Failed to send confirmation email to ${recipient.email}:`, emailErr)
      }
    })

    // Fire emails without blocking the response
    void Promise.all(emailPromises)

    return NextResponse.json({ ok: true, confirmed: true })
  } catch (error) {
    console.error('confirm trip POST error:', error)
    return NextResponse.json({ error: 'Failed to confirm trip.' }, { status: 500 })
  }
}
