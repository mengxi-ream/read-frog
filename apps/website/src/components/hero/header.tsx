'use client'

import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import React from 'react'
import { Install } from '@/components/install'
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
        <div className="mt-6">
          <div className="text-center mb-4 font-light text-sm text-neutral-500 dark:text-neutral-400">
            {t('install.on')}
          </div>
          <Install />
        </div>
      </motion.div>
    </AuroraBackground>
  )
}
