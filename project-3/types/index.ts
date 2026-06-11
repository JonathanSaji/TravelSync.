// ── Domain types ──────────────────────────────────────────────────────────

export interface PlanDetails {
  name:      string
  location:  string
  group:     string
  budget:    string
  /** Legacy free-text date field preserved for backward compatibility. */
  dates?:    string
  /** ISO date string YYYY-MM-DD representing the trip start date. */
  startDate?: string
  /** ISO date string YYYY-MM-DD representing the trip end date. */
  endDate?: string
}

/** Per-idea time footprint (dropdown in Idea Sandbox). */
export type TimeCommitment = 'regular' | 'half_day' | 'full_day' | 'anchor'

export interface IdeaItem {
  id:               string   // crypto.randomUUID()
  text:             string
  /** 1 = nice-to-have … 5 = must-include */
  priority:         number
  timeCommitment:   TimeCommitment
  dealbreaker:      string   // empty string if none
  /** True when this entry is a manually created event with optional event metadata. */
  isCustomEvent?:   boolean
  /** Optional source/reference URL for custom events. */
  eventLink?:       string
  /** Optional event venue or area. */
  eventLocation?:   string
  /** Optional time label like "2:00 PM". */
  eventTime?:       string
  /**
   * If true, AI can place this event anywhere that best fits the day.
   * If false and eventTime exists, AI must schedule at that exact time.
   */
  eventTimeFlexible?: boolean
  /**
   * If true, this idea follows normal priority scoring.
   * If false, this idea is mandatory and must be included in the itinerary.
   */
  priorityEnabled?: boolean
}

// The four screens of the app flow
export type Screen = 'setup' | 'sandbox' | 'draft' | 'success'
