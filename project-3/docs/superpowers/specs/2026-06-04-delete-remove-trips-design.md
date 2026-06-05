# Delete / Remove Trips — Design Spec

**Date:** 2026-06-04
**Status:** Approved

---

## Overview

Add the ability for users to delete their own trips and remove themselves from trips shared with them. Both actions require a confirmation modal before executing. Additionally, a new "Edit trip" shortcut always opens a trip in the IdeaSandbox regardless of its current state.

---

## UI

### Three-dot (⋯) menu on trip cards

Every trip card in the Saved Plans panel gains a small `···` button beside the badge. Only one menu can be open at a time; clicking anywhere outside it (including the panel scroll area) closes it.

**My Plans cards — two items:**
- ✏️ Edit trip → always navigates to IdeaSandbox
- 🗑 Delete trip → opens the Delete confirmation modal

**Shared with me cards — one item:**
- ✕ Remove → opens the Remove confirmation modal

### Confirmation modal

Reuses the existing modal overlay pattern (same structure as the Share dialog in `SuccessState.tsx`).

**Delete modal:**
- Header label: "Delete Trip"
- Body (terra-tinted warning box): `"[Trip Name]" will be permanently deleted. This can't be undone. All shares will be removed too.`
- Buttons: "Cancel" (secondary) · "Delete forever" (terra/red primary)

**Remove modal:**
- Header label: "Remove Trip"
- Body: `You'll be removed from "[Trip Name]". You can ask to be re-added by the owner.`
- Buttons: "Cancel" · "Remove" (terra primary)

Both modals display a busy/loading state on the confirm button while the API call is in flight.

---

## State (Project3.tsx)

Two new state fields:

```ts
const [openMenuTripId, setOpenMenuTripId] = useState<string | null>(null)
const [deleteTarget, setDeleteTarget] = useState<{
  tripId: string
  tripName: string
  type: 'delete' | 'remove'
} | null>(null)
const [deleteBusy, setDeleteBusy] = useState(false)
```

### New handlers

**`handleEditTrip(trip)`**
Identical to `openSavedTrip` except it always sets `screen = 'sandbox'`, regardless of whether the trip has activities. Closes the panel.

**`handleDeleteTripClick(trip)`**
Sets `deleteTarget` to `{ tripId: trip.id, tripName: trip.planDetails.name || trip.trip.tripName, type: 'delete' }`. Closes the ⋯ menu.

**`handleRemoveSharedClick(trip)`**
Same as above with `type: 'remove'`.

**`handleDeleteConfirm()`**
1. Sets `deleteBusy = true`
2. If `type === 'delete'`: calls `DELETE /api/trips/[tripId]` with `{ userId }`. If `type === 'remove'`: calls `DELETE /api/trips/[tripId]/shares` with `{ userId }` (self-removal path)
3. On success:
   - Removes the trip from `myTrips` or `sharedTrips` state
   - If `savedTripId === deleteTarget.tripId`, resets all trip state (`savedTripId`, `activeTripOwnerId`, `planDetails`, `ideas`, `generatedTrip`) and navigates to `'setup'`
   - Shows a toast: `"[Trip Name] deleted."` or `"Removed from [Trip Name]."`
4. On error: shows a toast with the server error message
5. Always: sets `deleteBusy = false`, clears `deleteTarget`

### Menu close behaviour

The panel's scrollable container (`onMouseDown`) calls `setOpenMenuTripId(null)` when clicked, so clicking outside any open ⋯ menu closes it.

---

## API

### 1. New — `DELETE /api/trips/[tripId]`

**File:** `app/api/trips/[tripId]/route.ts` (new file)

**Request body:** `{ userId: string }`

**Logic:**
1. Parse and validate `tripId` from URL path and `userId` from body
2. Load `owner_id` for the trip — 404 if not found
3. Reject with 403 if `userId !== owner_id`
4. `DELETE FROM "TravelSync".trip_shares WHERE trip_id = $1` (explicit cleanup)
5. `DELETE FROM "TravelSync".trips WHERE id = $1`
6. Return `{ ok: true }`

### 2. Extended — `DELETE /api/trips/[tripId]/shares`

**File:** `app/api/trips/[tripId]/shares/route.ts` (existing, extend existing `DELETE` handler)

The existing handler supports owner-removing-someone-else (`{ userId: ownerId, sharedUserId }`). Add a second branch for self-removal:

- If `sharedUserId` is **not** provided in the body, treat as self-removal:
  - Deletes the row where `trip_id = tripId AND shared_with_user_id = userId`
  - No owner check needed — users can always remove themselves
  - Returns `{ ok: true }` (or 404 if no row existed)

---

## Edge cases

| Situation | Behaviour |
|-----------|-----------|
| Deleting the currently active trip | Reset all trip state, navigate to `'setup'`, toast "Tokyo Weekend deleted." |
| Removing the currently active shared trip | Same reset + navigate to `'setup'` |
| API call fails mid-delete | Show error toast, leave state unchanged (no optimistic removal) |
| Trip not found (deleted elsewhere) | 404 from API → toast "Trip not found." |
| Clicking ⋯ while another menu is open | Closes the old menu, opens the new one |

---

## Out of scope

- Soft delete / restore — hard delete only
- Bulk delete
- Owner removing a collaborator from this flow (that's the existing Share dialog's responsibility)
