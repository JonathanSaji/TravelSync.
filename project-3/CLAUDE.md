@AGENTS.md

# CLAUDE.md — TravelSync

> TravelSync is a standalone trip-planning app and one of seven apps in the SubSync ecosystem.

---

## The SubSync Ecosystem

SubSync is a suite of seven specialized apps that share a common identity layer called **Sync Core**. Each app is independent and lives on its own subdomain, but they are presented together on the SubSync landing page and dashboard as a unified product family.

**The seven apps:**

| App | Domain | Purpose |
|-----|--------|---------|
| TrackerSync | trackersync.sub-sync.ca | Subscription & finance tracker |
| TravelSync | travelsync.sub-sync.ca | Trip planning & travel memories |
| BrainSync | brainsync.sub-sync.ca | Deep focus & productivity |
| SeatSync | seatsync.sub-sync.ca | Desk & workplace scheduling |
| PhotoSync | photosync.sub-sync.ca | AI photo organization |
| FluencySync | fluencysync.sub-sync.ca | Language learning |
| SteadySync | steadysync.sub-sync.ca | Health & wellness |

**SubSync hub:**
- Landing page: `sub-sync.ca`
- Dashboard (requires login): `sub-sync.ca/dashboard`
- Authentication is shared — users log in once via SubSync and a `subsync_token` JWT is stored in `localStorage`

---

## TravelSync's Place in the Ecosystem

TravelSync is the travel arm of SubSync. Its role is itinerary management, trip timelines, and travel memory journaling — the app that handles everything before, during, and after a trip.

It is an independent app with its own branding, design system, and codebase. It does not need to match the SubSync landing page's visual language (honey/amber palette, glass morphism) — TravelSync's own brand takes priority.

The only expected ecosystem touchpoint is a **SubSync home button** (see below).

---

## SubSync Home Button

There should be a small **SubSync icon in the bottom-right corner** of every page. Clicking it navigates the user back to the SubSync ecosystem:

- If the user is **logged in** (`subsync_token` exists in `localStorage`): link goes to `https://sub-sync.ca/dashboard`
- If the user is **not logged in**: link goes to `https://sub-sync.ca`

The SubSync logo asset can be sourced from the landing page repo at `public/logos/SubSync.png`, or fetched from `https://sub-sync.ca/logos/SubSync.png`.

This button should be subtle — it is a navigation aid, not a primary UI element. It should not interfere with TravelSync's own branding or layout.

---

## Auth Notes

- Token key: `subsync_token` in `localStorage`
- Token is base64-encoded JSON with fields: `accountId`, `username`, `displayName`, `email`
- Decode with: `JSON.parse(atob(localStorage.getItem("subsync_token")))`
- No server-side session — all auth is client-side token checks
- If you need to check login state, check for the presence of `subsync_token` in localStorage

---

## App Structure

```
project-3/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── admin/init-db/        # DB initialisation endpoint
│   │   ├── auth/login/           # Login route
│   │   ├── auth/register/        # Register route
│   │   ├── generate-trip/        # AI trip generation (Google Gemini)
│   │   ├── share-bin/            # JSONBin share endpoint
│   │   ├── trips/                # CRUD for trips
│   │   └── trips/[tripId]/shares/
│   ├── globals.css               # Tailwind v4 @theme tokens + component classes
│   ├── layout.tsx                # Root layout, font loading
│   └── page.tsx                  # Entry page
├── components/
│   ├── screens/
│   │   ├── AIDraft.tsx           # AI-generated itinerary review screen
│   │   ├── CreatorSetup.tsx      # Trip creation form
│   │   ├── IdeaSandbox.tsx       # Idea/brainstorm canvas
│   │   └── SuccessState.tsx      # Post-save success screen
│   ├── ItineraryDayTabBar.tsx    # Day-tab navigation for itinerary
│   ├── Project3.tsx              # Root app component (client shell)
│   ├── Toast.tsx                 # Toast notification component
│   └── TopBar.tsx                # App top bar
├── lib/
│   ├── auth.ts                   # Token helpers
│   ├── buildTripOrder.ts         # Sorts/orders trip days
│   ├── db.ts                     # PostgreSQL client (pg)
│   ├── ensureTravelSyncTables.ts # DB migration helper
│   ├── jsonbinKey.ts             # JSONBin API key helper
│   ├── loadSharedSandboxOnServer.ts
│   ├── sharedSandbox.ts          # Shared sandbox state logic
│   └── utils.ts
├── types/
│   └── index.ts                  # Shared TypeScript types
├── tests/
│   └── generate-trip.test.ts
├── public/                       # Static assets
├── CLAUDE.md
├── AGENTS.md
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Start production server (`next start`) |
| `npm run lint` | Run ESLint |

**Key dependencies:**
- `next` 16.2.2 (App Router, Tailwind v4 compatible)
- `react` / `react-dom` 19.2.4
- `@google/genai` — Gemini AI for trip generation
- `pg` — PostgreSQL client
- `tailwindcss` v4 + `@tailwindcss/postcss`
- `vitest` — test runner

---

## UI Design System

All tokens are defined in [app/globals.css](app/globals.css) via a Tailwind v4 `@theme` block. There is no `tailwind.config.js` — use the CSS variable names directly as Tailwind utilities (e.g. `bg-cream`, `text-ink`, `shadow-soft`).

### Color Palette

| Token | Hex | Use |
|-------|-----|-----|
| `cream` | `#F7F5F0` | Primary page background |
| `cream-deep` | `#EDEAE2` | Borders, dividers |
| `parchment` | `#FAF8F4` | Input/card backgrounds |
| `sage` | `#7A9E8E` | Primary accent, focus rings |
| `sage-light` | `#A8C5B7` | Light sage variations |
| `sage-dim` | `#EDF3F0` | Subtle tinted backgrounds |
| `sand` | `#C4A882` | Secondary warm accent |
| `sand-light` | `#EFE5D6` | Light warm fills |
| `terra` | `#B8714E` | Alert / warm emphasis |
| `terra-light` | `#F0E0D6` | Light terra backgrounds |
| `ink` | `#2C2B28` | Primary text |
| `ink-mid` | `#5C5A56` | Secondary text |
| `ink-faint` | `#9B9892` | Placeholder / hint text |

### Typography

| Token | Font | Weights | Use |
|-------|------|---------|-----|
| `font-display` | DM Serif Display | 400 (normal + italic) | Headings, display text |
| `font-sans` | Outfit | 300, 400, 500, 600 | Body, UI labels |

### Spacing & Shape

| Token | Value | Use |
|-------|-------|-----|
| `radius-card` | `10px` | Inputs, small cards |
| `radius-panel` | `16px` | Modals, larger panels, buttons |

### Shadows

| Token | Value | Use |
|-------|-------|-----|
| `shadow-soft` | `0 1px 4px rgba(44,43,40,.06), 0 2px 12px rgba(44,43,40,.04)` | Resting card elevation |
| `shadow-float` | `0 4px 16px rgba(44,43,40,.08), 0 1px 4px rgba(44,43,40,.04)` | Hover/floating elevation |

### Animations

| Token | Timing | Effect |
|-------|--------|--------|
| `animate-fade-up` | 0.34s ease | Slide up + fade in (page transitions) |
| `animate-pop-in` | 0.22s spring | Scale up + fade in (modals, toasts) |
| `animate-lock-pop` | 0.46s spring, 0.05s delay | Lock icon spring entrance |
| `animate-bounce-dot` | 1.2s infinite | Loading dot bounce |
| `animate-load-pulse` | 1.8s infinite | Skeleton/loading pulse |
| `animate-cel-wiggle` | 1.3s infinite | Playful wiggle (empty states) |

### Reusable Component Classes

Defined in `@layer components` in globals.css — apply directly with `className`:

- **`.input-field`** — standard text input (parchment bg, cream-deep border, sage focus ring)
- **`.textarea-field`** — extends `.input-field`, resizable off, min-height 82px
- **`.select-field`** — extends `.input-field`, right padding for dropdown arrow
- **`.btn-primary`** — full-width flex button with `radius-panel`, semibold, active scale-down tap feedback
