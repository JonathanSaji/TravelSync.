'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function SubSyncHomeButton() {
  const [href, setHref] = useState('https://sub-sync.ca')

  useEffect(() => {
    if (localStorage.getItem('subsync_token')) {
      setHref('https://sub-sync.ca/dashboard')
    }
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-50 group">

      {/* Tooltip */}
      <div className="
        absolute bottom-full right-0 mb-2.5
        px-2.5 py-1 rounded-lg
        bg-ink text-cream text-[0.72rem] font-sans font-semibold whitespace-nowrap
        opacity-0 translate-y-1
        group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200 pointer-events-none
      ">
        SubSync Home
        {/* Caret */}
        <span className="absolute top-full right-3.5 border-4 border-transparent border-t-ink" />
      </div>

      {/* Button */}
      <a
        href={href}
        aria-label="Back to SubSync"
        className="
          relative flex h-10 w-10 items-center justify-center rounded-full
          bg-[#111] shadow-float
          transition-all duration-200
          group-hover:scale-110
          group-hover:shadow-[0_0_0_3px_rgba(245,184,0,0.55),0_6px_28px_rgba(245,184,0,0.22)]
          active:scale-95
          [-webkit-tap-highlight-color:transparent]
        "
      >
        <Image
          src="https://sub-sync.ca/logos/SubSync.png"
          alt="SubSync"
          width={26}
          height={26}
          className="rounded-full transition-transform duration-300 group-hover:rotate-[20deg]"
          unoptimized
        />
      </a>
    </div>
  )
}
