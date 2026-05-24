interface TopBarProps {
  /** Step indicator shown on the right, e.g. "Step 1 / 3" or "Done ✓" */
  step?: string
  /** Text for the auth control shown on the right side of the bar. */
  authLabel?: string
  /** Opens the centered auth dialog. */
  onAuthClick?: () => void
}

/**
 * TopBar is a pure presentational component — no state, no 'use client' needed.
 * It renders identically across all screens.
 */
export default function TopBar({ step, authLabel, onAuthClick }: TopBarProps) {
  return (
    <div className="flex items-center justify-between py-[22px] pb-4">
      {/* Logo */}
      <div className="font-display text-xl text-ink tracking-[-0.01em]">
        TravelSync.
      </div>

      <div className="flex items-center gap-2">
        {onAuthClick && authLabel && (
          <button
            type="button"
            onClick={onAuthClick}
            className="flex items-center gap-2 rounded-full border border-cream-deep bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-ink shadow-soft transition hover:bg-parchment active:scale-[0.97]"
            aria-label={authLabel}
          >
            <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            {authLabel}
          </button>
        )}

        {/* Optional step pill */}
        {step && (
          <span
            className="text-[0.68rem] font-semibold tracking-[0.07em] uppercase text-ink-faint bg-cream-deep px-[11px] py-1 rounded-full"
            aria-label={step}
          >
            {step}
          </span>
        )}
      </div>
    </div>
  )
}
