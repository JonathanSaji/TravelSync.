# Delete / Remove Trips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⋯ menu to every trip card in the Saved Plans panel — "Edit trip" + "Delete trip" on owned trips, "Remove" on shared trips — with a confirmation modal before any destructive action.

**Architecture:** Three layers built bottom-up: (1) new/extended API routes handle DB operations, (2) new state and handlers in Project3.tsx wire the business logic, (3) JSX changes swap the existing single-button trip cards for ⋯ menu cards and add a confirmation modal.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PostgreSQL (`pg`), Tailwind v4, Vitest

---

## File Map

| Action | Path |
|--------|------|
| Create | `vitest.config.ts` |
| Modify | `package.json` |
| Create | `tests/trips-delete.test.ts` |
| Create | `app/api/trips/[tripId]/route.ts` |
| Create | `tests/trips-shares-remove.test.ts` |
| Modify | `app/api/trips/[tripId]/shares/route.ts` |
| Modify | `components/Project3.tsx` |

---

## Task 0: Configure Vitest path alias

The API routes use `@/lib/db` imports. Without a vitest config, that alias is unknown to the test runner and mocks will fail.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
```

- [ ] **Step 2: Add test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

So the full scripts block becomes:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

```bash
npm test
```

Expected output includes: `✓ generate-trip API (mocked) > returns parsed JSON from mocked AI`

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest config with path alias"
```

---

## Task 1: DELETE /api/trips/[tripId] route

New route that lets a trip owner permanently delete their trip and all associated share records.

**Files:**
- Create: `tests/trips-delete.test.ts`
- Create: `app/api/trips/[tripId]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/trips-delete.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ dbQuery: vi.fn() }))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({ payload, status: init?.status ?? 200 }),
  },
}))

import { DELETE } from '../app/api/trips/[tripId]/route'
import { dbQuery } from '@/lib/db'

const mockDb = dbQuery as ReturnType<typeof vi.fn>

function makeReq(tripId: string, body: unknown) {
  return {
    url: `http://localhost/api/trips/${tripId}`,
    json: async () => body,
  }
}

describe('DELETE /api/trips/[tripId]', () => {
  beforeEach(() => mockDb.mockReset())

  it('deletes trip and shares when user is the owner', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ owner_id: 42 }] }) // SELECT owner
      .mockResolvedValueOnce({ rowCount: 2 })               // DELETE shares
      .mockResolvedValueOnce({ rowCount: 1 })               // DELETE trip
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(200)
    expect(res.payload).toEqual({ ok: true })
    expect(mockDb).toHaveBeenCalledTimes(3)
  })

  it('returns 403 when user is not the owner', async () => {
    mockDb.mockResolvedValueOnce({ rows: [{ owner_id: 99 }] })
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(403)
    expect(mockDb).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when trip does not exist', async () => {
    mockDb.mockResolvedValueOnce({ rows: [] })
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await (DELETE as any)(makeReq('1', {}))
    expect(res.status).toBe(400)
    expect(mockDb).not.toHaveBeenCalled()
  })

  it('returns 400 when tripId is invalid', async () => {
    const res = await (DELETE as any)(makeReq('abc', { userId: 42 }))
    expect(res.status).toBe(400)
    expect(mockDb).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/trips-delete.test.ts
```

Expected: FAIL — `Cannot find module '../app/api/trips/[tripId]/route'`

- [ ] **Step 3: Create `app/api/trips/[tripId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
  return parsePositiveId(segments[segments.length - 1])
}

export async function DELETE(req: Request) {
  try {
    const tripId = parseTripId(req)
    if (!tripId) {
      return NextResponse.json({ error: 'Valid tripId is required.' }, { status: 400 })
    }

    const body = (await req.json()) as { userId?: unknown }
    const userId = parsePositiveId(body.userId)
    if (!userId) {
      return NextResponse.json({ error: 'Valid userId is required.' }, { status: 400 })
    }

    const ownerResult = await dbQuery<{ owner_id: string | number }>(
      'SELECT owner_id FROM "TravelSync".trips WHERE id = $1 LIMIT 1',
      [tripId],
    )
    if (!ownerResult.rows[0]) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const ownerId = parsePositiveId(ownerResult.rows[0].owner_id)
    if (ownerId !== userId) {
      return NextResponse.json({ error: 'Only the owner can delete this trip.' }, { status: 403 })
    }

    await dbQuery('DELETE FROM "TravelSync".trip_shares WHERE trip_id = $1', [tripId])
    await dbQuery('DELETE FROM "TravelSync".trips WHERE id = $1', [tripId])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('trips DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete trip.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/trips-delete.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/trips-delete.test.ts app/api/trips/[tripId]/route.ts
git commit -m "feat: add DELETE /api/trips/[tripId] route"
```

---

## Task 2: Self-removal from a shared trip

Extend the existing DELETE handler on the shares route so a shared user can remove themselves without needing the owner's involvement.

**Files:**
- Create: `tests/trips-shares-remove.test.ts`
- Modify: `app/api/trips/[tripId]/shares/route.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/trips-shares-remove.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ dbQuery: vi.fn() }))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({ payload, status: init?.status ?? 200 }),
  },
}))

import { DELETE } from '../app/api/trips/[tripId]/shares/route'
import { dbQuery } from '@/lib/db'

const mockDb = dbQuery as ReturnType<typeof vi.fn>

function makeReq(tripId: string, body: unknown) {
  return {
    url: `http://localhost/api/trips/${tripId}/shares`,
    json: async () => body,
  }
}

describe('DELETE /api/trips/[tripId]/shares — self-removal', () => {
  beforeEach(() => mockDb.mockReset())

  it('removes the share when userId matches shared_with_user_id (self-removal)', async () => {
    // trip exists check
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // SELECT trip
      .mockResolvedValueOnce({ rowCount: 1 })          // DELETE share
    const res = await (DELETE as any)(makeReq('1', { userId: 55 }))
    expect(res.status).toBe(200)
    expect(res.payload.ok).toBe(true)
    expect(res.payload.sharedUserId).toBe('55')
  })

  it('returns 404 when the share row does not exist', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 })
    const res = await (DELETE as any)(makeReq('1', { userId: 55 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await (DELETE as any)(makeReq('1', {}))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/trips-shares-remove.test.ts
```

Expected: FAIL — the current DELETE handler requires `sharedUserId` and returns 400 when it is absent.

- [ ] **Step 3: Modify the DELETE handler in `app/api/trips/[tripId]/shares/route.ts`**

Replace the entire `DELETE` export (lines 182–222) with:

```ts
export async function DELETE(req: Request) {
  try {
    const tripId = parseTripId(req)
    if (!tripId) {
      return NextResponse.json({ error: 'Valid tripId is required.' }, { status: 400 })
    }

    const body = (await req.json()) as ShareBody
    const requestUserId = parsePositiveId(body.userId)
    const sharedUserId = parsePositiveId(body.sharedUserId)

    if (!requestUserId) {
      return NextResponse.json({ error: 'Valid userId is required.' }, { status: 400 })
    }

    const tripExists = await dbQuery<{ id: string | number }>(
      'SELECT id FROM "TravelSync".trips WHERE id = $1 LIMIT 1',
      [tripId],
    )
    if (!tripExists.rows[0]) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    if (sharedUserId) {
      // Owner removing someone else — original behaviour
      const ownerId = await loadTripOwner(tripId)
      if (requestUserId !== ownerId) {
        return NextResponse.json({ error: 'Only the owner can remove share access.' }, { status: 403 })
      }
      const removed = await dbQuery(
        'DELETE FROM "TravelSync".trip_shares WHERE trip_id = $1 AND shared_with_user_id = $2',
        [tripId, sharedUserId],
      )
      if (removed.rowCount === 0) {
        return NextResponse.json({ error: 'Share access not found.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, tripId: String(tripId), sharedUserId: String(sharedUserId) })
    }

    // Self-removal — no owner check needed
    const removed = await dbQuery(
      'DELETE FROM "TravelSync".trip_shares WHERE trip_id = $1 AND shared_with_user_id = $2',
      [tripId, requestUserId],
    )
    if (removed.rowCount === 0) {
      return NextResponse.json({ error: 'Share access not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, tripId: String(tripId), sharedUserId: String(requestUserId) })
  } catch (error) {
    console.error('trip shares DELETE error:', error)
    return NextResponse.json({ error: 'Failed to revoke share access.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run all tests to confirm everything passes**

```bash
npm test
```

Expected: all tests in `trips-delete.test.ts`, `trips-shares-remove.test.ts`, and `generate-trip.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add tests/trips-shares-remove.test.ts app/api/trips/[tripId]/shares/route.ts
git commit -m "feat: extend shares DELETE to support self-removal"
```

---

## Task 3: Add state and handlers to Project3.tsx

Add the three new state fields and four handlers that power the ⋯ menu and confirmation modal. No UI changes yet — just the logic layer.

**Files:**
- Modify: `components/Project3.tsx`

- [ ] **Step 1: Add three new state fields**

After the line `const [loginBusy, setLoginBusy] = useState(false)` (currently the last state declaration), add:

```tsx
const [openMenuTripId, setOpenMenuTripId] = useState<string | null>(null)
const [deleteTarget, setDeleteTarget] = useState<{
  tripId: string
  tripName: string
  type: 'delete' | 'remove'
} | null>(null)
const [deleteBusy, setDeleteBusy] = useState(false)
```

- [ ] **Step 2: Add handleEditTrip**

After the `handleStartOver` function, add:

```tsx
const handleEditTrip = (tripSummary: SavedTripSummary) => {
  setOpenMenuTripId(null)
  setPlan(tripSummary.planDetails)
  setIdeas(tripSummary.ideas)
  setSavedTripId(tripSummary.id)
  setActiveTripOwnerId(tripSummary.ownerId)
  setGeneratedTrip(null)
  setScreen('sandbox')
  setPlansPanelOpen(false)
  showToast(`Editing ${tripSummary.planDetails.name || 'saved plan'}.`)
}
```

- [ ] **Step 3: Add handleDeleteTripClick and handleRemoveSharedClick**

Directly after `handleEditTrip`:

```tsx
const handleDeleteTripClick = (tripSummary: SavedTripSummary) => {
  setOpenMenuTripId(null)
  setDeleteTarget({
    tripId: tripSummary.id,
    tripName: tripSummary.planDetails.name || tripSummary.trip.tripName,
    type: 'delete',
  })
}

const handleRemoveSharedClick = (tripSummary: SavedTripSummary) => {
  setOpenMenuTripId(null)
  setDeleteTarget({
    tripId: tripSummary.id,
    tripName: tripSummary.planDetails.name || tripSummary.trip.tripName,
    type: 'remove',
  })
}
```

- [ ] **Step 4: Add handleDeleteConfirm**

Directly after the two click handlers above:

```tsx
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
      setPlan({ name: '', location: '', dates: '', group: '', budget: '' })
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
```

- [ ] **Step 5: Verify the file compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to the new state or handlers. (Build may fail for other unrelated reasons — only care about type errors in the new code.)

- [ ] **Step 6: Commit**

```bash
git add components/Project3.tsx
git commit -m "feat: add delete/remove state and handlers to Project3"
```

---

## Task 4: ⋯ menu on My Plans cards

Replace the single `<button>` wrapper on each My Plans card with a `<div>` that contains: the main click area, the ⋯ toggle button, and a dropdown with "Edit trip" and "Delete trip".

**Files:**
- Modify: `components/Project3.tsx`

- [ ] **Step 1: Add onClick to the scrollable list container**

Find the line:

```tsx
<div className="flex-1 overflow-y-auto pr-1">
```

Change it to:

```tsx
<div className="flex-1 overflow-y-auto pr-1" onClick={() => setOpenMenuTripId(null)}>
```

- [ ] **Step 2: Replace the My Plans card button with the ⋯ card structure**

Find the entire `myTrips.map` block (the `<button key={tripSummary.id} ...>` element and its children) and replace it with:

```tsx
myTrips.map(tripSummary => (
  <div
    key={tripSummary.id}
    className="relative w-full rounded-panel border border-cream-deep bg-white shadow-soft transition hover:-translate-y-[1px] hover:border-ink-faint"
  >
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
        <span className="flex-shrink-0 rounded-full bg-sage px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white">
          Yours
        </span>
      </div>
      <p className="mt-2 text-[0.7rem] text-ink-faint">
        Updated {new Date(tripSummary.updatedAt).toLocaleDateString()}
      </p>
    </button>

    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        setOpenMenuTripId(prev => prev === tripSummary.id ? null : tripSummary.id)
      }}
      className="absolute right-2.5 top-3 rounded-card border border-cream-deep bg-white px-[7px] py-[3px] text-[0.78rem] font-bold text-ink-mid hover:bg-parchment [-webkit-tap-highlight-color:transparent]"
      aria-label="Trip options"
      aria-expanded={openMenuTripId === tripSummary.id}
    >
      ···
    </button>

    {openMenuTripId === tripSummary.id && (
      <div className="absolute right-0 top-full z-10 mt-1 w-[148px] overflow-hidden rounded-panel border border-cream-deep bg-white shadow-float">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleEditTrip(tripSummary) }}
          className="w-full border-b border-cream-deep px-3 py-[9px] text-left text-[0.8rem] font-medium text-ink hover:bg-parchment"
        >
          ✏️ Edit trip
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleDeleteTripClick(tripSummary) }}
          className="w-full px-3 py-[9px] text-left text-[0.8rem] font-medium text-terra hover:bg-[#fff4ef]"
        >
          🗑 Delete trip
        </button>
      </div>
    )}
  </div>
))
```

- [ ] **Step 3: Verify the file compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/Project3.tsx
git commit -m "feat: add three-dot menu to My Plans cards"
```

---

## Task 5: ⋯ menu on Shared with me cards

Same pattern as Task 4, but for the sharedTrips section. The dropdown has only one item: "Remove".

**Files:**
- Modify: `components/Project3.tsx`

- [ ] **Step 1: Replace the Shared with me card button**

Find the entire `sharedTrips.map` block and replace it with:

```tsx
sharedTrips.map(tripSummary => (
  <div
    key={tripSummary.id}
    className="relative w-full rounded-panel border border-cream-deep bg-white shadow-soft transition hover:-translate-y-[1px] hover:border-ink-faint"
  >
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
        <span className="flex-shrink-0 rounded-full bg-sand px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink">
          Shared
        </span>
      </div>
      <p className="mt-2 text-[0.7rem] text-ink-faint">
        Updated {new Date(tripSummary.updatedAt).toLocaleDateString()}
      </p>
    </button>

    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        setOpenMenuTripId(prev => prev === tripSummary.id ? null : tripSummary.id)
      }}
      className="absolute right-2.5 top-3 rounded-card border border-cream-deep bg-white px-[7px] py-[3px] text-[0.78rem] font-bold text-ink-mid hover:bg-parchment [-webkit-tap-highlight-color:transparent]"
      aria-label="Trip options"
      aria-expanded={openMenuTripId === tripSummary.id}
    >
      ···
    </button>

    {openMenuTripId === tripSummary.id && (
      <div className="absolute right-0 top-full z-10 mt-1 w-[148px] overflow-hidden rounded-panel border border-cream-deep bg-white shadow-float">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleRemoveSharedClick(tripSummary) }}
          className="w-full px-3 py-[9px] text-left text-[0.8rem] font-medium text-terra hover:bg-[#fff4ef]"
        >
          ✕ Remove
        </button>
      </div>
    )}
  </div>
))
```

- [ ] **Step 2: Verify the file compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/Project3.tsx
git commit -m "feat: add three-dot menu to Shared with me cards"
```

---

## Task 6: Confirmation modal

Add the delete/remove confirmation modal to Project3.tsx. It renders when `deleteTarget` is non-null.

**Files:**
- Modify: `components/Project3.tsx`

- [ ] **Step 1: Add the modal JSX**

Find the line `<Toast message={toastMsg} />` near the bottom of the `return` block and insert the following **directly before it**:

```tsx
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
```

- [ ] **Step 2: Verify the full build passes**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/Project3.tsx
git commit -m "feat: add delete/remove confirmation modal"
```

---

## Self-Review Checklist (already applied)

| Spec requirement | Covered by |
|-----------------|------------|
| ⋯ menu on My Plans cards | Task 4 |
| ⋯ menu on Shared with me cards | Task 5 |
| "Edit trip" always opens sandbox | Task 3 — handleEditTrip sets `screen = 'sandbox'` |
| "Delete trip" with confirmation modal | Tasks 1, 3, 6 |
| "Remove" with confirmation modal | Tasks 2, 3, 6 |
| Modal shows trip name + warning copy | Task 6 |
| Busy state on confirm button | Task 6 |
| Remove from state list after success | Task 3 — handleDeleteConfirm |
| Reset + navigate to setup if active trip deleted | Task 3 — handleDeleteConfirm |
| Close menu when clicking outside | Task 4 — `onClick` on scrollable container |
| Only one menu open at a time | Task 4 — `setOpenMenuTripId(prev => ...)` toggle |
