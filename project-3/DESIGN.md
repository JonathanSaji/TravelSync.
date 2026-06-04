---
name: TravelSync
description: AI-assisted collaborative trip planning for friends
colors:
  sage: "#7A9E8E"
  sage-light: "#A8C5B7"
  sage-dim: "#EDF3F0"
  sand: "#C4A882"
  sand-light: "#EFE5D6"
  terra: "#B8714E"
  terra-light: "#F0E0D6"
  cream: "#F7F5F0"
  cream-deep: "#EDEAE2"
  parchment: "#FAF8F4"
  ink: "#2C2B28"
  ink-mid: "#5C5A56"
  ink-faint: "#9B9892"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  card: "10px"
  panel: "16px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "22px"
  xl: "32px"
components:
  input-field:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  btn-primary:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "15px 22px"
  btn-primary-hover:
    backgroundColor: "{colors.sand-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "15px 22px"
  btn-ghost:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink-mid}"
    rounded: "{rounded.card}"
    padding: "8px 12px"
---

# Design System: TravelSync

## 1. Overview

**Creative North Star: "The Prepared Traveler's Notebook"**

TravelSync's visual language is built on quiet confidence. Typography does the primary organizational work — DM Serif for display moments, Outfit for everything operational. The interface recedes so the trip can feel real. Nothing decorative that doesn't earn its place; every element either clarifies a decision or confirms an action.

Depth is tonal, not shadowed. Surfaces layer from cream to parchment to white, creating a hierarchy of planes without the architectural weight of box-shadows. Sage green acts as the system's trusted marker: used sparingly, it always means "this matters." Sand and terra carry human warmth — the invitation to act, the alert that something needs attention.

The system explicitly rejects: generic SaaS hero aesthetics (navy gradients, metric grids, illustration-heavy landing zones), AI product glass/dark treatments (glassmorphism, purple gradients, "powered by AI" as decoration), and booking-site density (star ratings everywhere, compressed card grids, stock photography collages).

**Key Characteristics:**
- Typography-led hierarchy: DM Serif announces, Outfit operates
- Tonal layering: cream → parchment → white as the depth axis
- Sage as signal, not fill: discipline in primary accent usage
- Sand and terra for warmth and human action moments
- Motion is earned: animations on confirmation, transition, and empty states only

## 2. Colors: The Notebook Palette

A warm-neutral field with one trusted accent and two expressive secondary roles.

### Primary
- **Prepared Sage** (#7A9E8E): The system's anchor accent. Used on focus rings, selected states, the "Yours" badge, and active UI moments. Never as a large fill or background. Its scarcity is what makes it read as a signal.
- **Sage Mist** (#A8C5B7): Lighter sage for decorative highlights and hover tints. Never standalone; always paired with Prepared Sage context.
- **Sage Field** (#EDF3F0): Subtle sage-tinted surface for hover states, active row backgrounds, and light visual anchoring.

### Secondary
- **Warm Sand** (#C4A882): Primary CTA fill and warmth accent. The color of action in TravelSync — inviting, not commanding. Used on primary buttons and affirming UI moments.
- **Sand Wash** (#EFE5D6): Light sand fill for secondary surfaces and warm-tinted panels.

### Tertiary
- **Terracotta** (#B8714E): Alert, error, and emphasis color. Appears on destructive actions, warning states, and "logout" type affordances. Never decorative.
- **Terra Blush** (#F0E0D6): Light terracotta tint for alert panel backgrounds and error field highlights.

### Neutral
- **Cream** (#F7F5F0): Primary page background. The field everything sits on.
- **Deep Cream** (#EDEAE2): Borders, dividers, and the tonal step below cream.
- **Parchment** (#FAF8F4): Input backgrounds, card surfaces. One step lighter than cream.
- **Ink** (#2C2B28): Primary text. Near-black with a warm undertone — not harsh, not cold.
- **Mid Ink** (#5C5A56): Secondary text, metadata, timestamps. Clear but not primary.
- **Faint Ink** (#9B9892): Placeholders, hint text, disabled labels. Must not be used for actionable text; fails AA contrast against parchment.

**The One Marker Rule.** Prepared Sage (#7A9E8E) appears on ≤15% of any given screen. It is a signal, not a surface color. The moment it covers more area than that, it loses its authority.

**The Warmth-Through-Action Rule.** Warm Sand (#C4A882) appears on CTAs and affirming moments — not on decorative elements or as an ambient fill. Warmth is earned by what it accompanies, not by how much of the screen it covers.

## 3. Typography

**Display Font:** DM Serif Display (Georgia, serif fallback)
**Body Font:** Outfit (system-ui, sans-serif fallback)

**Character:** A serif/geometric sans pairing that leans editorial without being precious. DM Serif announces; Outfit executes. The contrast between the two is high enough that they never compete — they perform different roles in the same scene.

### Hierarchy
- **Display** (400 weight, 1.25–2.2rem, 1.15 line-height): Screen headings and major section titles. DM Serif only. Use `text-wrap: balance`. Letter-spacing default — never negative.
- **Headline** (600 weight, 1.0–1.1rem, 1.3 line-height): Component headers, panel titles, dialog names. Outfit. The operational level below display.
- **Body** (400 weight, 0.88–0.92rem, 1.55–1.65 line-height): All descriptive and instructional text. Outfit. Max line length 65ch on wide layouts.
- **Label** (600 weight, 0.68–0.72rem, tracking 0.08–0.12em, uppercase): Section markers, badge text, metadata categories. Outfit. Reserved for short identifiers (1–4 words). Never full sentences in all-caps.
- **Small / Meta** (400–500 weight, 0.7–0.74rem): Timestamps, owner attribution, secondary metadata. Outfit in ink-faint or ink-mid.

**The Display-Earns-Its-Place Rule.** DM Serif Display appears only on screen-level headings and major content titles. It is prohibited on UI labels, tab text, badge copy, button labels, and navigational elements. Every instance should feel like an announcement.

**The Label Ceiling Rule.** Uppercase tracking labels (the `text-[0.68rem] font-semibold tracking-[0.12em] uppercase` pattern) are limited to one per discrete UI section. They are identifiers, not decoration. Overusing them dilutes their signal and produces the "AI scaffold" pattern this system explicitly rejects.

## 4. Elevation

TravelSync uses tonal layering as its primary depth language, not shadows. Surfaces create a hierarchy through color: cream (page) → parchment (cards/inputs) → white (dialogs/elevated panels). This reads as depth without visual noise.

Shadows are reserved for state responses — they appear when something needs to communicate "this is above the page," not as resting decoration.

### Shadow Vocabulary
- **Soft** (`0 1px 4px rgba(44,43,40,.06), 0 2px 12px rgba(44,43,40,.04)`): Resting card state when a mild visual lift is needed. Used sparingly — the first choice is always tonal layering.
- **Float** (`0 4px 16px rgba(44,43,40,.08), 0 1px 4px rgba(44,43,40,.04)`): Active hover/open state for elevated panels, slide-out drawers, and modals. Signals "this is above the current surface."

**The Flat-by-Default Rule.** Surfaces are flat at rest. The presence of a shadow means something is in a state — hovered, open, elevated. A surface with a permanent shadow that never changes is using elevation decoratively, which is prohibited.

**The Tonal-First Rule.** Before reaching for a shadow, ask whether a background shift (cream → parchment, or parchment → white) achieves the same depth. Shadows are the second tool, not the first.

## 5. Components

### Buttons
Rounded to `panel` radius (16px) — rounded enough to feel friendly without being pill-shaped.

- **Primary (Warm Sand):** `background: #C4A882`, `color: #2C2B28`, 15px top/bottom padding, 22px left/right, full width on mobile. The sand fill is warm and inviting — it reads as an affirmative action, not a command. Active state scales down to 97% for tactile feedback.
- **Destructive/Secondary:** `background: white`, `color: #B8714E` (terra), `border: 1px solid cream-deep`. Used for logout, deletion, irreversible actions.
- **Ghost:** `background: parchment`, `color: ink-mid`, `border: 1px solid cream-deep`, `rounded: card (10px)`. Used for toggles, close controls, less prominent actions.
- **Hover transition:** 260ms `cubic-bezier(.4,0,.2,1)`. No scale on hover; scale-down only on active/press.

### Cards / Containers
- **Corner Style:** `rounded-panel` (16px)
- **Background:** parchment (#FAF8F4) or white for elevated panels
- **Shadow Strategy:** Tonal-first. Soft shadow (`shadow-soft`) on cards that need to lift from cream backgrounds. Float shadow (`shadow-float`) on hover.
- **Border:** `1.5px solid cream-deep (#EDEAE2)` as the standard card boundary. Never a colored stripe on the left or right.
- **Internal Padding:** 12px–16px standard; 8px–12px for compact list items.

### Inputs / Fields
- **Style:** parchment background, 1.5px `cream-deep` border, `card` radius (10px)
- **Focus:** `sage` (#7A9E8E) border + `0 0 0 3px rgba(122,158,142,0.13)` focus glow. The only place sage appears as a direct border color.
- **Placeholder text:** `ink-faint` (#9B9892). This color does NOT reach WCAG AA contrast against parchment — it is acceptable for placeholder-only use (visual hint, not meaningful content), but must never be used for real information.
- **Disabled:** reduced opacity to 60%. No additional style changes.
- **Textarea:** same base as input, `resize: none`, minimum 82px height, `leading-relaxed`.

### Side Panel (Saved Plans Drawer)
A distinctive slide-out panel fixed to the left viewport edge. At rest: collapsed to 44px tab showing "Plans". On open: 300px wide, full viewport height.

- **Background:** near-white with 96% opacity (`rgba(255,250,242,0.96)`) + `backdrop-blur-sm` — the one intentional blur in the system, contextually appropriate here as it overlays the main content.
- **Tab toggle:** rounded on the right edge only, ink text, cream-deep border. Communicates "this edge extends."
- **Transition:** 300ms ease-out translate. No bounce.

### Toast Notifications
Pop-in animation (popIn: 0.22s cubic-bezier spring scale + fade). Appears at a fixed position; auto-dismisses at 2.6s. Communicates confirmations, errors, and system feedback.

### Loading States
Three distinct loading patterns for distinct purposes:
- **Bounce dots** (`bounceDot` 1.2s infinite): AI generation waiting state — indicates work in progress, suggests the system is "thinking."
- **Load pulse** (`loadPulse` 1.8s infinite): Skeleton/shimmer for content that is loading in.
- **Cel wiggle** (`celWiggle` 1.3s infinite): Empty state icon animation — playful, indicates "nothing here yet" without being sad.

## 6. Do's and Don'ts

### Do:
- **Do** use Prepared Sage (#7A9E8E) as a signal — on focus rings, selected states, and active indicators — never as a large fill or ambient color.
- **Do** establish depth through tonal layering: cream (page) → parchment (card) → white (elevated dialog). Reach for shadows second.
- **Do** use DM Serif Display exclusively for screen-level headings. Every occurrence should read as an announcement.
- **Do** limit uppercase tracked labels to one per UI section, on identifiers of 4 words or fewer.
- **Do** ensure all body text hits ≥4.5:1 contrast against its background. Faint Ink (#9B9892) is approved for placeholders only.
- **Do** pair every animation with a `@media (prefers-reduced-motion: reduce)` alternative — typically a crossfade or instant transition.
- **Do** use Warm Sand (#C4A882) on CTAs and affirming moments. It should feel like an invitation, not a command.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, callouts, or list items. Use full borders, background tints, or leading icons instead.
- **Don't** use `background-clip: text` with gradient fills (gradient text). Use a solid color. Emphasis through weight or size.
- **Don't** use glassmorphism decoratively. The side panel's `backdrop-blur` is the one intentional exception in this system; adding blur + transparency to other cards or components is prohibited.
- **Don't** build SaaS-style hero zones: navy-blue gradient backgrounds, large metric grids, hero illustrations with abstract blobs, or gradient CTAs. This is a consumer trip planning tool, not a B2B landing page.
- **Don't** use purple gradients, dark glassmorphism, or "powered by AI" as a design element. The AI is a feature; it is not the identity.
- **Don't** build dense booking-site layouts: compressed card grids with star ratings, stock photography collages, or Expedia-style filter bars.
- **Don't** add an uppercase tracking eyebrow above every section heading. One per discrete section, identifiers only — not a default scaffold on every screen.
- **Don't** place ink-faint (#9B9892) on actionable or meaningful text. WCAG contrast fails against parchment and cream. Faint Ink is approved for visual hints (placeholder text) only.
- **Don't** animate CSS layout properties (width, height, top, left, padding). Animate `transform` and `opacity` only.
