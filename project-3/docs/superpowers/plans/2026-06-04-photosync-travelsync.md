# PhotoSync ↔ TravelSync: Trip Memory Albums — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link a PhotoSync album to a TravelSync trip so the trip displays a day-by-day photo timeline in a Memories tab.

**Architecture:** Shared Neon PostgreSQL database is the bridge — `"TravelSync".photo_albums.trip_id` FK is the only cross-app link. TravelSync reads PhotoSync's tables directly via DB queries. No cross-app API calls.

---

## ⚠️ Critical Context: How TravelSync Actually Works

Read this before touching any code. This project has real quirks.

### Repo location

```
C:\Users\pashu\Grade 12 Computer Science\Project-3\project-3\
```

### Framework

Next.js **16.2.2** (not 15). TypeScript. Tailwind CSS v4 (no `tailwind.config.js` — token names directly as utilities). React 19. `pg` for Postgres.

### Project structure — no `src/` directory

```
lib/          — utilities, DB queries, auth helpers
app/          — Next.js App Router (pages + API routes)
components/   — React components
types/        — TypeScript interfaces (index.ts)
docs/         — planning documents (this file lives here)
```

### `lib/db.ts` — the DB client (already exists, do NOT rewrite)

```typescript
export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
)
```

**IMPORTANT:** `dbQuery` returns `Promise<QueryResult<T>>` — it returns the **full `pg` result object**, not `T[]`. Always access `.rows`:

```typescript
// CORRECT:
const result = await dbQuery<MyRow>('SELECT ...', [id])
const row = result.rows[0]           // T | undefined
const rows = result.rows             // T[]

// WRONG — the plan's original code had this bug:
const rows = await dbQuery<MyRow>(...)
return rows[0]  // ❌ this would return a QueryResult, not a MyRow
```

Also exported: `getDbPool(): Pool` — use when you need a client for transactions.

### Database schema

All app tables live in the **`"TravelSync"` Postgres schema** (case-sensitive — always double-quote in SQL).

**Existing tables:**

```sql
"TravelSync".trips (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_details JSONB NOT NULL,   -- { name, location, dates, group, budget }
  ideas        JSONB NOT NULL DEFAULT '[]',
  itinerary    JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

"TravelSync".trip_shares (
  trip_id             BIGINT NOT NULL REFERENCES "TravelSync".trips(id) ON DELETE CASCADE,
  shared_with_user_id BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  shared_by_user_id   BIGINT REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, shared_with_user_id)
)
```

`plan_details` columns: `name` (trip name), `location`, `dates` (free text — NOT a DATE column). **`dates` is not a structured date.** The trip table has no `start_date`/`end_date` columns yet — the migration adds them.

User accounts: `public.accounts` with `id BIGSERIAL`. Trip IDs are **BIGINT**, returned as strings by `pg`.

### Table creation mechanism

Tables are created via `lib/ensureTravelSyncTables.ts`, called by `POST /api/admin/init-db`. **This is how new tables get added** — extend `ensureTravelSyncTables()`, not via a separate migration script.

### Authentication

**Two independent tokens in localStorage** — do not confuse them:

| Key | Owner | Shape | Used for |
|-----|-------|-------|---------|
| `travelsync:auth-user` | TravelSync | `{ id, username, displayName }` | All TravelSync API calls |
| `subsync_token` | SubSync ecosystem | base64 JSON `{ accountId, username, displayName, email }` | SubSync home button only |

TravelSync's auth:
- Login: `POST /api/auth/login` with `{ username, password }` → returns `{ user: { id, username, displayName } }`
- Client stores result in `localStorage['travelsync:auth-user']`
- **No cookies, no JWTs.** The stored `id` is a string representation of the BIGINT `public.accounts.id`
- API routes receive `userId` via `?userId=X` (GET) or `userId` in JSON body (POST/PATCH/DELETE)
- Routes trust the userId from the request — no token validation (internal app)
- See `components/Project3.tsx` lines ~153–175 for how auth state is loaded/stored

### App architecture — single-page, 4-screen flow

All state lives in `HarmonyApp` (`components/Project3.tsx`). Screens are conditionally rendered (not hidden):

```
setup → sandbox → draft → success
```

| Screen | Component | Purpose |
|--------|-----------|---------|
| `setup` | `CreatorSetup` | Trip name, location, dates, group, budget |
| `sandbox` | `IdeaSandbox` | Add/remove IdeaItems; real-time collab polling |
| `draft` | `AIDraft` | POST /api/generate-trip → Gemini; review result |
| `success` | `SuccessState` | Approved itinerary display; share options |

**There is no `app/trips/[id]/page.tsx`.** The success screen is `components/screens/SuccessState.tsx`. The Memories tab goes here.

Props that `SuccessState` currently receives (`components/screens/SuccessState.tsx:9–18`):
```typescript
interface Props {
  planDetails: PlanDetails
  trip: GeneratedTrip
  tripId: string | null          // the DB trip id from savedTripId in HarmonyApp
  onStartOver: () => void
  showToast: (msg: string) => void
  authLabel?: string
  onAuthClick?: () => void
  currentUserId?: string | null
  canShareTrip?: boolean
}
```

The `tripId` prop is `savedTripId` from `HarmonyApp` state (set when a trip is saved to DB). This is the value to use for the photos API call.

`tripId` is null for unsaved trips. The Memories tab should only render when `tripId` is non-null.

### Existing API route conventions

All routes include:
```typescript
export const dynamic = 'force-dynamic'
```

Next.js 16 makes route params async — always destructure with `await`:
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  // ...
}
```

The existing dynamic segment is `[tripId]`. New routes that are children of `[tripId]` go in `app/api/trips/[tripId]/`.

### UI design tokens (Tailwind v4)

Light cream/parchment palette. **No dark classes.**

| Token | Hex | Use |
|-------|-----|-----|
| `cream` | `#F7F5F0` | Page background |
| `cream-deep` | `#EDEAE2` | Borders, dividers |
| `parchment` | `#FAF8F4` | Input/card backgrounds |
| `sage` | `#7A9E8E` | Primary accent, focus rings |
| `sand` | `#C4A882` | Secondary warm accent |
| `terra` | `#B8714E` | Alert / destructive |
| `ink` | `#2C2B28` | Primary text |
| `ink-mid` | `#5C5A56` | Secondary text |
| `ink-faint` | `#9B9892` | Placeholder text |

Typography: `font-display` (DM Serif Display), `font-sans` (Outfit). Utility classes in `app/globals.css`: `.input-field`, `.btn-primary`.

Shape tokens: `rounded-card` = `radius-card`, `rounded-panel` = `radius-panel`, `shadow-soft`, `shadow-float`.

### Test runner

`npm test` runs `vitest run` (see `package.json`). `vitest.config.ts` sets up `@` alias to project root. Vitest is already installed.

---

## ⚠️ Critical Context: How PhotoSync Actually Works

TravelSync reads PhotoSync's DB tables — you need to understand how PhotoSync works so the integration makes sense.

### Repo location

```
C:\Users\pashu\Grade 12 Computer Science\PhotoSync\
```

### Framework

**NOT a Next.js app.** PhotoSync is:
- **Node.js + Express** (`server.js`, port 3000) — serves static files and proxies `/api/*` to FastAPI
- **Python + FastAPI** (`backend.py`, port 8000) — all application logic
- **Vanilla JS frontend** (`script.js`, `albums.js`, `people.js`, `share.js`) — no React/TypeScript

### PhotoSync data storage

- **SQLite** (`data/auth.db`) — `users` and `sessions` tables for PhotoSync's own auth
- **JSON files** (`data/metadata.json`, `data/albums.json`, `data/shares.json`, etc.) — photo records
- **Uploads**: `uploads/<user_id>/<photo_id><ext>` where `user_id` is a UUID string from SQLite

### PhotoSync auth — completely separate from TravelSync

PhotoSync uses **cookie-based sessions** with its own SQLite DB:
- User IDs are **UUID strings** (e.g., `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`)
- Auth cookie: `photosync_session` (httponly, samesite=lax)
- PhotoSync user IDs are **not** the same as `public.accounts.id` (BIGINT)

This means: PhotoSync users and TravelSync users share the SubSync ecosystem identity in principle, but PhotoSync's current implementation does NOT connect to `public.accounts`. The integration bridges this by having the PhotoSync frontend **pass the TravelSync account_id separately** from the PhotoSync session.

### The auth bridge

When a PhotoSync user wants to link an album to a TravelSync trip, they must also be logged into TravelSync. The `travelsync:auth-user` key in localStorage (set by TravelSync's auth flow, readable by any page on the same domain or by cross-site JS) gives the `account_id` (BIGINT as string).

PhotoSync's new album/photo endpoints accept a `travelsync_account_id` parameter — this becomes the `account_id` in the Neon Postgres tables. PhotoSync does not validate it against `public.accounts`; it trusts the client (both apps are internal).

### Photo storage URLs

PhotoSync uploads are served at `https://photosync.sub-sync.ca/uploads/<user_id>/<filename>` in production. For TravelSync to display these images, the `storage_url` in the Neon DB must be an **absolute URL** to PhotoSync's public server.

In the `NewAlbumModal` flow (PhotoSync frontend), the storage_url should be built as:
```javascript
const BASE = 'https://photosync.sub-sync.ca'
const storageUrl = `${BASE}/uploads/${photo.owner_user_id}/${photo.saved_filename}`
```

Locally, TravelSync won't be able to load these images (different port). That's acceptable for development — the image display works in production/Render.

**`next/image` config:** Because photos come from an external domain (`photosync.sub-sync.ca`), `next.config.ts` needs `images.remotePatterns`. Add this during the TravelSync implementation:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'photosync.sub-sync.ca' },
    ],
  },
  // ... existing config
}
```
For development, use `<img>` tags directly in `PhotoTimeline.tsx` instead of `next/image` to avoid the domain restriction.

### PhotoSync's new backend routes (for reference — not your job to implement)

The PhotoSync AI will add these to `backend.py`:
- `GET /api/trips-for-linking` — returns user's TravelSync trips (via Neon Postgres)
- `POST /api/travel-albums` — creates album in `"TravelSync".photo_albums`
- `POST /api/travel-photos` — syncs a photo to `"TravelSync".photos` with EXIF date

The Neon connection in Python uses `psycopg2` (added to `requirements.txt`). The `DATABASE_URL` env var is the connection string.

---

## File Structure — TravelSync Only

This plan only covers the TravelSync implementation. PhotoSync changes happen in the PhotoSync repo under a separate plan.

| File | Action | Purpose |
|------|--------|---------|
| `lib/ensureTravelSyncTables.ts` | **Modify** | Add `photo_albums`, `photos` tables + date columns to trips |
| `lib/tripPhotos.ts` | Create | DB queries: `getTripLinkedAlbum`, `getTripPhotos` |
| `lib/groupPhotos.ts` | Create | Pure fn: group photos array into day buckets |
| `lib/groupPhotos.test.ts` | Create | Tests for `groupPhotosByDay` |
| `components/memories/PhotoTimeline.tsx` | Create | Day-separated photo grid |
| `components/memories/MemoriesTab.tsx` | Create | Fetches photos, renders timeline or empty state |
| `app/api/trips/[tripId]/photos/route.ts` | Create | GET — returns photos for a trip |
| `next.config.ts` | **Modify** | Add `images.remotePatterns` for PhotoSync domain |
| `components/screens/SuccessState.tsx` | **Modify** | Add Itinerary / Memories tab toggle |
| `components/Project3.tsx` | **Modify** | Pass `tripStartDate` prop to SuccessState |

---

## Part A — Database Migration

### Task 1: Extend ensureTravelSyncTables with new tables

**File:** `lib/ensureTravelSyncTables.ts`

- [ ] **Step 1: Add the new tables and columns**

Open `lib/ensureTravelSyncTables.ts`. After the existing `CREATE TABLE IF NOT EXISTS "TravelSync".trip_shares` block (before the index creation), add:

```typescript
await client.query(`
  ALTER TABLE "TravelSync".trips
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date   DATE
`)

await client.query(`
  CREATE TABLE IF NOT EXISTS "TravelSync".photo_albums (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id BIGINT      NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    trip_id    BIGINT      REFERENCES "TravelSync".trips(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

await client.query(`
  CREATE TABLE IF NOT EXISTS "TravelSync".photos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id    UUID        NOT NULL REFERENCES "TravelSync".photo_albums(id) ON DELETE CASCADE,
    account_id  BIGINT      NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    storage_url TEXT        NOT NULL,
    taken_at    TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_photo_albums_trip    ON "TravelSync".photo_albums(trip_id)
`)
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_photo_albums_account ON "TravelSync".photo_albums(account_id)
`)
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_photos_album_id      ON "TravelSync".photos(album_id)
`)
```

Also update `getTravelSyncTables()` to check for all 4 tables:
```typescript
WHERE table_schema = 'TravelSync'
  AND table_name IN ('trips', 'trip_shares', 'photo_albums', 'photos')
```
And update the `ready` check: `ready: tables.length === 4`.

- [ ] **Step 2: Run the migration**

With the dev server stopped, run:
```bash
curl -s -X POST http://localhost:3000/api/admin/init-db
```
Or start the dev server (`npm run dev`) and POST to `/api/admin/init-db` from a browser or curl.

Expected response: `{ "ok": true, "tables": ["photo_albums", "photos", "trip_shares", "trips"] }`

- [ ] **Step 3: Verify in Neon console**

Log into https://console.neon.tech, confirm:
- `"TravelSync".trips` has `start_date` and `end_date` columns
- `"TravelSync".photo_albums` and `"TravelSync".photos` tables exist

- [ ] **Step 4: Commit**

```bash
git add lib/ensureTravelSyncTables.ts
git commit -m "feat: add photo_albums, photos tables and date columns to trips"
```

---

## Part B — Trip Photo Queries

### Task 2: `lib/tripPhotos.ts`

> **Remember:** `dbQuery` returns `QueryResult<T>`. Access `.rows` to get the array.

- [ ] **Step 1: Create the file**

```typescript
// lib/tripPhotos.ts
import { dbQuery } from './db'

export interface TripPhoto {
  id: string
  storage_url: string
  taken_at: string | null
  uploaded_at: string
}

export interface LinkedAlbum {
  id: string
  name: string
}

export async function getTripLinkedAlbum(
  tripId: string,
  accountId: string,
): Promise<LinkedAlbum | null> {
  const result = await dbQuery<LinkedAlbum>(
    `SELECT id, name FROM "TravelSync".photo_albums
     WHERE trip_id = $1 AND account_id = $2
     LIMIT 1`,
    [tripId, accountId],
  )
  return result.rows[0] ?? null
}

export async function getTripPhotos(
  tripId: string,
  accountId: string,
): Promise<TripPhoto[]> {
  const result = await dbQuery<TripPhoto>(
    `SELECT p.id, p.storage_url, p.taken_at, p.uploaded_at
     FROM "TravelSync".photos p
     JOIN "TravelSync".photo_albums a ON p.album_id = a.id
     WHERE a.trip_id = $1 AND p.account_id = $2
     ORDER BY COALESCE(p.taken_at, p.uploaded_at) ASC`,
    [tripId, accountId],
  )
  return result.rows
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/tripPhotos.ts
git commit -m "feat: add trip photo queries"
```

---

## Part C — groupPhotosByDay with Tests

### Task 3: `lib/groupPhotos.ts` + `lib/groupPhotos.test.ts`

> `npm test` runs `vitest run`. Vitest is already installed.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/groupPhotos.test.ts
import { describe, it, expect } from 'vitest'
import { groupPhotosByDay } from './groupPhotos'

const makePhoto = (id: string, taken_at: string | null, uploaded_at: string) => ({
  id,
  storage_url: 'https://photosync.sub-sync.ca/uploads/user/photo.jpg',
  taken_at,
  uploaded_at,
})

describe('groupPhotosByDay', () => {
  it('groups photos by taken_at date', () => {
    const photos = [
      makePhoto('1', '2024-06-03T10:00:00Z', '2024-06-10T00:00:00Z'),
      makePhoto('2', '2024-06-03T14:00:00Z', '2024-06-10T00:00:00Z'),
      makePhoto('3', '2024-06-04T09:00:00Z', '2024-06-10T00:00:00Z'),
    ]
    const groups = groupPhotosByDay(photos, '2024-06-03')
    expect(groups).toHaveLength(2)
    expect(groups[0].photos).toHaveLength(2)
    expect(groups[1].photos).toHaveLength(1)
  })

  it('labels days relative to trip start', () => {
    const photos = [makePhoto('1', '2024-06-05T10:00:00Z', '2024-06-10T00:00:00Z')]
    const groups = groupPhotosByDay(photos, '2024-06-03')
    expect(groups[0].label).toBe('Day 3 · June 5')
  })

  it('falls back to uploaded_at when taken_at is null', () => {
    const photos = [makePhoto('1', null, '2024-06-03T10:00:00Z')]
    const groups = groupPhotosByDay(photos, '2024-06-03')
    expect(groups).toHaveLength(1)
    expect(groups[0].photos[0].id).toBe('1')
  })

  it('returns empty array for no photos', () => {
    expect(groupPhotosByDay([], '2024-06-03')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test
```

Expected: FAIL — `groupPhotosByDay` not found.

- [ ] **Step 3: Implement groupPhotosByDay**

```typescript
// lib/groupPhotos.ts
import type { TripPhoto } from './tripPhotos'

export interface DayGroup {
  date: string    // "2024-06-03"
  label: string   // "Day 1 · June 3"
  photos: TripPhoto[]
}

export function groupPhotosByDay(
  photos: TripPhoto[],
  tripStartDate: string,
): DayGroup[] {
  if (photos.length === 0) return []

  const groups = new Map<string, TripPhoto[]>()

  for (const photo of photos) {
    const raw = photo.taken_at ?? photo.uploaded_at
    const dateKey = new Date(raw).toISOString().split('T')[0]
    if (!groups.has(dateKey)) groups.set(dateKey, [])
    groups.get(dateKey)!.push(photo)
  }

  const start = new Date(tripStartDate + 'T00:00:00Z')

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, photos]) => {
      const d = new Date(date + 'T00:00:00Z')
      const dayNum =
        Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1
      const label = `Day ${dayNum} · ${d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })}`
      return { date, label, photos }
    })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/groupPhotos.ts lib/groupPhotos.test.ts
git commit -m "feat: add groupPhotosByDay with tests"
```

---

## Part D — API Route

### Task 4: `app/api/trips/[tripId]/photos/route.ts`

> Auth pattern: userId from `?userId=X` query param (matches all other GET routes).
> This sits alongside the existing `app/api/trips/[tripId]/route.ts` (DELETE) and `app/api/trips/[tripId]/shares/route.ts`.

- [ ] **Step 1: Create the file**

```typescript
// app/api/trips/[tripId]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTripPhotos, getTripLinkedAlbum } from '@/lib/tripPhotos'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const [album, photos] = await Promise.all([
    getTripLinkedAlbum(tripId, userId),
    getTripPhotos(tripId, userId),
  ])

  return NextResponse.json({ album, photos })
}
```

- [ ] **Step 2: Smoke test the endpoint**

With dev server running, get your userId from localStorage (`travelsync:auth-user` → `.id`):

```
GET http://localhost:3000/api/trips/123/photos?userId=1
```

Expected: `{ "album": null, "photos": [] }` (empty — confirms route works without crashing)

- [ ] **Step 3: Commit**

```bash
git add app/api/trips/[tripId]/photos/route.ts
git commit -m "feat: add GET /api/trips/[tripId]/photos route"
```

---

## Part E — UI Components

### Task 5: `next.config.ts` — add image domain

PhotoSync photos come from `photosync.sub-sync.ca`. Without this, `next/image` refuses to load them.

- [ ] **Step 1: Update `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'photosync.sub-sync.ca' },
    ],
  },
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow photosync.sub-sync.ca images"
```

---

### Task 6: `components/memories/PhotoTimeline.tsx`

> Use TravelSync's light cream palette. No dark classes.
> In development, photos won't load (different domain) — that's expected.

- [ ] **Step 1: Create `components/memories/` directory and file**

```tsx
// components/memories/PhotoTimeline.tsx
'use client'

import Image from 'next/image'
import { groupPhotosByDay } from '@/lib/groupPhotos'
import type { TripPhoto } from '@/lib/tripPhotos'

interface Props {
  photos: TripPhoto[]
  tripStartDate: string | null
}

export function PhotoTimeline({ photos, tripStartDate }: Props) {
  if (!tripStartDate) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <PhotoThumb key={photo.id} photo={photo} />
        ))}
      </div>
    )
  }

  const allHaveDates = photos.every((p) => p.taken_at !== null)

  if (!allHaveDates) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <PhotoThumb key={photo.id} photo={photo} />
        ))}
      </div>
    )
  }

  const groups = groupPhotosByDay(photos, tripStartDate)

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-3 font-sans">
            {group.label}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.photos.map((photo) => (
              <PhotoThumb key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PhotoThumb({ photo }: { photo: TripPhoto }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-[10px] bg-cream-deep">
      <Image
        src={photo.storage_url}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 33vw, 200px"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/memories/PhotoTimeline.tsx
git commit -m "feat: add PhotoTimeline component"
```

---

### Task 7: `components/memories/MemoriesTab.tsx`

> Auth: read `travelsync:auth-user` from localStorage (the TravelSync auth key).

- [ ] **Step 1: Create the file**

```tsx
// components/memories/MemoriesTab.tsx
'use client'

import { useEffect, useState } from 'react'
import { PhotoTimeline } from './PhotoTimeline'
import type { TripPhoto, LinkedAlbum } from '@/lib/tripPhotos'

interface Props {
  tripId: string
  tripStartDate: string | null  // "YYYY-MM-DD" or null if not set on this trip
}

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('travelsync:auth-user')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: string }
    return parsed.id ?? null
  } catch {
    return null
  }
}

export function MemoriesTab({ tripId, tripStartDate }: Props) {
  const [photos, setPhotos] = useState<TripPhoto[]>([])
  const [album, setAlbum] = useState<LinkedAlbum | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = getStoredUserId()
    if (!userId) {
      setLoading(false)
      return
    }
    fetch(`/api/trips/${tripId}/photos?userId=${userId}`)
      .then((r) => r.json())
      .then((data: { photos?: TripPhoto[]; album?: LinkedAlbum | null }) => {
        setPhotos(data.photos ?? [])
        setAlbum(data.album ?? null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tripId])

  if (loading) {
    return (
      <p className="text-sm text-ink-faint py-8 text-center font-sans animate-pulse">
        Loading memories…
      </p>
    )
  }

  if (!album) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-mid text-sm font-sans">No photo album linked to this trip.</p>
        <p className="text-ink-faint text-xs mt-1 font-sans">
          Open PhotoSync, create an album, and link it to this trip.
        </p>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-mid text-sm font-sans">
          "{album.name}" is linked but has no photos yet.
        </p>
        <p className="text-ink-faint text-xs mt-1 font-sans">
          Upload photos in PhotoSync to see them here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-ink-faint mb-4 font-sans">
        {album.name} · {photos.length} photos
      </p>
      <PhotoTimeline photos={photos} tripStartDate={tripStartDate} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/memories/MemoriesTab.tsx
git commit -m "feat: add MemoriesTab component"
```

---

## Part F — Wire Into SuccessState

### Task 8: Add Memories tab to SuccessState and Project3

> `SuccessState` receives `tripId: string | null` already. We need to also pass `tripStartDate: string | null` (from the trip DB row's `start_date` column, which will be null for trips created before the migration).

- [ ] **Step 1: Update SuccessState props and add tab toggle**

Open `components/screens/SuccessState.tsx`.

Add import at top:
```tsx
import { MemoriesTab } from '@/components/memories/MemoriesTab'
```

Extend the `Props` interface:
```typescript
interface Props {
  planDetails: PlanDetails
  trip: GeneratedTrip
  tripId: string | null
  tripStartDate: string | null   // ADD THIS — nullable start date from DB
  onStartOver: () => void
  showToast: (msg: string) => void
  authLabel?: string
  onAuthClick?: () => void
  currentUserId?: string | null
  canShareTrip?: boolean
}
```

Destructure the new prop in the function signature:
```tsx
export default function SuccessState({ planDetails, trip, tripId, tripStartDate, onStartOver, showToast, authLabel, onAuthClick, currentUserId, canShareTrip = true }: Props) {
```

Add tab state near the top of the component body (after the existing `useState` calls):
```tsx
const [activeView, setActiveView] = useState<'itinerary' | 'memories'>('itinerary')
```

In the JSX, find the "Confirmed Itinerary" section (`role="region" aria-label="Final confirmed itinerary"`). Just before that section, insert the tab toggle:

```tsx
{/* ── View toggle ────────────────────────────────────────── */}
{tripId && (
  <div className="flex gap-1 p-1 bg-cream-deep rounded-[10px] w-fit">
    <button
      onClick={() => setActiveView('itinerary')}
      className={`px-4 py-1.5 rounded-lg text-sm font-sans transition-colors ${
        activeView === 'itinerary'
          ? 'bg-parchment text-ink shadow-soft'
          : 'text-ink-mid hover:text-ink'
      }`}
    >
      Itinerary
    </button>
    <button
      onClick={() => setActiveView('memories')}
      className={`px-4 py-1.5 rounded-lg text-sm font-sans transition-colors ${
        activeView === 'memories'
          ? 'bg-parchment text-ink shadow-soft'
          : 'text-ink-mid hover:text-ink'
      }`}
    >
      Memories
    </button>
  </div>
)}
```

Wrap the existing itinerary section with a conditional:
```tsx
{activeView === 'itinerary' && (
  <div role="region" aria-label="Final confirmed itinerary">
    {/* ... existing itinerary content unchanged ... */}
  </div>
)}

{activeView === 'memories' && tripId && (
  <MemoriesTab tripId={tripId} tripStartDate={tripStartDate} />
)}
```

- [ ] **Step 2: Update Project3.tsx to pass tripStartDate**

Open `components/Project3.tsx`. 

Add `tripStartDate` to `HarmonyApp` state (after `savedTripId`):
```tsx
const [tripStartDate, setTripStartDate] = useState<string | null>(null)
```

In `handleStartOver`, reset it:
```tsx
setTripStartDate(null)
```

In `openSavedTrip`, the trip summary doesn't currently include `start_date` — this comes from the trips GET response. The `GET /api/trips` route returns a `SavedTripSummary` object but doesn't include `start_date`. You need to:

1. Add `startDate?: string | null` to the `SavedTripSummary` interface
2. Update `GET /api/trips` (`app/api/trips/route.ts`) to include `start_date` in the response (add it to the SELECT query for `myTrips` and `sharedTrips`, and include it in `.map()`)
3. In `openSavedTrip`, call `setTripStartDate(tripSummary.startDate ?? null)`

In `saveApprovedTrip`, after the trip is saved and we get back a `tripId`, there's no `start_date` returned. For new trips (start_date is null after migration), set `setTripStartDate(null)`.

Pass the prop to `<SuccessState>`:
```tsx
{screen === 'success' && generatedTrip && (
  <SuccessState
    planDetails={planDetails}
    trip={generatedTrip}
    tripId={savedTripId}
    tripStartDate={tripStartDate}   // ADD THIS
    onStartOver={handleStartOver}
    showToast={showToast}
    // ... rest of existing props unchanged
  />
)}
```

- [ ] **Step 3: Update GET /api/trips to include start_date**

Open `app/api/trips/route.ts`. In the `myTrips` SELECT query, add `t.start_date` to the columns. Add `start_date: string | null` to the result type. In the `.map()` for `myTrips`, add `startDate: r.start_date`.

Do the same for `sharedTrips`.

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

1. Log in (needed to get a userId for the memories API call)
2. Open or create a saved trip → navigate to success screen
3. Confirm the "Itinerary / Memories" toggle appears (only visible when `tripId` is non-null)
4. Click Memories → should show "No photo album linked to this trip." empty state
5. No console errors

- [ ] **Step 5: Commit**

```bash
git add components/screens/SuccessState.tsx components/memories/PhotoTimeline.tsx components/memories/MemoriesTab.tsx components/Project3.tsx app/api/trips/route.ts next.config.ts
git commit -m "feat: add Memories tab to trip success screen"
```

---

## End-to-End Smoke Test

Once PhotoSync also implements its side (see the PhotoSync plan), test the full flow:

1. **Create a trip in TravelSync** (setup → sandbox → generate → approve)
2. **Note the trip ID** from the "Plans" panel or URL
3. **Open PhotoSync** → New Travel Album → link it to the TravelSync trip
4. **Upload a JPEG with EXIF data** to that album in PhotoSync
5. **Return to TravelSync** → open the trip → success screen → click "Memories"
6. Confirm: photo appears (flat grid if no start_date; day-grouped if start_date is set)
7. Upload a screenshot (no EXIF) → confirm both photos appear in flat grid

---

## Common Pitfalls

- **`dbQuery` returns `QueryResult<T>`, not `T[]`** — always use `.rows`
- **Don't forget `export const dynamic = 'force-dynamic'`** on new API routes
- **`start_date` is null for all existing trips** — the Memories tab must handle `tripStartDate: null` gracefully (flat grid fallback)
- **Photos won't load in local dev** — `storage_url` points to `photosync.sub-sync.ca`, which only works in production; this is expected
- **The `[tripId]` DELETE route uses URL parsing instead of `{ params }`** — that's legacy code; new routes should use the async `{ params }` pattern
- **`npm test` is `vitest run`** (not `npx vitest`) per `package.json`
