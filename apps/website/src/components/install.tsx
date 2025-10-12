'use client'

import { cn } from '@repo/ui/lib/utils'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { detectBrowser } from '@/lib/detect-browser'

export function Install() {
  const t = useTranslations('home')
  const [browser, setBrowser] = useState('')

  useEffect(() => {
    // fix hydration mismatch
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setBrowser(detectBrowser())
  }, [])

  return (
    <div className="grid grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 items-center gap-4 md:gap-10">
      <InstallLink
        href="https://chromewebstore.google.com/detail/read-frog/modkelfkcfjpgbfmnbnllalkiogfofhb?utm_source=official"
        icon="/icons/chrome.png"
        focus={browser === 'chrome'}
      >
        {t('install.chrome')}
      </InstallLink>
      <InstallLink
        href="https://microsoftedge.microsoft.com/addons/detail/read-frog-open-source-a/cbcbomlgikfbdnoaohcjfledcoklcjbo"
        icon="/icons/edge.png"
        focus={browser === 'edge'}
      >
        {t('install.edge')}
      </InstallLink>
    </div>
  )
}

function InstallLink({
  href,
  icon,
  children,
  focus,
}: {
  href: string
  icon: string
  children: React.ReactNode
  focus: boolean
}) {
  return (
    <Link
      href={href}
      target="_blank"
      className={
        cn(
          'rounded-full w-full px-10 py-3 flex items-center justify-center gap-4 active:scale-95 duration-150 transition-all ease-in-out border shadow-xs hover:-translate-y-0.5',
          focus
            ? 'border-primary-strong font-medium bg-white text-primary ring-1 ring-white/20 shadow-primary-strong'
            : 'border border-black/20 text-zinc-800 bg-white hover:bg-white',
        )
      }
    >
      <Image src={icon} alt={icon} className="size-5" width={20} height={20} />
      {children}
    </Link>
  )
}
