'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PlanDetails, IdeaItem, TimeCommitment } from '../../types'
import { buildOrderData, isGeneratedTrip, type GeneratedTrip } from '../../lib/buildTripOrder'
import { getIdeaIcon } from '../../lib/utils'
import TopBar from '../TopBar'

interface Props {
  planDetails: PlanDetails
  ideas:       IdeaItem[]
  tripId: string | null
  currentUserId?: string | null
  canShareSandbox?: boolean
  canGenerateItinerary?: boolean
  onPersistSandbox?: () => Promise<void>
  onAddIdea:   (idea: IdeaItem) => void
  onRemoveIdea: (ideaId: string) => void
  onTripReady: (trip: GeneratedTrip) => void
  onGenerate:  () => void
  showToast:   (msg: string) => void
  authLabel?: string
  onAuthClick?: () => void
  currentTrip?: GeneratedTrip | null
}

// ── Internal helpers ────────────────────────────────────────────────────────

const TIME_OPTIONS: { value: TimeCommitment; label: string; short: string }[] = [
  { value: 'regular', label: 'Regular visit (~1–2 hrs)', short: '~1–2h' },
  { value: 'half_day', label: 'Half day', short: '½ day' },
  { value: 'full_day', label: 'Full day', short: 'Full day' },
  { value: 'anchor', label: 'Trip anchor / major focus', short: 'Anchor' },
]

const PRIORITY_HINTS = ['', 'Nice to have', 'Low', 'Medium', 'High', 'Must-include'] as const

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-[14px]">
      <span className="text-[0.7rem] font-semibold tracking-[0.09em] uppercase text-ink-faint whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-cream-deep" />
    </div>
  )
}

function normalizeUrl(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function IdeaCard({ idea, onRemove }: { idea: IdeaItem; onRemove: (ideaId: string) => void }) {
  const mustInclude = idea.priorityEnabled === false
  const hasEventTime = Boolean(idea.eventTime?.trim())
  const safeUrl = idea.eventLink?.trim() ? normalizeUrl(idea.eventLink) : ''

  return (
    <div
      className="bg-white border border-cream-deep rounded-card px-3.5 py-[11px] flex items-start gap-2.5 shadow-soft animate-pop-in"
      role="listitem"
    >
      <span className="text-[1.05rem] flex-shrink-0 mt-px" aria-hidden="true">
        {getIdeaIcon(idea.text)}
      </span>
      <div className="flex-1">
        <p className="text-[0.88rem] text-ink leading-[1.45] break-words">{idea.text}</p>
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          {idea.isCustomEvent && (
            <span
              className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-[#e5ecff] text-[#2b4da3]"
              aria-label="Custom event"
            >
              Event
            </span>
          )}
          <span
            className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-sand-light text-sand"
            aria-label={`Priority ${idea.priority} of 5`}
          >
            P{idea.priority}/5
          </span>
          {mustInclude && (
            <span
              className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-[#e8f4d8] text-[#4f6d2a]"
              aria-label="Must include in itinerary"
            >
              Must include
            </span>
          )}
          <span
            className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-sage-dim text-sage"
            aria-label={`Time: ${TIME_OPTIONS.find(o => o.value === idea.timeCommitment)?.label ?? idea.timeCommitment}`}
          >
            {TIME_OPTIONS.find(o => o.value === idea.timeCommitment)?.short ?? idea.timeCommitment}
          </span>
          {hasEventTime && (
            <span
              className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-[#f0ecff] text-[#5f4aa6]"
              aria-label={`Event time ${idea.eventTime} with ${idea.eventTimeFlexible === false ? 'fixed' : 'flexible'} scheduling`}
            >
              {idea.eventTimeFlexible === false ? 'Fixed time' : 'Flexible time'}: {idea.eventTime}
            </span>
          )}
          {/* Dealbreaker chip */}
          {idea.dealbreaker && (
            <span
              className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-terra-light text-terra"
              aria-label={`Dealbreaker: ${idea.dealbreaker}`}
            >
              🚫 {idea.dealbreaker}
            </span>
          )}
        </div>
        {(idea.eventLocation?.trim() || safeUrl) && (
          <div className="mt-1.5 text-[0.72rem] text-ink-mid leading-relaxed space-y-1">
            {idea.eventLocation?.trim() && <p>Location: {idea.eventLocation.trim()}</p>}
            {safeUrl && (
              <a href={safeUrl} target="_blank" rel="noreferrer" className="underline text-[#2b4da3] break-all">
                {safeUrl}
              </a>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(idea.id)}
        className="rounded-card border border-cream-deep px-2 py-1 text-[0.68rem] font-semibold text-ink-mid hover:bg-parchment"
        aria-label="Remove idea"
      >
        Remove
      </button>
    </div>
  )
}

// ── Idea count hint text ────────────────────────────────────────────────────
function genHint(count: number): string {
  if (count === 0) return 'Add at least one idea to generate an itinerary'
  if (count === 1) return '1 idea added — add more or generate now'
  return `${count} ideas in the sandbox — AI will reconcile them all`
}

const GENERATE_PHRASES = [
  "AI is drafting your itinerary…",
  'Balancing priorities & time on the calendar…',
  'Checking dealbreakers & timing…',
  'Almost ready…',
]

// ── Screen component ────────────────────────────────────────────────────────

export default function IdeaSandbox({
  planDetails,
  ideas,
  tripId,
  currentUserId,
  canShareSandbox = true,
  canGenerateItinerary = true,
  onPersistSandbox,
  onAddIdea,
  onRemoveIdea,
  onTripReady,
  onGenerate,
  showToast,
  authLabel,
  onAuthClick,
  currentTrip,
}: Props) {
  const [ideaText,        setIdeaText]        = useState('')
  const [priority,        setPriority]        = useState(3)
  const [timeCommitment,  setTimeCommitment]  = useState<TimeCommitment>('regular')
  const [dealbreaker,     setDealbreaker]     = useState('')
  const [isCustomEvent,   setIsCustomEvent]   = useState(false)
  const [eventLink,       setEventLink]       = useState('')
  const [eventLocation,   setEventLocation]   = useState('')
  const [eventTime,       setEventTime]       = useState('')
  const [eventTimeFlexible, setEventTimeFlexible] = useState(true)
  const [priorityEnabled, setPriorityEnabled] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genLabel,     setGenLabel]     = useState(GENERATE_PHRASES[0])
  const [shareBusy, setShareBusy] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareUsername, setShareUsername] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy as text')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const generateInFlightRef = useRef(false)

  // Focus textarea on mount so mobile users can start typing immediately
  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    if (!isGenerating) return
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % GENERATE_PHRASES.length
      setGenLabel(GENERATE_PHRASES[idx])
    }, 1500)
    return () => clearInterval(interval)
  }, [isGenerating])

  const handleAdd = () => {
    if (isGenerating) return
    const text = ideaText.trim()
    if (!text) {
      showToast('Write an idea or paste a link first.')
      textareaRef.current?.focus()
      return
    }
    onAddIdea({
      id:             crypto.randomUUID(),
      text,
      priority,
      timeCommitment,
      dealbreaker:    dealbreaker.trim(),
      isCustomEvent,
      eventLink: eventLink.trim(),
      eventLocation: eventLocation.trim(),
      eventTime: eventTime.trim(),
      eventTimeFlexible,
      priorityEnabled,
    })
    setIdeaText('')
    setDealbreaker('')
    setEventLink('')
    setEventLocation('')
    setEventTime('')
    setEventTimeFlexible(true)
    setPriorityEnabled(true)
    setIsCustomEvent(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isGenerating) return
    // Enter (without Shift) submits; Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() }
  }

  const handleShareSandbox = async () => {
    if (!canShareSandbox) {
      showToast('Only the trip owner can share this sandbox.')
      return
    }
    if (!tripId) {
      showToast('Create the plan first before sharing.')
      return
    }
    if (!currentUserId) {
      showToast('Log in to share this sandbox.')
      return
    }

    const username = shareUsername.trim()
    const email = shareEmail.trim()
    if (!username || !email) {
      showToast('Enter both username and email.')
      return
    }

    if (shareBusy || isGenerating) return
    setShareBusy(true)
    try {
      if (onPersistSandbox) {
        await onPersistSandbox()
      }

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
        showToast(typeof data.error === 'string' ? data.error : 'Could not share sandbox.')
        return
      }
      setShareUsername('')
      setShareEmail('')
      setShareDialogOpen(false)
      showToast(`Sandbox shared with ${data.sharedUser?.username ?? username}.`)
    } catch (e) {
      console.error('Share sandbox error:', e)
      showToast('Could not share sandbox right now.')
    } finally {
      setShareBusy(false)
    }
  }

  const handleCopyTrip = useCallback(async () => {
    if (!currentTrip) { showToast('No itinerary to copy.'); return }
    const lines: string[] = [currentTrip.tripName, '']
    for (const day of currentTrip.itinerary) {
      lines.push(`Day ${day.day}${day.theme ? ` — ${day.theme}` : ''}`)
      for (const act of day.activities) {
        lines.push(`  ${act.time}: ${act.name}`)
        if (act.description) lines.push(`    ${act.description}`)
        if (act.tags?.length) lines.push(`    [${act.tags.join(', ')}]`)
      }
      lines.push('')
    }
    if (currentTrip.harmonyPlan?.note) {
      lines.push(`Group note: ${currentTrip.harmonyPlan.note}`)
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy as text'), 2000)
    } catch {
      showToast('Could not copy to clipboard.')
    }
  }, [currentTrip, showToast])

  /** Returns true only when the API returns a usable itinerary (so the app can advance). */
  const handleGenerateTrip = async (): Promise<boolean> => {
    if (!canGenerateItinerary) {
      showToast('Ask owner to create itinerary.')
      return false
    }
    if (isGenerating || generateInFlightRef.current) return false
    if (ideas.length === 0) {
      showToast('Add at least one idea to the sandbox first.')
      return false
    }

    void confirmAndGenerate()
    return true
  }

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const button = target.closest('[data-generate-button="true"]')
      if (!button) return
      event.preventDefault()
      void handleGenerateTrip()
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [handleGenerateTrip])

  const confirmAndGenerate = async () => {
    setConfirmOpen(false)
    const orderData = buildOrderData(planDetails, ideas, {
      text: ideaText,
      priority,
      timeCommitment,
      dealbreaker,
      isCustomEvent,
      eventLink,
      eventLocation,
      eventTime,
      eventTimeFlexible,
      priorityEnabled,
    })

    generateInFlightRef.current = true
    setGenLabel(GENERATE_PHRASES[0])
    setIsGenerating(true)
    let succeeded = false
    try {
      const response = await fetch('/api/generate-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      const tripData = await response.json()
      if (!response.ok || tripData?.error || !isGeneratedTrip(tripData)) {
        showToast(typeof tripData?.error === 'string' ? tripData.error : 'Failed to generate trip. Please try again.')
        return
      }
      onTripReady(tripData)
      succeeded = true
      onGenerate()
    } catch (error) {
      console.error('Generate trip error:', error)
      showToast('Could not reach the trip planner. Try again.')
    } finally {
      if (!succeeded) {
        generateInFlightRef.current = false
        setIsGenerating(false)
      }
    }
  }

  return (
    <section
      className="flex flex-col w-full max-w-[480px] min-h-[100dvh] px-5 pb-[52px] relative z-[1] animate-fade-up"
      role="main"
      aria-labelledby="s2-title"
      aria-live="polite"
    >
      {isGenerating && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 px-6 text-center bg-cream/92 backdrop-blur-[3px]"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="sandbox-gen-title"
        >
          <div className="pulse-ring w-[66px] h-[66px] rounded-full bg-sage-dim flex items-center justify-center">
            <span className="text-[1.65rem]" aria-hidden="true">✦</span>
          </div>
          <div>
            <p id="sandbox-gen-title" className="text-[0.9rem] text-ink-mid font-medium animate-load-pulse">
              {genLabel}
            </p>
            <p className="text-[0.75rem] text-ink-faint mt-2 max-w-[280px] mx-auto leading-relaxed">
              Hang tight — only one request runs at a time.
            </p>
            <div className="flex gap-1.5 justify-center mt-3" aria-hidden="true">
              <span className="w-1.5 h-1.5 bg-sage-light rounded-full animate-bounce-dot" />
              <span className="w-1.5 h-1.5 bg-sage-light rounded-full animate-bounce-dot [animation-delay:.2s]" />
              <span className="w-1.5 h-1.5 bg-sage-light rounded-full animate-bounce-dot [animation-delay:.4s]" />
            </div>
          </div>
        </div>
      )}

      <TopBar step="Step 1 / 3" authLabel={authLabel} onAuthClick={onAuthClick} />

      <h2
        id="s2-title"
        className="font-display text-[clamp(1.9rem,7.5vw,2.6rem)] leading-[1.13] tracking-[-0.02em] text-ink mb-[14px]"
      >
        Idea<br />Sandbox
      </h2>

      {/* ── Plan context bar ──────────────────────────────────── */}
      <div
        className="flex items-center flex-wrap gap-1.5 bg-white border border-cream-deep rounded-panel px-4 py-3 shadow-soft mb-[18px]"
        role="region"
        aria-label="Plan context"
      >
        {[
          { icon: '📍', value: planDetails.location },
          { icon: '🗓️', value: planDetails.dates },
          { icon: '✦',  value: planDetails.name },
          ...(planDetails.group.trim()
            ? [{ icon: '👥', value: planDetails.group } as const]
            : []),
          ...(planDetails.budget.trim()
            ? [{ icon: '💰', value: planDetails.budget } as const]
            : []),
        ].map(({ icon, value }, i) => (
          <span key={i} className="flex items-center gap-[5px] text-[0.8rem] text-ink-mid font-medium">
            {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-cream-deep mx-1" aria-hidden="true" />}
            {icon} <strong className="text-ink font-semibold">{value}</strong>
          </span>
        ))}
      </div>

      {/* ── Share / collaborate (Sync) ─────────────────────────── */}
      <div
        className="bg-white border border-cream-deep rounded-panel px-4 py-3 shadow-soft mb-[18px]"
        role="region"
        aria-label="Share sandbox with group"
      >
        <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
          Group collaboration
        </p>
        <p className="text-[0.78rem] text-ink-mid leading-relaxed mb-3">
          Share this sandbox with another Sync user so you can build ideas together in one place.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              disabled={isGenerating || shareBusy || !canShareSandbox || !tripId}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-white border border-cream-deep text-ink font-semibold text-[0.83rem] shadow-soft transition-all active:scale-[0.98] hover:bg-parchment disabled:opacity-50 disabled:pointer-events-none"
            >
              👤 Share within Sync
            </button>
            <button
              type="button"
              onClick={() => { void handleCopyTrip() }}
              disabled={!currentTrip}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-white border border-cream-deep text-ink font-semibold text-[0.83rem] shadow-soft transition-all active:scale-[0.98] hover:bg-parchment disabled:opacity-50 disabled:pointer-events-none"
              title={currentTrip ? 'Copy itinerary as readable text' : 'Generate an itinerary first'}
            >
              📋 {copyLabel}
            </button>
          </div>
          {!canShareSandbox && (
            <p className="text-[0.72rem] text-ink-faint">
              This sandbox was shared with you. Only the owner can share it with more users.
            </p>
          )}
        </div>
      </div>

      {shareDialogOpen && (
        <div className="fixed inset-0 z-[130] bg-ink/35" role="dialog" aria-modal="true" aria-labelledby="sandbox-share-title" onMouseDown={() => setShareDialogOpen(false)}>
          <div
            className="absolute left-1/2 top-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-cream-deep bg-white p-4 shadow-float"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="sandbox-share-title" className="text-[0.86rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">
                Share Sandbox
              </h3>
              <button
                type="button"
                className="rounded-card border border-cream-deep px-2 py-1 text-[0.72rem] font-medium text-ink-mid hover:bg-parchment"
                onClick={() => setShareDialogOpen(false)}
                aria-label="Close sandbox share dialog"
              >
                Close
              </button>
            </div>

            <div className="rounded-card border border-cream-deep bg-parchment px-3 py-3">
              <p className="text-[0.72rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">
                Share with a Sync user
              </p>

              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={shareUsername}
                  onChange={e => setShareUsername(e.target.value)}
                  placeholder="Username"
                  className="input-field"
                  autoComplete="username"
                />
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="Email"
                  className="input-field"
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={handleShareSandbox}
                  disabled={shareBusy || isGenerating}
                  className="flex w-full items-center justify-center rounded-card bg-ink px-3 py-2 text-[0.8rem] font-semibold text-white transition hover:bg-[#1c1b18] disabled:opacity-60"
                  aria-label="Share sandbox"
                >
                  {shareBusy ? 'Sharing…' : 'Share sandbox'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Group Idea Board ──────────────────────────────────── */}
      <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
        Group Idea Board
      </p>
      <div
        className={[
          'min-h-[108px] rounded-panel p-3 flex flex-col gap-2 bg-parchment mb-[14px]',
          'transition-all duration-[260ms]',
          ideas.length > 0
            ? 'border border-cream-deep'
            : 'border-[1.5px] border-dashed border-cream-deep',
        ].join(' ')}
        role="region"
        aria-label="Group idea board"
        aria-live="polite"
      >
        {ideas.length === 0 ? (
          <div className="text-center py-5 text-ink-faint text-[0.83rem] leading-relaxed">
            <span className="block text-[1.45rem] mb-1.5" aria-hidden="true">💭</span>
            Ideas from your group will appear here
          </div>
        ) : (
          ideas.map(idea => <IdeaCard key={idea.id} idea={idea} onRemove={onRemoveIdea} />)
        )}
      </div>

      {/* ── Add idea form ─────────────────────────────────────── */}
      <div className="bg-white border border-cream-deep rounded-panel p-[18px] shadow-soft mb-[14px]">
        <CardLabel>Add Your Idea</CardLabel>

        <div className="mb-[13px]">
          {!isCustomEvent ? (
            <button
              type="button"
              onClick={() => setIsCustomEvent(true)}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-[9px] rounded-card border border-dashed border-cream-deep text-[0.8rem] font-semibold text-ink-mid hover:bg-parchment transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              📌 Add as custom event
            </button>
          ) : (
            <div className="rounded-card border border-[#c5d4ff] bg-[#f0f4ff] px-3 py-2.5 animate-pop-in">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[0.78rem] font-semibold text-[#2b4da3]">📌 Custom event</span>
                <button
                  type="button"
                  onClick={() => { setIsCustomEvent(false); setEventLink(''); setEventLocation(''); setEventTime(''); setEventTimeFlexible(true); setPriorityEnabled(true) }}
                  disabled={isGenerating}
                  className="text-[0.7rem] font-semibold text-ink-mid underline hover:text-ink disabled:opacity-50"
                >
                  Remove custom event
                </button>
              </div>
              <p className="text-[0.7rem] text-[#4f6d9e]">
                Go back to AI-generated event — AI picks the best time and format automatically.
              </p>
            </div>
          )}
        </div>

        {/* Idea text */}
        <div className="mb-[13px]">
          <label htmlFor="inp-idea" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
            Idea or Preference
          </label>
          <textarea
            id="inp-idea"
            ref={textareaRef}
            value={ideaText}
            onChange={e => setIdeaText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder="e.g. I want hiking + nature views, budget-friendly food spots, 9 am start time, avoid messy areas"
            className="textarea-field"
          />
        </div>

        {/* Priority */}
        <div className="mb-[13px]">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor="inp-priority" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid">
              Priority {isCustomEvent && !priorityEnabled ? '— priority logic off, event will be included' : ''}
            </label>
            <span className="text-[0.72rem] font-medium text-ink-mid tabular-nums" id="priority-hint">
              {priority}/5 — {PRIORITY_HINTS[priority]}
            </span>
          </div>
          <input
            id="inp-priority"
            type="range"
            min={1}
            max={5}
            step={1}
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            disabled={isGenerating || (isCustomEvent && !priorityEnabled)}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={priority}
            aria-valuetext={`${priority} of 5, ${PRIORITY_HINTS[priority]}`}
            aria-describedby="priority-hint"
            className="w-full h-2 rounded-full appearance-none bg-cream-deep cursor-pointer disabled:opacity-50 disabled:pointer-events-none accent-[#7A9E8E]"
          />
        </div>

        {isCustomEvent && (
          <div className="mb-[13px] rounded-card border border-cream-deep px-3 py-2.5 bg-parchment">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[0.78rem] font-semibold text-ink-mid">Use priority logic</span>
              <input
                type="checkbox"
                checked={priorityEnabled}
                onChange={e => setPriorityEnabled(e.target.checked)}
                disabled={isGenerating}
                aria-label="Use priority logic for this custom event"
              />
            </label>
            <p className="text-[0.7rem] text-ink-faint mt-1">
              {priorityEnabled
                ? 'AI weighs this event by the priority slider above.'
                : 'Priority logic off — this event will always be included in the itinerary.'}
            </p>
          </div>
        )}

        {/* Time commitment + Dealbreaker */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="inp-time" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
              Time commitment
            </label>
            <select
              id="inp-time"
              value={timeCommitment}
              onChange={e => setTimeCommitment(e.target.value as TimeCommitment)}
              disabled={isGenerating}
              aria-label="Time commitment for this idea"
              className="select-field"
            >
              {TIME_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inp-deal" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
              Dealbreakers
            </label>
            <input
              id="inp-deal"
              type="text"
              value={dealbreaker}
              onChange={e => setDealbreaker(e.target.value)}
              disabled={isGenerating}
              placeholder="e.g. No seafood"
              maxLength={52}
              className="input-field"
            />
          </div>
        </div>

        {isCustomEvent && (
          <div className="mt-[12px] space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="inp-event-location" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
                  Event location
                </label>
                <input
                  id="inp-event-location"
                  type="text"
                  value={eventLocation}
                  onChange={e => setEventLocation(e.target.value)}
                  disabled={isGenerating}
                  placeholder="e.g. ByWard Market"
                  maxLength={80}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="inp-event-time" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
                  Event time (optional)
                </label>
                <input
                  id="inp-event-time"
                  type="text"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  disabled={isGenerating}
                  placeholder="e.g. 2:00 PM"
                  maxLength={40}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label htmlFor="inp-event-link" className="block text-[0.74rem] font-semibold tracking-[0.05em] uppercase text-ink-mid mb-1.5">
                Event link (optional)
              </label>
              <input
                id="inp-event-link"
                type="url"
                value={eventLink}
                onChange={e => setEventLink(e.target.value)}
                disabled={isGenerating}
                placeholder="https://..."
                maxLength={220}
                className="input-field"
              />
            </div>

            {eventTime.trim() && (
              <div className="rounded-card border border-cream-deep px-3 py-2.5 bg-parchment">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[0.78rem] font-semibold text-ink-mid">Time is flexible</span>
                  <input
                    type="checkbox"
                    checked={eventTimeFlexible}
                    onChange={e => setEventTimeFlexible(e.target.checked)}
                    disabled={isGenerating}
                    aria-label="Allow AI to place custom event at the best time"
                  />
                </label>
                <p className="text-[0.7rem] text-ink-faint mt-1">
                  Turn off to force this event at the exact time you entered.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isGenerating}
            className="flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-sage text-white font-semibold text-[0.83rem] shadow-[0_2px_10px_rgba(122,158,142,0.2)] transition-all active:scale-[0.97] hover:bg-[#6a8e7e] [-webkit-tap-highlight-color:transparent] disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Add idea to sandbox"
          >
            ＋ Add to Sandbox
          </button>
        </div>
      </div>

      {/* ── Sticky generate button ────────────────────────────── */}
      <div className="sticky bottom-0 pt-[14px] bg-gradient-to-t from-cream from-[70%] to-transparent">
        <button
          type="button"
          data-generate-button="true"
          disabled={isGenerating || !canGenerateItinerary}
          className="btn-primary bg-ink text-white shadow-[0_2px_10px_rgba(44,43,40,0.16)] hover:bg-[#1c1b18] disabled:opacity-60 disabled:pointer-events-none"
          aria-label="Generate AI itinerary"
        >
          {canGenerateItinerary ? (
            <>
              <span aria-hidden="true">✦</span> {isGenerating ? 'Generating…' : 'Generate Itinerary (AI)'}
            </>
          ) : (
            'Ask owner to create itinerary'
          )}
        </button>
        <p className="text-center text-[0.73rem] text-ink-faint mt-[7px]">
          {canGenerateItinerary ? genHint(ideas.length) : 'You can still add ideas to help shape the final plan.'}
        </p>
      </div>
    </section>
  )
}
