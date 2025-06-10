'use client'
import Link from 'next/dist/client/link'
import Image from 'next/image'
import React from 'react'
import { Boxes } from '@/components/motion/background-boxes'

export function Recall() {
  return (
    <div className="h-96 relative w-full overflow-hidden flex flex-col items-center justify-center rounded-lg mt-16">
      <div className="absolute inset-0 w-full h-full z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />

      <Boxes />
      <Link
        href="https://chromewebstore.google.com/detail/read-frog/modkelfkcfjpgbfmnbnllalkiogfofhb?utm_source=official"
        target="_blank"
        className="z-50 bg-black dark:bg-white rounded-full w-fit text-white dark:text-black px-4 py-2 flex items-center gap-2"
      >
        <Image src="/images/icons/chrome.png" alt="Chrome" className="size-5" width={20} height={20} />
        Install Now
      </Link>
      <p className="text-center mt-4 text-neutral-300 relative z-20">
        Visit any website you like to learn a language.
      </p>
    </div>
  )
}
