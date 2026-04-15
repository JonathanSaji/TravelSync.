'use client'

import { useMemo, useState } from 'react'
import { PlanDetails } from '../../types'
import { GeneratedTrip } from '../../lib/buildTripOrder'
import { ItineraryDayTabBar } from '../ItineraryDayTabBar'
import TopBar from '../TopBar'

interface Props {
  planDetails: PlanDetails
  trip: GeneratedTrip
  onStartOver: () => void
  showToast:   (msg: string) => void
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

function tripToShareLines(trip: GeneratedTrip): string[] {
  const lines: string[] = []
  for (const day of trip.itinerary) {
    lines.push(`Day ${day.day} — ${day.theme}`)
    for (const activity of day.activities) {
      const tags = activity.tags.length ? ` [${activity.tags.join(', ')}]` : ''
      lines.push(`- ${activity.time} · ${activity.name}`)
      lines.push(`  ${activity.description}${tags}`)
    }
    lines.push('')
  }
  return lines.filter((line, index, arr) => !(line === '' && index === arr.length - 1))
}

// ── Screen component ────────────────────────────────────────────────────────

export default function SuccessState({ planDetails, trip, onStartOver, showToast }: Props) {
  const days = trip.itinerary
  const [activeDayIndex, setActiveDayIndex] = useState(0)
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

  const handleShareText = () => {
    const stopsText = tripToShareLines(trip).join('\n')
    const harmonyLine = trip.harmonyPlan?.conflicts?.length
      ? `\nSyncing ideas: ${trip.harmonyPlan.conflicts
          .map(c => `${c.title} -> ${c.resolution?.plan ?? 'balanced in itinerary'}`)
          .join(' | ')}`
      : trip.harmonyPlan?.note
        ? `\nSyncing ideas: ${trip.harmonyPlan.note}`
        : ''
    const msg = `AI Trip Draft\nTrip: ${trip.tripName}\nLocation: ${planDetails.location}\nDates: ${planDetails.dates}${harmonyLine}\n\nItinerary:\n${stopsText}`
    void copyText(msg).then(ok => {
      showToast(ok ? 'AI itinerary text copied! 💬' : 'Could not copy itinerary text.')
    })
  }

  return (
    <section
      className="flex flex-col w-full max-w-[480px] min-h-[100dvh] px-5 pb-[52px] relative z-[1] animate-fade-up"
      role="main"
      aria-labelledby="s4-title"
      aria-live="polite"
    >
      <TopBar step="Done ✓" />

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
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
            Share with the group
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-4 py-[10px] rounded-card bg-transparent text-ink border-[1.5px] border-cream-deep font-semibold text-[0.83rem] transition-all active:scale-[0.97] hover:bg-parchment hover:border-ink-faint [-webkit-tap-highlight-color:transparent]"
              aria-label="Copy invite link"
            >
              🔗 Copy Link
            </button>
            <button
              onClick={handleShareText}
              className="flex items-center justify-center gap-2 px-4 py-[10px] rounded-card bg-transparent text-ink border-[1.5px] border-cream-deep font-semibold text-[0.83rem] transition-all active:scale-[0.97] hover:bg-parchment hover:border-ink-faint [-webkit-tap-highlight-color:transparent]"
              aria-label="Share as text message"
            >
              💬 Share Text
            </button>
          </div>
        </div>

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
