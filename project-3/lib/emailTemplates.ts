import type { GeneratedTrip } from '@/lib/buildTripOrder'
import type { PlanDetails } from '@/types'

// ── Design tokens (matching site theme) ──────────────────────────────────────
const C = {
  cream:     '#F7F5F0',
  creamDeep: '#EDEAE2',
  white:     '#FFFFFF',
  sage:      '#7A9E8E',
  terra:     '#B8714E',
  ink:       '#2C2B28',
  inkMid:    '#5C5A56',
  inkFaint:  '#9B9892',
}

// ── Base layout wrapper ───────────────────────────────────────────────────────
function emailBase(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>TravelSync</title>
</head>
<body style="margin:0;padding:0;background-color:${C.cream};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.cream};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;">

          <!-- Logo / header -->
          <tr>
            <td style="padding:0 0 20px 4px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:${C.ink};letter-spacing:-0.01em;">TravelSync.</span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:${C.white};border-radius:16px;border:1px solid ${C.creamDeep};padding:36px 40px;box-shadow:0 2px 12px rgba(44,43,40,0.07);">
              ${innerHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 4px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${C.inkFaint};line-height:1.6;">
                TravelSync · Your collaborative travel planner<br />
                You're receiving this because you're part of a planned trip.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── SubSync CTA block ─────────────────────────────────────────────────────────
function subSyncBlock(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
    <tr>
      <td style="background:${C.cream};border-radius:12px;border:1px solid ${C.creamDeep};padding:20px 24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.inkFaint};">Manage your subscriptions</p>
        <p style="margin:0 0 14px;font-size:14px;color:${C.inkMid};line-height:1.65;">
          Use <strong style="color:${C.ink};">SubSync</strong> to pause, cancel, or monitor your subscriptions while you're away — so you're not paying for services you're not using on your trip.
        </p>
        <a href="https://trackersync.sub-sync.ca"
           style="display:inline-block;background:${C.sage};color:${C.white};padding:11px 22px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">
          Open SubSync &rarr;
        </a>
      </td>
    </tr>
  </table>`
}

// ── Itinerary section ─────────────────────────────────────────────────────────
function itineraryBlock(trip: GeneratedTrip): string {
  if (!trip.itinerary || trip.itinerary.length === 0) return ''

  const days = trip.itinerary.map(day => {
    const activities = day.activities.map(a => `
      <tr>
        <td style="padding:6px 0 6px 12px;border-left:2px solid ${C.creamDeep};">
          <span style="font-size:12px;color:${C.sage};font-weight:600;">${a.time || ''}</span>
          <span style="font-size:13.5px;font-weight:600;color:${C.ink};margin-left:6px;">${a.name}</span>
          ${a.description ? `<p style="margin:3px 0 0;font-size:12.5px;color:${C.inkMid};line-height:1.55;">${a.description}</p>` : ''}
        </td>
      </tr>`).join('')

    return `
    <tr>
      <td style="padding:16px 0 4px;">
        <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:${C.ink};">
          Day ${day.day}
          <span style="font-weight:400;color:${C.inkMid};font-size:13px;"> — ${day.theme}</span>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${activities || `<tr><td style="font-size:12.5px;color:${C.inkFaint};padding:4px 0 4px 12px;">No activities yet.</td></tr>`}
        </table>
      </td>
    </tr>`
  }).join('')

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
    <tr>
      <td style="border-top:1px solid ${C.creamDeep};padding-top:24px;">
        <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.inkFaint};">Your Itinerary</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${days}
        </table>
      </td>
    </tr>
  </table>`
}

// ── Divider ───────────────────────────────────────────────────────────────────
function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr><td style="border-top:1px solid ${C.creamDeep};"></td></tr>
  </table>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 1: Trip Confirmed
// ─────────────────────────────────────────────────────────────────────────────
export function buildConfirmedEmail(params: {
  recipientName: string
  planDetails: PlanDetails
  trip: GeneratedTrip
  isOwner: boolean
}): { subject: string; html: string } {
  const { recipientName, planDetails, trip, isOwner } = params
  const tripName = planDetails.name || trip.tripName
  const location = planDetails.location || 'your destination'
  const dates = planDetails.dates || ''

  const subject = `Your trip to ${location} is confirmed! ✈️`

  const inner = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.sage};">Trip Confirmed</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:${C.ink};line-height:1.2;">${tripName}</h1>
    ${dates ? `<p style="margin:0 0 4px;font-size:14px;color:${C.inkMid};">📅 ${dates}</p>` : ''}
    <p style="margin:0 0 18px;font-size:14px;color:${C.inkMid};">📍 ${location}</p>
    ${divider()}
    <p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.65;">
      Hey <strong>${recipientName}</strong>! ${isOwner ? 'Your trip has been confirmed — everything is locked in and ready to go.' : 'Great news — the trip you\'re part of has been confirmed!'}
      Pack your bags because <strong>${tripName}</strong> is happening.
    </p>
    <p style="margin:0;font-size:14px;color:${C.inkMid};line-height:1.65;">
      Below is your full itinerary. Get excited!
    </p>
    ${itineraryBlock(trip)}
    ${subSyncBlock()}
  `

  return { subject, html: emailBase(inner) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 2: 7-Day Reminder
// ─────────────────────────────────────────────────────────────────────────────
export function build7DayReminderEmail(params: {
  recipientName: string
  planDetails: PlanDetails
  trip: GeneratedTrip
  isConfirmed: boolean
  isOwner: boolean
}): { subject: string; html: string } {
  const { recipientName, planDetails, trip, isConfirmed, isOwner } = params
  const tripName = planDetails.name || trip.tripName
  const location = planDetails.location || 'your destination'
  const dates = planDetails.dates || ''

  const subject = `One week until ${location}! 🌍 Don't forget to confirm your trip`

  const confirmPrompt = !isConfirmed ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background:${C.terra};background:linear-gradient(135deg,#B8714E,#c97e59);border-radius:12px;padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${C.white};">⚠️ Trip not yet confirmed</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:rgba(255,255,255,0.9);line-height:1.6;">
            Your trip is one week away but hasn't been confirmed yet.
            ${isOwner ? 'Open TravelSync and click <strong>Confirm Trip</strong> so everyone gets notified and SubSync can help manage your subscriptions.' : 'Ask the trip owner to confirm, or open TravelSync and confirm it yourself!'}
          </p>
          <a href="https://travelsync.vercel.app"
             style="display:inline-block;background:${C.white};color:${C.terra};padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;">
            Confirm Trip Now &rarr;
          </a>
        </td>
      </tr>
    </table>` : `
    <p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.65;">
      ✅ Your trip is confirmed — you're all set for <strong>${tripName}</strong>!
    </p>`

  const inner = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.sage};">One Week Away</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:${C.ink};line-height:1.2;">${tripName}</h1>
    ${dates ? `<p style="margin:0 0 4px;font-size:14px;color:${C.inkMid};">📅 ${dates}</p>` : ''}
    <p style="margin:0 0 18px;font-size:14px;color:${C.inkMid};">📍 ${location}</p>
    ${divider()}
    <p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.65;">
      Hey <strong>${recipientName}</strong>! <strong>${tripName}</strong> is just <strong>7 days away</strong>. The countdown has begun! 🎉
    </p>
    ${confirmPrompt}
    ${subSyncBlock()}
    ${itineraryBlock(trip)}
  `

  return { subject, html: emailBase(inner) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 3: 2-Day Reminder — Trip NOT confirmed
// ─────────────────────────────────────────────────────────────────────────────
export function build2DayUnconfirmedEmail(params: {
  recipientName: string
  planDetails: PlanDetails
  trip: GeneratedTrip
  isOwner: boolean
}): { subject: string; html: string } {
  const { recipientName, planDetails, trip, isOwner } = params
  const tripName = planDetails.name || trip.tripName
  const location = planDetails.location || 'your destination'
  const dates = planDetails.dates || ''

  const subject = `⚠️ 2 days until ${location} — don't forget to confirm your trip!`

  const inner = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.terra};">Reminder: 2 Days Away</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:${C.ink};line-height:1.2;">${tripName}</h1>
    ${dates ? `<p style="margin:0 0 4px;font-size:14px;color:${C.inkMid};">📅 ${dates}</p>` : ''}
    <p style="margin:0 0 18px;font-size:14px;color:${C.inkMid};">📍 ${location}</p>
    ${divider()}
    <p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.65;">
      Hey <strong>${recipientName}</strong>! <strong>${tripName}</strong> is only <strong>2 days away</strong> and it hasn't been confirmed yet.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:${C.terra};border-radius:12px;padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${C.white};">Last chance to confirm!</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:rgba(255,255,255,0.9);line-height:1.6;">
            ${isOwner
              ? 'Open TravelSync and hit <strong>Confirm Trip</strong> so SubSync can flag your upcoming subscriptions and everyone on the trip gets their final itinerary.'
              : 'The trip hasn\'t been confirmed yet — jump into TravelSync and confirm it so everyone is notified and SubSync can help manage subscriptions!'}
          </p>
          <a href="https://travelsync.vercel.app"
             style="display:inline-block;background:${C.white};color:${C.terra};padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;">
            Confirm Trip &rarr;
          </a>
        </td>
      </tr>
    </table>
    ${subSyncBlock()}
  `

  return { subject, html: emailBase(inner) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 4: 2-Day Reminder — Trip IS confirmed
// ─────────────────────────────────────────────────────────────────────────────
export function build2DayConfirmedEmail(params: {
  recipientName: string
  planDetails: PlanDetails
  trip: GeneratedTrip
}): { subject: string; html: string } {
  const { recipientName, planDetails, trip } = params
  const tripName = planDetails.name || trip.tripName
  const location = planDetails.location || 'your destination'
  const dates = planDetails.dates || ''

  const subject = `${tripName} is in 2 days! 🌴 Manage your subscriptions before you go`

  const inner = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.sage};">2 Days To Go!</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:${C.ink};line-height:1.2;">${tripName}</h1>
    ${dates ? `<p style="margin:0 0 4px;font-size:14px;color:${C.inkMid};">📅 ${dates}</p>` : ''}
    <p style="margin:0 0 18px;font-size:14px;color:${C.inkMid};">📍 ${location}</p>
    ${divider()}
    <p style="margin:0 0 14px;font-size:15px;color:${C.ink};line-height:1.65;">
      Hey <strong>${recipientName}</strong>! ✅ <strong>${tripName}</strong> is confirmed and just <strong>2 days away</strong>.
      Almost time to go!
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:${C.inkMid};line-height:1.65;">
      Before you head out, take a few minutes to review and manage any subscriptions you have — 
      so you're not paying for things while you're busy living your best life on this trip.
    </p>
    ${subSyncBlock()}
    ${itineraryBlock(trip)}
  `

  return { subject, html: emailBase(inner) }
}
