import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { sendEmail } from '@/lib/email'
import { build7DayReminderEmail, build2DayConfirmedEmail, build2DayUnconfirmedEmail } from '@/lib/emailTemplates'
import type { PlanDetails } from '@/types'
import type { GeneratedTrip } from '@/lib/buildTripOrder'

export const dynamic = 'force-dynamic'

function hasValidAdminKey(req: Request): boolean {
  const expected = process.env.DB_ADMIN_KEY?.trim()
  if (!expected) return true

  const fromHeader = req.headers.get('x-admin-key')?.trim()
  return fromHeader === expected
}

function parsePositiveId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const n = Number(input.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

interface Body {
  tripId?: unknown
  forceConfirmed?: unknown
}

export async function POST(req: Request) {
  if (!hasValidAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized admin request.' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Body
    const tripId = parsePositiveId(body.tripId)

    if (!tripId) {
      return NextResponse.json({ error: 'Valid tripId is required.' }, { status: 400 })
    }

    const ownerColumn = await getTripOwnerColumn()
    const tripResult = await dbQuery<{
      id: string | number
      owner_id: string | number
      owner_username: string
      owner_email: string
      plan_details: PlanDetails
      itinerary: GeneratedTrip
      confirmed: boolean
    }>(
      `
        SELECT
          t.id,
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

    const trip = tripResult.rows[0]
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const sendConfirmed = body.forceConfirmed === true || trip.confirmed
    const ownerName = trip.owner_username

    const sevenDay = build7DayReminderEmail({
      recipientName: ownerName,
      planDetails: trip.plan_details,
      trip: trip.itinerary,
      isConfirmed: trip.confirmed,
      isOwner: true,
    })

    const twoDay = sendConfirmed
      ? build2DayConfirmedEmail({
          recipientName: ownerName,
          planDetails: trip.plan_details,
          trip: trip.itinerary,
        })
      : build2DayUnconfirmedEmail({
          recipientName: ownerName,
          planDetails: trip.plan_details,
          trip: trip.itinerary,
          isOwner: true,
        })

    await sendEmail({
      to: trip.owner_email,
      subject: sevenDay.subject,
      html: sevenDay.html,
    })

    await sendEmail({
      to: trip.owner_email,
      subject: twoDay.subject,
      html: twoDay.html,
    })

    return NextResponse.json({
      ok: true,
      tripId: String(trip.id),
      sent: ['7day', '2day'],
      confirmedTemplateUsed: sendConfirmed,
    })
  } catch (error) {
    console.error('force owner reminders error:', error)
    return NextResponse.json({ error: 'Failed to send reminder emails.' }, { status: 500 })
  }
}