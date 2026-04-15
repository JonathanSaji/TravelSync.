'use client'

import { useState, useRef, useEffect } from 'react'
import { PlanDetails, IdeaItem, TimeCommitment } from '../../types'
import { buildOrderData, isGeneratedTrip, type GeneratedTrip } from '../../lib/buildTripOrder'
import { getIdeaIcon } from '../../lib/utils'
import TopBar from '../TopBar'

interface Props {
  planDetails: PlanDetails
  ideas:       IdeaItem[]
  /** JSONBin id when this sandbox is shared or opened from a share link. */
  shareBinId: string | null
  onShareBinId: (binId: string) => void
  onAddIdea:   (idea: IdeaItem) => void
  onTripReady: (trip: GeneratedTrip) => void
  onGenerate:  () => void
  showToast:   (msg: string) => void
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

function IdeaCard({ idea }: { idea: IdeaItem }) {
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
          <span
            className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-sand-light text-sand"
            aria-label={`Priority ${idea.priority} of 5`}
          >
            P{idea.priority}/5
          </span>
          <span
            className="text-[0.68rem] font-semibold px-2 py-[2px] rounded-full bg-sage-dim text-sage"
            aria-label={`Time: ${TIME_OPTIONS.find(o => o.value === idea.timeCommitment)?.label ?? idea.timeCommitment}`}
          >
            {TIME_OPTIONS.find(o => o.value === idea.timeCommitment)?.short ?? idea.timeCommitment}
          </span>
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
      </div>
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

function shareUrlForBin(binId: string): string {
  if (typeof window === 'undefined') return ''
  const u = new URL(window.location.href)
  u.search = ''
  u.searchParams.set('share', binId)
  return u.toString()
}

export default function IdeaSandbox({
  planDetails,
  ideas,
  shareBinId,
  onShareBinId,
  onAddIdea,
  onTripReady,
  onGenerate,
  showToast,
}: Props) {
  const [ideaText,        setIdeaText]        = useState('')
  const [priority,        setPriority]        = useState(3)
  const [timeCommitment,  setTimeCommitment]  = useState<TimeCommitment>('regular')
  const [dealbreaker,     setDealbreaker]     = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [genLabel,     setGenLabel]     = useState(GENERATE_PHRASES[0])
  const [shareBusy, setShareBusy] = useState(false)
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
    })
    setIdeaText('')
    setDealbreaker('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isGenerating) return
    // Enter (without Shift) submits; Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() }
  }

  const copyShareLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Share link copied to clipboard!')
    } catch {
      showToast('Could not copy automatically — copy the link from the address bar.')
    }
  }

  const handleCreateShare = async () => {
    if (shareBusy || isGenerating) return
    setShareBusy(true)
    try {
      const res = await fetch('/api/share-bin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planDetails, ideas }),
      })
      const data = await res.json()
      if (!res.ok || typeof data.binId !== 'string') {
        showToast(typeof data.error === 'string' ? data.error : 'Could not create share link.')
        return
      }
      onShareBinId(data.binId)
      const url = typeof data.shareUrl === 'string' ? data.shareUrl : shareUrlForBin(data.binId)
      await copyShareLink(url)
    } catch (e) {
      console.error('Create share error:', e)
      showToast('Could not reach the sharing service.')
    } finally {
      setShareBusy(false)
    }
  }

  const handlePushShare = async () => {
    if (!shareBinId || shareBusy || isGenerating) return
    setShareBusy(true)
    try {
      const res = await fetch('/api/share-bin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId: shareBinId, planDetails, ideas }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Could not update shared board.')
        return
      }
      showToast('Shared board updated — others can refresh to see changes.')
    } catch (e) {
      console.error('Push share error:', e)
      showToast('Could not reach the sharing service.')
    } finally {
      setShareBusy(false)
    }
  }

  /** Returns true only when the API returns a usable itinerary (so the app can advance). */
  const handleGenerateTrip = async (): Promise<boolean> => {
    if (isGenerating || generateInFlightRef.current) return false
    const hasBoard = ideas.length > 0
    const hasDraft = ideaText.trim().length > 0
    if (!hasBoard && !hasDraft) {
      showToast('Add at least one idea (or finish typing in the form) first.')
      return false
    }

    const orderData = buildOrderData(planDetails, ideas, {
      text: ideaText,
      priority,
      timeCommitment,
      dealbreaker,
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
        return false
      }
      onTripReady(tripData)
      succeeded = true
      return true
    } catch (error) {
      console.error('Generate trip error:', error)
      showToast('Could not reach the trip planner. Try again.')
      return false
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

      <TopBar step="Step 1 / 3" />

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

      {/* ── Share / collaborate (JSONBin) ─────────────────────── */}
      <div
        className="bg-white border border-cream-deep rounded-panel px-4 py-3 shadow-soft mb-[18px]"
        role="region"
        aria-label="Share sandbox with group"
      >
        <p className="text-[0.68rem] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-2">
          Group collaboration
        </p>
        <p className="text-[0.78rem] text-ink-mid leading-relaxed mb-3">
          Create a link so others can open this trip and add ideas on the board. Save updates to the cloud when your group adds or changes ideas.
        </p>
        <div className="flex flex-col gap-2">
          {!shareBinId ? (
            <button
              type="button"
              onClick={handleCreateShare}
              disabled={isGenerating || shareBusy}
              className="flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-white border border-cream-deep text-ink font-semibold text-[0.83rem] shadow-soft transition-all active:scale-[0.98] hover:bg-parchment disabled:opacity-50 disabled:pointer-events-none"
            >
              {shareBusy ? 'Creating link…' : '🔗 Create share link'}
            </button>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void copyShareLink(shareUrlForBin(shareBinId))}
                  disabled={isGenerating || shareBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-white border border-cream-deep text-ink font-semibold text-[0.83rem] shadow-soft transition-all active:scale-[0.98] hover:bg-parchment disabled:opacity-50 disabled:pointer-events-none"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={handlePushShare}
                  disabled={isGenerating || shareBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-[10px] rounded-card bg-sage text-white font-semibold text-[0.83rem] shadow-[0_2px_10px_rgba(122,158,142,0.2)] transition-all active:scale-[0.97] hover:bg-[#6a8e7e] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {shareBusy ? 'Saving…' : 'Save to shared board'}
                </button>
              </div>
              <p className="text-[0.7rem] text-ink-faint break-all leading-snug">
                {shareUrlForBin(shareBinId)}
              </p>
            </>
          )}
        </div>
      </div>

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
          ideas.map(idea => <IdeaCard key={idea.id} idea={idea} />)
        )}
      </div>

      {/* ── Add idea form ─────────────────────────────────────── */}
      <div className="bg-white border border-cream-deep rounded-panel p-[18px] shadow-soft mb-[14px]">
        <CardLabel>Add Your Idea</CardLabel>

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
              Priority
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
            disabled={isGenerating}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={priority}
            aria-valuetext={`${priority} of 5, ${PRIORITY_HINTS[priority]}`}
            aria-describedby="priority-hint"
            className="w-full h-2 rounded-full appearance-none bg-cream-deep cursor-pointer disabled:opacity-50 disabled:pointer-events-none accent-[#7A9E8E]"
          />
        </div>

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
          onClick={async () => {
            const ok = await handleGenerateTrip()
            if (ok) onGenerate()
          }}
          disabled={isGenerating}
          className="btn-primary bg-ink text-white shadow-[0_2px_10px_rgba(44,43,40,0.16)] hover:bg-[#1c1b18] disabled:opacity-60 disabled:pointer-events-none"
          aria-label="Generate AI itinerary"
        >
          <span aria-hidden="true">✦</span> {isGenerating ? 'Generating…' : 'Generate Itinerary (AI)'}
        </button>
        <p className="text-center text-[0.73rem] text-ink-faint mt-[7px]">
          {genHint(ideas.length)}
        </p>
      </div>
    </section>
  )
}
