'use client'

import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { AuroraBackground } from '@/components/motion/aurora-background'

export function Header() {
  const t = useTranslations('home')

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: 'easeInOut',
        }}
        className="relative flex flex-col gap-4 items-center justify-center px-4 pt-14"
      >
        <div className="text-4xl md:text-7xl font-bold dark:text-white text-center">
          {t('title')}
        </div>
        <div className="font-extralight text-base md:text-2xl dark:text-neutral-200 py-4 text-center">
          {t('subtitle')}
        </div>
        <Install />
      </motion.div>
    </AuroraBackground>
  )
}

function Install() {
  const t = useTranslations('home')
  return (
    <div className="mt-6">
      <div className="text-center mb-4 font-light text-sm text-neutral-500 dark:text-neutral-400">
        {t('install.on')}
      </div>
      <div className="flex items-center gap-4">
        <InstallLink
          href="https://chromewebstore.google.com/detail/read-frog/modkelfkcfjpgbfmnbnllalkiogfofhb?utm_source=official"
          icon="/images/icons/chrome.png"
        >
          {t('install.chrome')}
        </InstallLink>
        <InstallLink
          href="https://microsoftedge.microsoft.com/addons/detail/read-frog-open-source-a/cbcbomlgikfbdnoaohcjfledcoklcjbo"
          icon="/images/icons/edge.png"
        >
          {t('install.edge')}
        </InstallLink>

        {/* <Link
          href="https://chromewebstore.google.com/detail/read-frog/modkelfkcfjpgbfmnbnllalkiogfofhb?utm_source=official"
          target="_blank"
          className="bg-black dark:bg-white rounded-full w-fit text-white dark:text-black px-4 py-2 flex items-center gap-2"
        >
          <img src="/images/icons/chrome.png" alt="Chrome" className="size-5" />
          {t("install")}
        </Link> */}
      </div>
    </div>
  )
}

function InstallLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      target="_blank"
      className="bg-black dark:bg-white rounded-full w-fit text-white dark:text-black px-4 py-2 flex items-center gap-2"
    >
      <Image src={icon} alt={icon} className="size-5" width={20} height={20} />
      {children}
    </Link>
  )
}
