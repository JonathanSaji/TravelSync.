# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

> TravelSync is a standalone trip-planning app and one of seven apps in the SubSync ecosystem.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx vitest` | Run tests |
| `npx vitest run tests/generate-trip.test.ts` | Run a single test file |

**Required env vars** (in `.env.local`):

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JSONBIN_API_KEY` | JSONBin share-link storage |
| `GOOGLE_GENAI_API_KEY` | Gemini model for trip generation |

---

## Architecture & Data Flow

The app is a **single-page, 4-screen linear flow**. All state lives in `HarmonyApp` (`components/Project3.tsx`) — the sole `'use client'` boundary. Each screen is conditionally rendered (not hidden), so `animate-fade-up` replays on every transition.

```
setup  →  sandbox  →  draft  →  success
  ↑           |                    |
  └───────────┴────────────────────┘
         (start over / revise)
```

| Screen | Component | Purpose |
|--------|-----------|---------|
| `setup` | `CreatorSetup` | Trip name, location, dates, group, budget |
| `sandbox` | `IdeaSandbox` | Add/remove `IdeaItem`s; real-time collab polling |
| `draft` | `AIDraft` | Calls `POST /api/generate-trip` → Gemini; review result |
| `success` | `SuccessState` | Approved itinerary display; share options |

**Collaboration:** when a `savedTripId` and `authUser` are both present on the `sandbox` screen, `HarmonyApp` polls `GET /api/trips` every 3 seconds and diffs `ideas` JSON to sync remote changes. Changes from the local user are debounced 700 ms then `PATCH`ed to `/api/trips`.

**Share links:** `/?share=<binId>` — the root page (`app/page.tsx`) loads the shared sandbox server-side via JSONBin before first paint (avoids hydration races on Vercel). The page is `force-dynamic` for this reason.

**AI generation pipeline:**
1. `buildOrderData()` in `lib/buildTripOrder.ts` serialises `PlanDetails` + `IdeaItem[]` into a structured prompt string.
2. `POST /api/generate-trip` sends that to Gemini and expects a `GeneratedTrip` JSON response.
3. `GeneratedTrip` optionally includes a `harmonyPlan` block when the model detects conflicting preferences between group members.

---

## Two Auth Systems (important)

There are **two independent auth tokens** in localStorage — do not confuse them:

| Key | Owner | Shape | Used for |
|-----|-------|-------|---------|
| `travelsync:auth-user` | TravelSync | `{ id, username, displayName }` | Saving/loading trips from Postgres |
| `subsync_token` | SubSync ecosystem | base64 JSON `{ accountId, username, displayName, email }` | SubSync home button destination only |

TravelSync's own auth hits `/api/auth/login` and `/api/auth/register` and stores a plain JSON object — it is **not** a JWT. The SubSync token is never read by TravelSync's API routes.

---

## The SubSync Ecosystem

SubSync is a suite of seven apps sharing a common identity layer. Each app is independent.

| App | Domain | Purpose |
|-----|--------|---------|
| TrackerSync | trackersync.sub-sync.ca | Subscription & finance tracker |
| TravelSync | travelsync.sub-sync.ca | Trip planning & travel memories |
| BrainSync | brainsync.sub-sync.ca | Deep focus & productivity |
| SeatSync | seatsync.sub-sync.ca | Desk & workplace scheduling |
| PhotoSync | photosync.sub-sync.ca | AI photo organization |
| FluencySync | fluencysync.sub-sync.ca | Language learning |
| SteadySync | steadysync.sub-sync.ca | Health & wellness |

**SubSync home button** (`components/SubSyncHomeButton.tsx`) — fixed bottom-right on every page. Uses `/Sub Sync (Company Logo).png` from `public/`. Routes to `https://sub-sync.ca/dashboard` if `subsync_token` is present, otherwise `https://sub-sync.ca`.

TravelSync's own brand takes priority — it does **not** need to match the SubSync landing page's honey/amber + glass-morphism aesthetic.

---

## UI Design System

All tokens live in `app/globals.css` under a Tailwind v4 `@theme` block. There is no `tailwind.config.js` — use token names directly as Tailwind utilities (`bg-cream`, `text-ink`, `shadow-soft`, etc.).

### Colors

| Token | Hex | Use |
|-------|-----|-----|
| `cream` | `#F7F5F0` | Primary page background |
| `cream-deep` | `#EDEAE2` | Borders, dividers |
| `parchment` | `#FAF8F4` | Input/card backgrounds |
| `sage` | `#7A9E8E` | Primary accent, focus rings |
| `sage-light` | `#A8C5B7` | Light sage |
| `sage-dim` | `#EDF3F0` | Subtle tinted backgrounds |
| `sand` | `#C4A882` | Secondary warm accent |
| `sand-light` | `#EFE5D6` | Light warm fills |
| `terra` | `#B8714E` | Alert / destructive emphasis |
| `terra-light` | `#F0E0D6` | Light terra backgrounds |
| `ink` | `#2C2B28` | Primary text |
| `ink-mid` | `#5C5A56` | Secondary text |
| `ink-faint` | `#9B9892` | Placeholder / hint text |

### Typography

| Token | Font | Weights | Use |
|-------|------|---------|-----|
| `font-display` | DM Serif Display | 400 | Headings, display text |
| `font-sans` | Outfit | 300–600 | Body, UI labels |

### Shape & Elevation

| Token | Value | Use |
|-------|-------|-----|
| `radius-card` | `10px` | Inputs, small cards |
| `radius-panel` | `16px` | Modals, larger panels, buttons |
| `shadow-soft` | subtle 2-layer ink shadow | Resting card elevation |
| `shadow-float` | stronger 2-layer ink shadow | Hover / floating elevation |

### Animations

| Token | Effect |
|-------|--------|
| `animate-fade-up` | Slide up + fade in — screen transitions |
| `animate-pop-in` | Scale + fade in — modals, toasts |
| `animate-lock-pop` | Spring entrance — lock icon |
| `animate-bounce-dot` | Infinite bounce — loading dots |
| `animate-load-pulse` | Infinite pulse — skeletons |
| `animate-cel-wiggle` | Infinite wiggle — empty states |

### Reusable Component Classes

Defined in `@layer components` in `globals.css`:

- `.input-field` — parchment bg, cream-deep border, sage focus ring
- `.textarea-field` — extends `.input-field`, no resize, min-height 82px
- `.select-field` — extends `.input-field`, right padding for arrow
- `.btn-primary` — full-width, `radius-panel`, semibold, active scale-down
