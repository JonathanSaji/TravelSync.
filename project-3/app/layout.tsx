import type { Metadata } from 'next'
import { DM_Serif_Display, Outfit } from 'next/font/google'
import './globals.css'
import SubSyncHomeButton from '@/components/SubSyncHomeButton'

// ── Fonts ─────────────────────────────────────────────────────────────────
// next/font loads fonts at build time — zero layout shift, no external request
// at runtime. CSS variables are injected on <html> so Tailwind's font-display
// and font-sans classes can reference them.

const dmSerifDisplay = DM_Serif_Display({
  subsets:  ['latin'],
  weight:   ['400'],
  style:    ['normal', 'italic'], // italic used for the hero <em> accent
  variable: '--font-dm-serif',
  display:  'swap',
})

const outfit = Outfit({
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600'],
  variable: '--font-outfit',
  display:  'swap',
})

// ── Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title:       'TravelSync.',
  description: 'Collaborative planning, perfected. AI-synthesised itineraries for every group.',
}

// ── Layout ────────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // Attach font CSS variables to <html> so Tailwind's fontFamily config
      // can pick them up via var(--font-dm-serif) / var(--font-outfit)
      className={`${dmSerifDisplay.variable} ${outfit.variable}`}
    >
      <body className="bg-cream font-sans antialiased" suppressHydrationWarning>
        {children}
        <SubSyncHomeButton />
      </body>
    </html>
  )
}
