'use client'

import { useState, useCallback, useEffect } from 'react'
import { Screen, PlanDetails, IdeaItem } from '../types'
import type { GeneratedTrip } from '../lib/buildTripOrder'
import CreatorSetup from './screens/CreatorSetup'
import IdeaSandbox  from './screens/IdeaSandbox'
import AIDraft      from './screens/AIDraft'
import SuccessState from './screens/SuccessState'
import Toast        from './Toast'

/**
 * HarmonyApp is the 'use client' boundary.
 * It owns the app-level state and passes down only what each screen needs.
 *
 * State owned here:
 *  - screen       → which of the 4 screens is visible
 *  - planDetails  → set by CreatorSetup, read by all subsequent screens
 *  - ideas        → accumulated IdeaItems from IdeaSandbox
 *  - toastMessage → null = hidden, string = visible
 */

interface InitialShareData {
  planDetails: PlanDetails
  ideas: IdeaItem[]
}

interface AuthUser {
  id: string
  username: string
  displayName?: string | null
}

interface SavedTripSummary {
  id: string
  ownerId: string
  ownerUsername: string
  ownerDisplayName?: string | null
  planDetails: PlanDetails
  ideas: IdeaItem[]
  trip: GeneratedTrip
  confirmed: boolean
  tripConfirmed?: boolean
  tripStatus: string
  startDate: string | null
  endDate?: string | null
  createdAt: string
  updatedAt: string
}

interface SavedTripsResponse {
  myTrips: SavedTripSummary[]
  sharedTrips: SavedTripSummary[]
}

interface HarmonyAppProps {
  /** From `/?share=` — passed from the server page. */
  shareFromUrl?: string
  /** Loaded on the server when opening a share link (avoids client fetch races on Vercel). */
  initialShareData?: InitialShareData | null
}

const EMPTY_PLAN: PlanDetails = { name: '', location: '', group: '', budget: '' }

function buildDraftTrip(details: PlanDetails): GeneratedTrip {
  const name = details.name.trim() || `Trip to ${details.location.trim() || 'your destination'}`
  return {
    tripName: name,
    itinerary: [
      {
        day: 1,
        theme: 'Draft ideas',
        activities: [],
      },
    ],
  }
}

function tripHasActivities(trip: GeneratedTrip): boolean {
  return trip.itinerary.some(day => Array.isArray(day.activities) && day.activities.length > 0)
}

export default function HarmonyApp({ shareFromUrl, initialShareData = null }: HarmonyAppProps) {
  const [screen, setScreen]       = useState<Screen>(() => (initialShareData ? 'sandbox' : 'setup'))
  const [planDetails, setPlan]    = useState<PlanDetails>(
    () => initialShareData?.planDetails ?? EMPTY_PLAN,
  )
  const [ideas, setIdeas]         = useState<IdeaItem[]>(() => initialShareData?.ideas ?? [])
  const [generatedTrip, setGeneratedTrip] = useState<GeneratedTrip | null>(null)
  const [savedTripId, setSavedTripId] = useState<string | null>(null)
  const [tripStartDate, setTripStartDate] = useState<string | null>(null)
  const [activeTripOwnerId, setActiveTripOwnerId] = useState<string | null>(null)
  const [toastMsg, setToastMsg]   = useState<string | null>(null)
  const [plansPanelOpen, setPlansPanelOpen] = useState(false)
  const [myTrips, setMyTrips] = useState<SavedTripSummary[]>([])
  const [sharedTrips, setSharedTrips] = useState<SavedTripSummary[]>([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripsError, setTripsError] = useState<string | null>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'create'>('login')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [email, setEmail] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [confirmingTripId, setConfirmingTripId] = useState<string | null>(null)
  const [unconfirmPromptTripId, setUnconfirmPromptTripId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    tripId: string
    tripName: string
    type: 'delete' | 'remove'
  } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // ── Toast helper ────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2600)
  }, [])

  // Client fallback: server already hydrated `initialShareData` when possible.
  useEffect(() => {
    if (initialShareData) return

    const fromQuery =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('share')?.trim()
        : undefined
    const id = (shareFromUrl?.trim() || fromQuery || '').trim()
    if (!id) return

    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(`/api/share-bin?binId=${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        const data = await res.json()
        if (!res.ok) {
          showToast(typeof data.error === 'string' ? data.error : 'Could not open shared trip.')
          return
        }
        const rec = data.record as { planDetails?: PlanDetails; ideas?: IdeaItem[] } | undefined
        if (rec?.planDetails && Array.isArray(rec.ideas)) {
          setPlan(rec.planDetails)
          setIdeas(rec.ideas)
          setScreen('sandbox')
          showToast('Loaded shared sandbox — collaborate on the idea board.')
        } else {
          showToast('Shared plan data was missing or invalid.')
        }
      } catch (e) {
        if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') return
        showToast('Could not load shared link.')
      }
    })()
    return () => ac.abort()
  }, [showToast, shareFromUrl, initialShareData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('travelsync:auth-user')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as AuthUser
      if (parsed && typeof parsed.id === 'string' && typeof parsed.username === 'string') {
        setAuthUser(parsed)
      }
    } catch {
      window.localStorage.removeItem('travelsync:auth-user')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (authUser) {
      window.localStorage.setItem('travelsync:auth-user', JSON.stringify(authUser))
    } else {
      window.localStorage.removeItem('travelsync:auth-user')
    }
  }, [authUser])

  const loadSavedTrips = useCallback(async () => {
    if (!authUser?.id) {
      setMyTrips([])
      setSharedTrips([])
      setTripsError(null)
      return
    }

    setTripsLoading(true)
    setTripsError(null)
    try {
      const res = await fetch(`/api/trips?userId=${encodeURIComponent(authUser.id)}`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as Partial<SavedTripsResponse> & { error?: string }
      if (!res.ok) {
        setTripsError(typeof data.error === 'string' ? data.error : 'Could not load saved plans.')
        setMyTrips([])
        setSharedTrips([])
        return
      }

      setMyTrips(Array.isArray(data.myTrips) ? data.myTrips : [])
      setSharedTrips(Array.isArray(data.sharedTrips) ? data.sharedTrips : [])
    } catch (error) {
      console.error('Load trips error:', error)
      setTripsError('Could not load saved plans.')
    } finally {
      setTripsLoading(false)
    }
  }, [authUser?.id])

  useEffect(() => {
    void loadSavedTrips()
  }, [loadSavedTrips])

  const loadCurrentTripSnapshot = useCallback(async () => {
    if (!authUser?.id || !savedTripId || screen !== 'sandbox') return

    try {
      const res = await fetch(`/api/trips?userId=${encodeURIComponent(authUser.id)}`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as Partial<SavedTripsResponse> & { error?: string }
      if (!res.ok) return

      const allTrips = [
        ...(Array.isArray(data.myTrips) ? data.myTrips : []),
        ...(Array.isArray(data.sharedTrips) ? data.sharedTrips : []),
      ]
      const latest = allTrips.find(t => t.id === savedTripId)
      if (!latest) return

      setMyTrips(Array.isArray(data.myTrips) ? data.myTrips : [])
      setSharedTrips(Array.isArray(data.sharedTrips) ? data.sharedTrips : [])

      const remoteIdeas = JSON.stringify(latest.ideas)
      const localIdeas = JSON.stringify(ideas)
      if (remoteIdeas !== localIdeas) {
        setIdeas(latest.ideas)
      }
    } catch (error) {
      console.error('Load current trip snapshot error:', error)
    }
  }, [authUser?.id, ideas, savedTripId, screen])

  useEffect(() => {
    if (!authUser?.id || !savedTripId || screen !== 'sandbox') return
    const interval = window.setInterval(() => {
      void loadCurrentTripSnapshot()
    }, 3000)
    return () => window.clearInterval(interval)
  }, [authUser?.id, loadCurrentTripSnapshot, savedTripId, screen])

  const persistSandboxSnapshot = useCallback(async () => {
    if (!authUser?.id || !savedTripId) return

    try {
      await fetch('/api/trips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser.id,
          tripId: savedTripId,
          planDetails,
          ideas,
        }),
      })
    } catch (error) {
      console.error('Persist sandbox snapshot error:', error)
    }
  }, [activeTripOwnerId, authUser?.id, ideas, planDetails, savedTripId])

  useEffect(() => {
    if (screen !== 'sandbox') return
    if (!authUser?.id || !savedTripId) return

    const timeout = window.setTimeout(() => {
      void persistSandboxSnapshot()
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [authUser?.id, ideas, persistSandboxSnapshot, planDetails, savedTripId, screen])

  // ── Navigation handlers ─────────────────────────────────────
  const handleSetupSubmit = async (details: PlanDetails) => {
    setPlan(details)
    setIdeas([])
    setGeneratedTrip(null)

    if (!authUser?.id) {
      setSavedTripId(null)
      setActiveTripOwnerId(null)
      setScreen('sandbox')
      showToast('Plan created. Log in to save it to your plans list.')
      return
    }

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser.id,
          planDetails: details,
          ideas: [],
          trip: buildDraftTrip(details),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Plan created, but it could not be saved yet.')
        setScreen('sandbox')
        return
      }

      if (typeof data?.tripId === 'string') {
        setSavedTripId(data.tripId)
        setActiveTripOwnerId(authUser.id)
        void loadSavedTrips()
      }
      setScreen('sandbox')
      showToast('Plan created and added to your plans.')
    } catch (error) {
      console.error('Create draft trip error:', error)
      setScreen('sandbox')
      showToast('Plan created, but it could not be saved yet.')
    }
  }

  const handleAddIdea = (idea: IdeaItem) => {
    setIdeas(prev => [...prev, idea])
  }

  const handleRemoveIdea = (ideaId: string) => {
    setIdeas(prev => prev.filter(idea => idea.id !== ideaId))
  }

  const handleGenerate = () => {
    setScreen('draft')
  }

  const saveApprovedTrip = async (trip: GeneratedTrip): Promise<void> => {
    if (!authUser?.id) {
      showToast('Log in to save this itinerary to your account.')
      return
    }

    try {
      const shouldUpdateExisting = Boolean(savedTripId && activeTripOwnerId === authUser.id)
      const res = await fetch('/api/trips', {
        method: shouldUpdateExisting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          shouldUpdateExisting
            ? {
                userId: authUser.id,
                tripId: savedTripId,
                planDetails,
                ideas,
                trip,
              }
            : {
                userId: authUser.id,
                planDetails,
                ideas,
                trip,
              },
        ),
      })

      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not save trip to database.')
        return
      }

      if (typeof data?.tripId === 'string') {
        setSavedTripId(data.tripId)
        setActiveTripOwnerId(authUser.id)
      }
      showToast('Itinerary saved to your account.')
      void loadSavedTrips()
    } catch (error) {
      console.error('Save approved trip error:', error)
      showToast('Could not save trip right now.')
    }
  }

  const openSavedTrip = (tripSummary: SavedTripSummary) => {
    if (!tripSummary.trip || typeof tripSummary.trip.tripName !== 'string') {
      showToast('Could not open that plan.')
      return
    }

    setPlan(tripSummary.planDetails)
    setIdeas(tripSummary.ideas)
    setSavedTripId(tripSummary.id)
    setTripStartDate(tripSummary.startDate ?? null)
    setActiveTripOwnerId(tripSummary.ownerId)

    if (tripHasActivities(tripSummary.trip)) {
      setGeneratedTrip(tripSummary.trip)
      setScreen('success')
    } else {
      setGeneratedTrip(null)
      setScreen('sandbox')
    }

    setPlansPanelOpen(false)
    showToast(`Opened ${tripSummary.planDetails.name || 'saved plan'}.`)
  }

  const handleApprove = async (trip: GeneratedTrip) => {
    await saveApprovedTrip(trip)
    setGeneratedTrip(trip)
    setScreen('success')
  }

  /** Back to the sandbox so the user can add or change ideas before generating again. */
  const handleReviseInSandbox = () => {
    showToast('Edit your ideas on the board, then tap Generate Itinerary again.')
    setGeneratedTrip(null)
    setScreen('sandbox')
  }

  const handleStartOver = () => {
    setPlan(EMPTY_PLAN)
    setIdeas([])
    setGeneratedTrip(null)
    setSavedTripId(null)
    setTripStartDate(null)
    setActiveTripOwnerId(null)
    setScreen('setup')
  }

  const handleDeleteTripClick = (tripSummary: SavedTripSummary) => {
    setDeleteTarget({
      tripId: tripSummary.id,
      tripName: tripSummary.planDetails.name || tripSummary.trip.tripName,
      type: 'delete',
    })
  }

  const handleRemoveSharedClick = (tripSummary: SavedTripSummary) => {
    setDeleteTarget({
      tripId: tripSummary.id,
      tripName: tripSummary.planDetails.name || tripSummary.trip.tripName,
      type: 'remove',
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !authUser?.id) return
    setDeleteBusy(true)
    try {
      const { tripId, tripName, type } = deleteTarget
      const res = await fetch(
        type === 'delete'
          ? `/api/trips/${tripId}`
          : `/api/trips/${tripId}/shares`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authUser.id }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : `Could not ${type} trip.`)
        return
      }
      if (type === 'delete') {
        setMyTrips(prev => prev.filter(t => t.id !== tripId))
      } else {
        setSharedTrips(prev => prev.filter(t => t.id !== tripId))
      }
      if (savedTripId === tripId) {
        setPlan(EMPTY_PLAN)
        setIdeas([])
        setGeneratedTrip(null)
        setSavedTripId(null)
        setActiveTripOwnerId(null)
        setScreen('setup')
      }
      setDeleteTarget(null)
      showToast(type === 'delete' ? `"${tripName}" deleted.` : `Removed from "${tripName}".`)
    } catch (error) {
      console.error('Delete/remove trip error:', error)
      showToast('Something went wrong. Try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleLogin = async () => {
    const username = loginUsername.trim()
    const password = loginPassword

    if (!username || !password) {
      showToast('Enter your username and password.')
      return
    }

    setLoginBusy(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok || !data?.user) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not log in.')
        return
      }

      setAuthUser(data.user as AuthUser)
      setLoginPassword('')
      setAuthDialogOpen(false)
      showToast(`Logged in as ${data.user.username}.`)
    } catch (error) {
      console.error('Login error:', error)
      showToast('Could not reach the login service.')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleCreateAccount = async () => {
    const trimmedEmail = email.trim()
    const username = loginUsername.trim()
    const password = loginPassword

    if (!trimmedEmail || !username || !password) {
      showToast('Enter your email, username, and password.')
      return
    }

    setLoginBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, username, password }),
      })
      const data = await res.json()
      if (!res.ok || !data?.user) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not create account.')
        return
      }

      setAuthUser(data.user as AuthUser)
      setEmail('')
      setLoginUsername('')
      setLoginPassword('')
      setAuthMode('login')
      setAuthDialogOpen(false)
      showToast(`Account created for ${data.user.username}.`)
    } catch (error) {
      console.error('Register error:', error)
      showToast('Could not reach the account service.')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleLogout = () => {
    setAuthUser(null)
    setLoginPassword('')
    setLoginUsername('')
    setAuthDialogOpen(false)
    setPlansPanelOpen(false)
    setPlan(EMPTY_PLAN)
    setIdeas([])
    setGeneratedTrip(null)
    setSavedTripId(null)
    setMyTrips([])
    setSharedTrips([])
    setTripsError(null)
    setActiveTripOwnerId(null)
    setScreen('setup')
    showToast('User logged out.')
  }

  const openUserDialog = () => {
    setAuthMode(authUser ? 'login' : 'login')
    setAuthDialogOpen(true)
  }

  // ── Upcoming trips (within 7 days) ──────────────────────────
  const upcomingTrips = [...myTrips, ...sharedTrips].filter(t => {
    if (!t.startDate) return false
    const start = new Date(t.startDate)
    const now = new Date()
    const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 7 && t.tripStatus !== 'happening_now'
  })

  // ── Confirm trip ─────────────────────────────────────────────
  const handleConfirmTrip = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!authUser?.id || confirmingTripId) return
    setConfirmingTripId(tripId)
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not confirm trip.')
        return
      }
      showToast('Attendance confirmed. Check your email for the itinerary.')
      void loadSavedTrips()
    } catch {
      showToast('Could not reach the server.')
    } finally {
      setConfirmingTripId(null)
    }
  }

  const handleUnconfirmTrip = async (tripId: string) => {
    if (!authUser?.id || confirmingTripId) return
    setConfirmingTripId(tripId)
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Could not unconfirm trip.')
        return
      }
      setUnconfirmPromptTripId(null)
      showToast('Attendance unconfirmed.')
      void loadSavedTrips()
    } catch {
      showToast('Could not reach the server.')
    } finally {
      setConfirmingTripId(null)
    }
  }


  // ── Render ──────────────────────────────────────────────────
  return (
    // Outer wrapper centres screens and keeps the paper texture behind everything
    <div className="flex flex-col items-center min-h-screen relative">

      {/* ── Notification Bell (fixed, top-right) ── */}
      {authUser && (
        <div className="fixed top-[18px] right-4 z-[120]">
          <button
            type="button"
            onClick={() => setNotifOpen(prev => !prev)}
            aria-label={`Notifications${upcomingTrips.length > 0 ? ` — ${upcomingTrips.length} upcoming` : ''}`}
            className="relative flex items-center justify-center w-9 h-9 rounded-full border border-cream-deep bg-white shadow-soft transition hover:bg-parchment active:scale-[0.96]"
          >
            {/* Bell SVG */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mid" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {upcomingTrips.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-terra text-[0.6rem] font-bold text-white leading-none" aria-hidden="true">
                {upcomingTrips.length}
              </span>
            )}
          </button>

          {/* Bell dropdown */}
          {notifOpen && (
            <div
              className="absolute right-0 top-11 w-[280px] rounded-panel border border-cream-deep bg-white shadow-float z-[121]"
              role="dialog"
              aria-label="Upcoming trips"
            >
              <div className="px-4 py-3 border-b border-cream-deep flex items-center justify-between">
                <p className="text-[0.72rem] font-semibold tracking-[0.1em] uppercase text-ink-faint">Upcoming Trips</p>
                <button type="button" onClick={() => setNotifOpen(false)} className="text-[0.72rem] text-ink-mid hover:text-ink" aria-label="Close notifications">✕</button>
              </div>
              {upcomingTrips.length === 0 ? (
                <p className="px-4 py-4 text-[0.82rem] text-ink-mid">No trips coming up in the next 7 days.</p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto no-scrollbar divide-y divide-cream-deep">
                  {upcomingTrips.map(t => {
                    const daysAway = t.startDate
                      ? Math.ceil((new Date(t.startDate).getTime() - Date.now()) / 86400000)
                      : null
                    return (
                      <div key={t.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[0.84rem] font-semibold text-ink">{t.planDetails.name || t.trip.tripName}</p>
                            <p className="text-[0.72rem] text-ink-mid">📍 {t.planDetails.location}</p>
                            {daysAway !== null && (
                              <p className="mt-0.5 text-[0.7rem] font-semibold text-terra">
                                {daysAway === 0 ? 'Today!' : daysAway === 1 ? 'Tomorrow!' : `In ${daysAway} days`}
                              </p>
                            )}
                          </div>
                          {t.confirmed ? (
                            <span className="shrink-0 rounded-full bg-sage px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-white">Attending</span>
                          ) : (
                            <button
                              type="button"
                              onClick={e => handleConfirmTrip(t.id, e)}
                              disabled={confirmingTripId === t.id}
                              className="shrink-0 rounded-full bg-terra px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-white transition hover:opacity-80 disabled:opacity-60"
                            >
                              {confirmingTripId === t.id ? '…' : 'Confirm'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="px-4 py-3 border-t border-cream-deep">
                <p className="text-[0.7rem] text-ink-faint leading-relaxed">
                  Confirm your attendance to notify the group and get subscription reminders via{' '}
                  <a href="https://trackersync.sub-sync.ca" target="_blank" rel="noopener noreferrer" className="text-sage underline">SubSync</a>.
                </p>
              </div>
            </div>
          )}

          {/* Backdrop to close bell dropdown */}
          {notifOpen && (
            <div className="fixed inset-0 z-[119]" onClick={() => setNotifOpen(false)} aria-hidden="true" />
          )}
        </div>
      )}
      <aside
        className={[
          'fixed left-0 top-0 z-[90] h-[100dvh] w-[300px] border-r border-cream-deep bg-[rgba(255,250,242,0.96)] shadow-float backdrop-blur-sm transition-transform duration-300 ease-out',
          plansPanelOpen ? 'translate-x-0' : '-translate-x-[calc(100%-44px)]',
        ].join(' ')}
        aria-label="Saved plans panel"
      >
        <button
          type="button"
          onClick={() => setPlansPanelOpen(prev => !prev)}
          className="absolute right-[-44px] top-1/2 z-[1] -translate-y-1/2 rounded-r-card border border-l-0 border-cream-deep bg-white px-3 py-2 text-[0.72rem] font-semibold tracking-[0.08em] uppercase text-ink shadow-soft"
          aria-label={plansPanelOpen ? 'Close saved plans panel' : 'Open saved plans panel'}
        >
          {plansPanelOpen ? 'Close' : 'Plans'}
        </button>

        <div className="flex h-full flex-col px-4 py-4">
          <div className="mb-4 pr-10">
            <p className="text-[0.68rem] font-semibold tracking-[0.12em] uppercase text-ink-faint">Saved Plans</p>
            <h2 className="mt-1 font-display text-[1.35rem] leading-tight text-ink">Your recent trips</h2>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-mid">
              Open a saved plan to load its ideas and itinerary back into the app.
            </p>
          </div>

          {!authUser ? (
            <div className="rounded-panel border border-cream-deep bg-white px-3 py-3 text-[0.82rem] text-ink-mid">
              Log in to see plans you saved and plans shared with you.
            </div>
          ) : tripsLoading ? (
            <div className="rounded-panel border border-cream-deep bg-white px-3 py-3 text-[0.82rem] text-ink-mid">
              Loading your plans…
            </div>
          ) : tripsError ? (
            <div className="rounded-panel border border-terra/30 bg-[#fff4ef] px-3 py-3 text-[0.82rem] text-terra">
              {tripsError}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[0.72rem] font-semibold tracking-[0.1em] uppercase text-ink-faint">My plans</h3>
                  <span className="text-[0.7rem] text-ink-faint">{myTrips.length}</span>
                </div>
                <div className="space-y-2">
                  {myTrips.length === 0 ? (
                    <div className="rounded-panel border border-cream-deep bg-white px-3 py-3 text-[0.8rem] text-ink-mid">
                      No saved plans yet.
                    </div>
                  ) : (
                    myTrips.map(tripSummary => (
                      <div key={tripSummary.id} className="relative w-full rounded-panel border border-cream-deep bg-white shadow-soft transition hover:-translate-y-[1px] hover:border-ink-faint">
                        <button
                          type="button"
                          onClick={() => openSavedTrip(tripSummary)}
                          className="w-full px-3 py-3 pr-10 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[0.88rem] font-semibold text-ink">
                                {tripSummary.planDetails.name || tripSummary.trip.tripName}
                              </p>
                              <p className="mt-0.5 text-[0.74rem] text-ink-mid">
                                {tripSummary.planDetails.location || 'Saved trip'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="rounded-full bg-sage px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white">
                                Yours
                              </span>
                              {tripSummary.confirmed && (
                                <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-sage">
                                  ✓ Attending
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-[0.7rem] text-ink-faint">
                            Updated {new Date(tripSummary.updatedAt).toLocaleDateString()}
                          </p>
                        </button>

                        {!tripSummary.confirmed && (
                          <div className="border-t border-cream-deep px-3 py-2">
                            <button
                              type="button"
                              onClick={e => handleConfirmTrip(tripSummary.id, e)}
                              disabled={confirmingTripId === tripSummary.id}
                              className="w-full rounded-card bg-terra/90 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-white transition hover:bg-terra disabled:opacity-60"
                              aria-label={`Confirm trip: ${tripSummary.planDetails.name || tripSummary.trip.tripName}`}
                            >
                              {confirmingTripId === tripSummary.id ? 'Confirming…' : 'Confirm Attendance'}
                            </button>
                          </div>
                        )}

                        {tripSummary.confirmed && (
                          <div className="border-t border-cream-deep px-3 py-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setUnconfirmPromptTripId(prev => (prev === tripSummary.id ? null : tripSummary.id))
                              }}
                              disabled={confirmingTripId === tripSummary.id}
                              className="w-full rounded-card bg-[#6a1f2d] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-[#541824] disabled:opacity-60"
                              aria-label={`Unconfirm trip: ${tripSummary.planDetails.name || tripSummary.trip.tripName}`}
                            >
                              {confirmingTripId === tripSummary.id ? 'Unconfirming…' : 'Unconfirm Attendance'}
                            </button>
                            {unconfirmPromptTripId === tripSummary.id && (
                              <div className="mt-1 rounded-card border border-cream-deep bg-[#fff6f5] p-1.5 text-[0.6rem] text-ink">
                                <p className="mb-1 leading-tight text-[#6a1f2d]">Unconfirm attendance?</p>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      setUnconfirmPromptTripId(null)
                                    }}
                                    className="rounded-card border border-cream-deep bg-white px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.04em] text-ink-mid hover:bg-parchment"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      void handleUnconfirmTrip(tripSummary.id)
                                    }}
                                    className="rounded-card bg-[#6a1f2d] px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.04em] text-white hover:bg-[#541824]"
                                  >
                                    Yes, Unconfirm
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteTripClick(tripSummary) }}
                          className="absolute right-2.5 top-3 rounded-card border border-cream-deep bg-white px-[7px] py-[3px] text-[0.8rem] text-terra hover:bg-[#fff4ef] [-webkit-tap-highlight-color:transparent]"
                          aria-label="Delete trip"
                        >
                          🗑
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[0.72rem] font-semibold tracking-[0.1em] uppercase text-ink-faint">Shared with you</h3>
                  <span className="text-[0.7rem] text-ink-faint">{sharedTrips.length}</span>
                </div>
                <div className="space-y-2">
                  {sharedTrips.length === 0 ? (
                    <div className="rounded-panel border border-cream-deep bg-white px-3 py-3 text-[0.8rem] text-ink-mid">
                      No shared plans yet.
                    </div>
                  ) : (
                    sharedTrips.map(tripSummary => (
                      <div key={tripSummary.id} className="relative w-full rounded-panel border border-cream-deep bg-white shadow-soft transition hover:-translate-y-[1px] hover:border-ink-faint">
                        <button
                          type="button"
                          onClick={() => openSavedTrip(tripSummary)}
                          className="w-full px-3 py-3 pr-10 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[0.88rem] font-semibold text-ink">
                                {tripSummary.planDetails.name || tripSummary.trip.tripName}
                              </p>
                              <p className="mt-0.5 text-[0.74rem] text-ink-mid">
                                Shared by @{tripSummary.ownerUsername}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="rounded-full bg-sand px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink">
                                Shared
                              </span>
                              {tripSummary.confirmed && (
                                <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-sage">
                                  ✓ Attending
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-[0.7rem] text-ink-faint">
                            Updated {new Date(tripSummary.updatedAt).toLocaleDateString()}
                          </p>
                        </button>

                        {!tripSummary.confirmed && (
                          <div className="border-t border-cream-deep px-3 py-2">
                            <button
                              type="button"
                              onClick={e => handleConfirmTrip(tripSummary.id, e)}
                              disabled={confirmingTripId === tripSummary.id}
                              className="w-full rounded-card bg-terra/90 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-white transition hover:bg-terra disabled:opacity-60"
                              aria-label={`Confirm trip: ${tripSummary.planDetails.name || tripSummary.trip.tripName}`}
                            >
                              {confirmingTripId === tripSummary.id ? 'Confirming…' : 'Confirm Attendance'}
                            </button>
                          </div>
                        )}

                        {tripSummary.confirmed && (
                          <div className="border-t border-cream-deep px-3 py-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setUnconfirmPromptTripId(prev => (prev === tripSummary.id ? null : tripSummary.id))
                              }}
                              disabled={confirmingTripId === tripSummary.id}
                              className="w-full rounded-card bg-[#6a1f2d] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-[#541824] disabled:opacity-60"
                              aria-label={`Unconfirm trip: ${tripSummary.planDetails.name || tripSummary.trip.tripName}`}
                            >
                              {confirmingTripId === tripSummary.id ? 'Unconfirming…' : 'Unconfirm Attendance'}
                            </button>
                            {unconfirmPromptTripId === tripSummary.id && (
                              <div className="mt-1 rounded-card border border-cream-deep bg-[#fff6f5] p-1.5 text-[0.6rem] text-ink">
                                <p className="mb-1 leading-tight text-[#6a1f2d]">Unconfirm attendance?</p>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      setUnconfirmPromptTripId(null)
                                    }}
                                    className="rounded-card border border-cream-deep bg-white px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.04em] text-ink-mid hover:bg-parchment"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      void handleUnconfirmTrip(tripSummary.id)
                                    }}
                                    className="rounded-card bg-[#6a1f2d] px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.04em] text-white hover:bg-[#541824]"
                                  >
                                    Yes, Unconfirm
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleRemoveSharedClick(tripSummary) }}
                          className="absolute right-2.5 top-3 rounded-card border border-cream-deep bg-white px-[7px] py-[3px] text-[0.8rem] text-terra hover:bg-[#fff4ef] [-webkit-tap-highlight-color:transparent]"
                          aria-label="Remove shared trip"
                        >
                          🗑
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>

      {/*
       * Conditional rendering (not CSS hide/show) means each screen mounts fresh,
       * so animate-fade-up plays every time a screen becomes active.
       */}
      {screen === 'setup' && (
        <CreatorSetup
          key="setup"
          onSubmit={handleSetupSubmit}
          isLoggedIn={Boolean(authUser)}
          authLabel={authUser ? 'Logout' : 'Login'}
          onAuthClick={openUserDialog}
        />
      )}

      {screen === 'sandbox' && (
        <IdeaSandbox
          key="sandbox"
          planDetails={planDetails}
          ideas={ideas}
          tripId={savedTripId}
          currentUserId={authUser?.id ?? null}
          canShareSandbox={Boolean(authUser?.id && activeTripOwnerId && authUser.id === activeTripOwnerId)}
          canGenerateItinerary={Boolean(!activeTripOwnerId || (authUser?.id && activeTripOwnerId === authUser.id))}
          onPersistSandbox={persistSandboxSnapshot}
          onAddIdea={handleAddIdea}
          onRemoveIdea={handleRemoveIdea}
          onTripReady={setGeneratedTrip}
          onGenerate={handleGenerate}
          showToast={showToast}
          authLabel={authUser ? 'Logout' : 'Login'}
          onAuthClick={openUserDialog}
          currentTrip={generatedTrip}
        />
      )}

      {screen === 'draft' && (
        <AIDraft
          key="draft"
          planDetails={planDetails}
          ideas={ideas}
          initialTrip={generatedTrip}
          onApprove={handleApprove}
          onRevise={handleReviseInSandbox}
          showToast={showToast}
        />
      )}

      {screen === 'success' && (
        <SuccessState
          key={`success-${savedTripId ?? 'current'}`}
          planDetails={planDetails}
          trip={generatedTrip!}
          tripId={savedTripId}
          onStartOver={handleStartOver}
          showToast={showToast}
          authLabel={authUser ? 'Logout' : 'Login'}
          onAuthClick={openUserDialog}
          currentUserId={authUser?.id ?? null}
          canShareTrip={Boolean(authUser?.id && activeTripOwnerId && authUser.id === activeTripOwnerId)}
          tripStartDate={tripStartDate}
        />
      )}

      {authDialogOpen && (
        <div
          className="fixed inset-0 z-[130] bg-ink/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-auth-title"
          onMouseDown={() => setAuthDialogOpen(false)}
        >
          <div
            className="absolute left-1/2 top-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-cream-deep bg-white p-4 shadow-float"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="user-auth-title" className="text-[0.86rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">
                {authUser ? 'Your account' : authMode === 'login' ? 'Login to plan your next trip' : 'Create your account'}
              </h3>
              <button
                type="button"
                className="rounded-card border border-cream-deep px-2 py-1 text-[0.72rem] font-medium text-ink-mid hover:bg-parchment"
                onClick={() => setAuthDialogOpen(false)}
                aria-label="Close user dialog"
              >
                Close
              </button>
            </div>

            {authUser ? (
              <div className="rounded-card border border-cream-deep bg-parchment px-3 py-3">
                <p className="text-[0.72rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">Logged in as</p>
                <p className="mt-1 text-[0.86rem] font-medium text-ink">
                  {authUser.displayName || authUser.username}
                </p>
                <p className="text-[0.72rem] text-ink-faint">{authUser.username}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 flex w-full items-center justify-center rounded-card border border-cream-deep bg-white px-3 py-2 text-[0.8rem] font-semibold text-terra transition hover:bg-parchment"
                  aria-label="Log out user"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="rounded-card border border-cream-deep bg-parchment px-3 py-3">
                <p className="text-[0.72rem] font-semibold tracking-[0.08em] uppercase text-ink-faint">
                  {authMode === 'login' ? 'Login' : 'Create account'}
                </p>

                <div className="mt-3 space-y-2">
                  <div
                    className={[
                      'overflow-hidden transition-all duration-300 ease-out',
                      authMode === 'create' ? 'max-h-20 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none',
                    ].join(' ')}
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email"
                      className="input-field"
                      autoComplete="email"
                    />
                  </div>

                  <div
                    className={[
                      'transition-all duration-300 ease-out',
                      authMode === 'create' ? 'translate-y-1' : 'translate-y-0',
                    ].join(' ')}
                  >
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="Username"
                      className="input-field"
                      autoComplete="username"
                    />
                  </div>

                  <div
                    className={[
                      'transition-all duration-300 ease-out',
                      authMode === 'create' ? 'translate-y-1' : 'translate-y-0',
                    ].join(' ')}
                  >
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      className="input-field"
                      autoComplete="current-password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={authMode === 'login' ? handleLogin : handleCreateAccount}
                    disabled={loginBusy}
                    className="flex w-full items-center justify-center rounded-card bg-ink px-3 py-2 text-[0.8rem] font-semibold text-white transition hover:bg-[#1c1b18] disabled:opacity-60"
                    aria-label={authMode === 'login' ? 'Log in user' : 'Create account'}
                  >
                    {loginBusy
                      ? authMode === 'login' ? 'Logging in…' : 'Creating account…'
                      : authMode === 'login' ? 'Login' : 'Create my account'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode(prev => (prev === 'login' ? 'create' : 'login'))}
                    className="flex w-full items-center justify-center rounded-card border border-cream-deep bg-white px-3 py-2 text-[0.8rem] font-semibold text-ink-mid transition hover:bg-parchment"
                  >
                    {authMode === 'login' ? 'Create account' : 'I already have an account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[140] bg-ink/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-trip-title"
          onMouseDown={() => { if (!deleteBusy) setDeleteTarget(null) }}
        >
          <div
            className="absolute left-1/2 top-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-cream-deep bg-white p-4 shadow-float animate-pop-in"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3
                id="delete-trip-title"
                className="text-[0.86rem] font-semibold tracking-[0.08em] uppercase text-ink-faint"
              >
                {deleteTarget.type === 'delete' ? 'Delete Trip' : 'Remove Trip'}
              </h3>
              <button
                type="button"
                className="rounded-card border border-cream-deep px-2 py-1 text-[0.72rem] font-medium text-ink-mid hover:bg-parchment disabled:opacity-50"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>

            <div className="mb-4 rounded-card border border-[#F0D8CE] bg-[#FFF4EF] p-3">
              {deleteTarget.type === 'delete' ? (
                <>
                  <p className="text-[0.84rem] font-semibold text-ink">
                    &ldquo;{deleteTarget.tripName}&rdquo; will be permanently deleted.
                  </p>
                  <p className="mt-1 text-[0.78rem] text-ink-mid">
                    This can&apos;t be undone. All shares will be removed too.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[0.84rem] font-semibold text-ink">
                    You&apos;ll be removed from &ldquo;{deleteTarget.tripName}&rdquo;.
                  </p>
                  <p className="mt-1 text-[0.78rem] text-ink-mid">
                    You can ask to be re-added by the owner.
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                className="flex-1 rounded-card border border-cream-deep bg-white px-3 py-2 text-[0.8rem] font-semibold text-ink-mid transition hover:bg-parchment disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteConfirm() }}
                disabled={deleteBusy}
                className="flex-1 rounded-card bg-terra px-3 py-2 text-[0.8rem] font-semibold text-white transition hover:bg-[#a0633e] disabled:opacity-60"
              >
                {deleteBusy
                  ? (deleteTarget.type === 'delete' ? 'Deleting…' : 'Removing…')
                  : (deleteTarget.type === 'delete' ? 'Delete forever' : 'Remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
