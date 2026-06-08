import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getTripOwnerColumn } from '@/lib/tripOwnerColumn'
import { sendEmail } from '@/lib/email'
import {
  build7DayReminderEmail,
  build2DayUnconfirmedEmail,
  build2DayConfirmedEmail,
} from '@/lib/emailTemplates'
import type { PlanDetails } from '@/types'
import type { GeneratedTrip } from '@/lib/buildTripOrder'

export const dynamic = 'force-dynamic'

// ── Auth helper ───────────────────────────────────────────────────────────────
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true // no secret configured → allow (dev only)
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TripRow {
  id: string | number
  owner_id: string | number
  owner_username: string
  owner_email: string
  plan_details: PlanDetails
  itinerary: GeneratedTrip
  confirmed: boolean
  trip_status: string
  start_date: string
}

interface ParticipantRow {
  user_id: string | number
  username: string
  email: string
  is_owner: boolean
}

// ── Helper: get all participants (owner + shared) for a trip ─────────────────
async function getTripParticipants(
  tripId: number | string,
  ownerRow: { owner_id: string | number; owner_username: string; owner_email: string },
): Promise<ParticipantRow[]> {
  const shared = await dbQuery<{ user_id: string | number; username: string; email: string }>(
    `
      SELECT s.shared_with_user_id AS user_id, a.username, a.email
      FROM "TravelSync".trip_shares s
      JOIN public.accounts a ON a.id = s.shared_with_user_id
      WHERE s.trip_id = $1
    `,
    [tripId],
  )

  return [
    { user_id: ownerRow.owner_id, username: ownerRow.owner_username, email: ownerRow.owner_email, is_owner: true },
    ...shared.rows.map(r => ({ ...r, is_owner: false })),
  ]
}

// ── Helper: check + log a reminder (returns true if we should send it) ────────
async function shouldSendAndLog(
  tripId: number | string,
  userId: number | string,
  reminderType: string,
): Promise<boolean> {
  try {
    await dbQuery(
      `
        INSERT INTO "TravelSync".trip_reminder_logs (trip_id, user_id, reminder_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (trip_id, user_id, reminder_type) DO NOTHING
      `,
      [tripId, userId, reminderType],
    )
    // If a row was inserted (not on conflict), rowCount > 0
    // We re-query to confirm the row was just inserted
    const check = await dbQuery<{ sent_at: string }>(
      `SELECT sent_at FROM "TravelSync".trip_reminder_logs WHERE trip_id=$1 AND user_id=$2 AND reminder_type=$3`,
      [tripId, userId, reminderType],
    )
    // Only send if inserted in last 10 seconds (i.e., newly created by this run)
    if (!check.rows[0]) return false
    const sentAt = new Date(check.rows[0].sent_at)
    const ageMs = Date.now() - sentAt.getTime()
    return ageMs < 10_000
  } catch {
    return false
  }
}

// ── GET handler (called by Vercel cron daily at 9 AM UTC) ────────────────────
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const ownerColumn = await getTripOwnerColumn()
    const results = { markedHappeningNow: 0, sent7day: 0, sent2dayUnconfirmed: 0, sent2dayConfirmed: 0 }

    // ── 1. Mark trips as happening_now when start_date is today ─────────────
    await dbQuery(
      `
        UPDATE "TravelSync".trips
        SET trip_status = 'happening_now', updated_at = NOW()
        WHERE start_date = CURRENT_DATE
          AND trip_status IN ('planned', 'confirmed')
      `,
      [],
    )

    // ── 2. Fetch trips starting in 7 days ───────────────────────────────────
    const trips7 = await dbQuery<TripRow>(
      `
        SELECT
          t.id,
          t.${ownerColumn} AS owner_id,
          a.username AS owner_username,
          a.email AS owner_email,
          t.plan_details,
          t.itinerary,
          t.confirmed,
          t.trip_status,
          t.start_date::text AS start_date
        FROM "TravelSync".trips t
        JOIN public.accounts a ON a.id = t.${ownerColumn}
        WHERE t.start_date = CURRENT_DATE + INTERVAL '7 days'
          AND t.trip_status NOT IN ('happening_now', 'completed')
      `,
      [],
    )

    for (const trip of trips7.rows) {
      const participants = await getTripParticipants(trip.id, trip)
      for (const p of participants) {
        const shouldSend = await shouldSendAndLog(trip.id, p.user_id, '7day')
        if (!shouldSend) continue
        try {
          const { subject, html } = build7DayReminderEmail({
            recipientName: p.username,
            planDetails: trip.plan_details,
            trip: trip.itinerary,
            isConfirmed: trip.confirmed,
            isOwner: p.is_owner,
          })
          await sendEmail({ to: p.email, subject, html })
          results.sent7day++
        } catch (err) {
          console.error(`7-day email failed for trip ${trip.id} user ${p.email}:`, err)
        }
      }
    }

    // ── 3. Fetch trips starting in 2 days ───────────────────────────────────
    const trips2 = await dbQuery<TripRow>(
      `
        SELECT
          t.id,
          t.${ownerColumn} AS owner_id,
          a.username AS owner_username,
          a.email AS owner_email,
          t.plan_details,
          t.itinerary,
          t.confirmed,
          t.trip_status,
          t.start_date::text AS start_date
        FROM "TravelSync".trips t
        JOIN public.accounts a ON a.id = t.${ownerColumn}
        WHERE t.start_date = CURRENT_DATE + INTERVAL '2 days'
          AND t.trip_status NOT IN ('happening_now', 'completed')
      `,
      [],
    )

    for (const trip of trips2.rows) {
      const participants = await getTripParticipants(trip.id, trip)
      for (const p of participants) {
        if (trip.confirmed) {
          const shouldSend = await shouldSendAndLog(trip.id, p.user_id, '2day_confirmed')
          if (!shouldSend) continue
          try {
            const { subject, html } = build2DayConfirmedEmail({
              recipientName: p.username,
              planDetails: trip.plan_details,
              trip: trip.itinerary,
            })
            await sendEmail({ to: p.email, subject, html })
            results.sent2dayConfirmed++
          } catch (err) {
            console.error(`2-day confirmed email failed for trip ${trip.id} user ${p.email}:`, err)
          }
        } else {
          const shouldSend = await shouldSendAndLog(trip.id, p.user_id, '2day_unconfirmed')
          if (!shouldSend) continue
          try {
            const { subject, html } = build2DayUnconfirmedEmail({
              recipientName: p.username,
              planDetails: trip.plan_details,
              trip: trip.itinerary,
              isOwner: p.is_owner,
            })
            await sendEmail({ to: p.email, subject, html })
            results.sent2dayUnconfirmed++
          } catch (err) {
            console.error(`2-day unconfirmed email failed for trip ${trip.id} user ${p.email}:`, err)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error('cron reminders error:', error)
    return NextResponse.json({ error: 'Cron job failed.' }, { status: 500 })
  }
}
