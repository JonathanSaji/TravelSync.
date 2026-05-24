'use client'

import { useMemo, useState } from 'react'
import { PlanDetails } from '../../types'
import { GeneratedTrip } from '../../lib/buildTripOrder'
import { ItineraryDayTabBar } from '../ItineraryDayTabBar'
import TopBar from '../TopBar'

interface Props {
  planDetails: PlanDetails
  trip: GeneratedTrip
  tripId: string | null
  onStartOver: () => void
  showToast:   (msg: string) => void
  authLabel?: string
  onAuthClick?: () => void
  currentUserId?: string | null
  canShareTrip?: boolean
}

// ── Confirmed itinerary data ────────────────────────────────────────────────
// Replace with a prop passed down from AIDraft once you wire up a real API.

interface FinalStop {
  num:       number
  numCls:    string    // Tailwind bg-* for the numbered circle
  accentFrom: string   // Tailwind from-* for the top accent gradient
  accentTo:   string   // Tailwind to-* (use arbitrary value for one-off colours)
  when:      string
  name:      string
  desc:      string
  icon:      string
}

function tripToStopsForDay(trip: GeneratedTrip, dayIndex: number): FinalStop[] {
  const day = trip.itinerary[dayIndex]
  if (!day) return []

  const colors = ['bg-sage', 'bg-sand', 'bg-terra']
  const accents = [
    { from: 'from-sage', to: 'to-sage-light' },
    { from: 'from-sand', to: 'to-[#d4b896]' },
    { from: 'from-terra', to: 'to-[#cc8a6a]' },
  ]
  const multiDay = trip.itinerary.length > 1

  return day.activities.map((activity, i) => {
    const colorIdx = i % colors.length
    return {
      num: i + 1,
      numCls: colors[colorIdx],
      accentFrom: accents[colorIdx].from,
      accentTo: accents[colorIdx].to,
      when: multiDay ? activity.time : `Day ${day.day} · ${activity.time}`,
      name: activity.name,
      desc: activity.description,
      icon: '📍',
    }
  })
}

// ── Screen component ────────────────────────────────────────────────────────

export default function SuccessState({ planDetails, trip, tripId, onStartOver, showToast, authLabel, onAuthClick, currentUserId, canShareTrip = true }: Props) {
  const days = trip.itinerary
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareUsername, setShareUsername] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const stops = useMemo(
    () => tripToStopsForDay(trip, Math.min(activeDayIndex, Math.max(0, days.length - 1))),
    [trip, activeDayIndex, days.length],
  )

  const copyText = async (value: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      try {
        const fallback = document.createElement('textarea')
        fallback.value = value
        fallback.setAttribute('readonly', 'true')
        fallback.style.position = 'fixed'
        fallback.style.opacity = '0'
        document.body.appendChild(fallback)
        fallback.focus()
        fallback.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(fallback)
        return ok
      } catch {
        return false
      }
    }
  }

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (!url) {
      showToast('No link available to copy.')
      return
    }
    void copyText(url).then(ok => {
      showToast(ok ? 'Link copied! 🔗' : 'Could not copy link.')
    })
  }

  const handleShareTrip = async () => {
    if (!tripId) {
      showToast('Save the itinerary first before sharing.')
      return
    }
    if (!currentUserId) {
      showToast('Log in to share this trip.')
      return
    }

    const username = shareUsername.trim()
    const email = shareEmail.trim()
    if (!username || !email) {
      showToast('Enter both username and email.')
      return
    }

    setShareBusy(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          username,
          email,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not share trip.')
        return
      }
      setShareUsername('')
      setShareEmail('')
      setShareDialogOpen(false)
      showToast(`Shared with ${data.sharedUser?.username ?? username}.`)
    } catch (error) {
      console.error('Share trip error:', error)
      showToast('Could not share trip right now.')
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <section
      className="flex flex-col w-full max-w-[480px] min-h-[100dvh] px-5 pb-[52px] relative z-[1] animate-fade-up"
      role="main"
      aria-labelledby="s4-title"
      aria-live="polite"
    >
      <TopBar step="Done ✓" authLabel={authLabel} onAuthClick={onAuthClick} />

      <div className="flex-1 flex flex-col gap-5">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="text-center pt-6 pb-1">
          {/* Lock badge — spring animation via animate-lock-pop */}
          <div
            className="w-[66px] h-[66px] bg-sage rounded-full flex items-center justify-center mx-auto mb-4 text-[1.65rem] shadow-[0_4px_18px_rgba(122,158,142,0.28)] animate-lock-pop"
            role="img"
            aria-label="Plan locked"
          >
            🔒
          </div>
          <h2
            id="s4-title"
            className="font-display text-[clamp(1.55rem,6.5vw,2rem)] leading-[1.13] tracking-[-0.02em] text-ink mb-2"
          >
            Plan Locked!
          </h2>
          <p className="text-[0.9rem] text-ink-mid leading-relaxed max-w-[270px] mx-auto">
            A balanced itinerary where everyone's ideas were heard.
          </p>
        </div>

        {/* Celebration strip */}
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {(['🎉', '✨', '🌟', '✨', '🎉'] as const).map((emoji, i) => (
            <span
              key={i}
              className="text-[1.05rem] animate-cel-wiggle"
              style={{ animationDelay: `${i * 0.14}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* ── Confirmed itinerary ────────────────────────────────── */}
        <div role="region" aria-label="Final confirmed itinerary">
          <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
            Confirmed Itinerary
          </p>

          {days.length > 1 && (
            <div className="mb-3 -mx-0.5">
              <ItineraryDayTabBar
                days={days}
                activeIndex={activeDayIndex}
                onChange={setActiveDayIndex}
              />
            </div>
          )}

          <div
            className="flex flex-col gap-[9px]"
            role="tabpanel"
            id={
              days[activeDayIndex]
                ? `itinerary-day-panel-${days[activeDayIndex].day}`
                : undefined
            }
            aria-labelledby={
              days[activeDayIndex]
                ? `itinerary-day-tab-${days[activeDayIndex].day}`
                : undefined
            }
          >
            {stops.map((stop, i) => (
              <article
                key={`${activeDayIndex}-${stop.num}`}
                className="bg-white border border-cream-deep rounded-panel overflow-hidden shadow-soft animate-fade-up"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {/* Colour accent bar */}
                <div
                  className={`h-[3px] bg-gradient-to-r ${stop.accentFrom} ${stop.accentTo}`}
                  aria-hidden="true"
                />
                <div className="flex items-start gap-3 p-[13px] px-[15px]">
                  {/* Numbered circle */}
                  <div
                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[0.78rem] font-bold text-white flex-shrink-0 ${stop.numCls}`}
                    aria-hidden="true"
                  >
                    {stop.num}
                  </div>
                  {/* Info */}
                  <div className="flex-1">
                    <div className="text-[0.72rem] font-semibold text-ink-faint uppercase tracking-[0.06em]">
                      {stop.when}
                    </div>
                    <div className="text-[0.97rem] font-semibold text-ink my-0.5">
                      {stop.name}
                    </div>
                    <div className="text-[0.79rem] text-ink-mid leading-relaxed">
                      {stop.desc}
                    </div>
                  </div>
                  {/* Icon */}
                  <span className="text-[1.3rem] flex-shrink-0 mt-px" aria-hidden="true">
                    {stop.icon}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ── Share row ──────────────────────────────────────────── */}
        {canShareTrip && (
          <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
            Share with the group
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-4 py-[10px] rounded-card bg-transparent text-ink border-[1.5px] border-cream-deep font-semibold text-[0.83rem] transition-all active:scale-[0.97] hover:bg-parchment hover:border-ink-faint [-webkit-tap-highlight-color:transparent]"
              aria-label="Copy invite link"
            >
              🔗 Copy Link
            </button>
            <button
              onClick={() => setShareDialogOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-[10px] rounded-card bg-transparent text-ink border-[1.5px] border-cream-deep font-semibold text-[0.83rem] transition-all active:scale-[0.97] hover:bg-parchment hover:border-ink-faint [-webkit-tap-highlight-color:transparent]"
              aria-label="Share with a specific user"
            >
              👤 Share with Sync
            </button>
          </div>
          </div>
        )}

        {shareDialogOpen && (
          <div
            className="fixed inset-0 z-[160] bg-ink/35"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-trip-title"
            onMouseDown={() => setShareDialogOpen(false)}
          >
            <div
              className="absolute left-1/2 top-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-cream-deep bg-white p-4 shadow-float"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 id="share-trip-title" className="text-[0.86rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">
                  Share Trip
                </h3>
                <button
                  type="button"
                  className="rounded-card border border-cream-deep px-2 py-1 text-[0.72rem] font-medium text-ink-mid hover:bg-parchment"
                  onClick={() => setShareDialogOpen(false)}
                  aria-label="Close share dialog"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={shareUsername}
                  onChange={e => setShareUsername(e.target.value)}
                  placeholder="Username"
                  className="input-field"
                  autoComplete="off"
                />
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="Email"
                  className="input-field"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleShareTrip}
                  disabled={shareBusy}
                  className="flex w-full items-center justify-center rounded-card bg-ink px-3 py-2 text-[0.8rem] font-semibold text-white transition hover:bg-[#1c1b18] disabled:opacity-60"
                >
                  {shareBusy ? 'Sharing…' : 'Share with user'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start over */}
        <button
          onClick={onStartOver}
          className="btn-primary bg-ink text-white shadow-[0_2px_10px_rgba(44,43,40,0.16)] hover:bg-[#1c1b18]"
          aria-label="Start a new plan"
        >
          Plan Something New ↗
        </button>
      </div>
    </section>
  )
}
