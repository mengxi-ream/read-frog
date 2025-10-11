'use client'

import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import React from 'react'
import { Install } from '@/components/install'

export function Header() {
  const t = useTranslations('home')

  return (
    <div className="relative flex h-160 md:h-200 flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: 'easeInOut',
        }}
        viewport={{ once: true }}
        className="w-full md:max-w-6xl flex flex-col gap-4 items-center justify-center px-8 md:px-4 pt-20"
      >
        <span className="w-full break-all whitespace-pre-wrap text-4xl md:text-7xl font-bold dark:text-white text-center tracking-normal">
          {t('titleBefore')}
          <span className="text-primary-strong mx-2">
            {t('study')}
          </span>
          {t('titleAfter')}
        </span>
        <div className="max-w-4xl text-base text-neutral-600 dark:text-neutral-200 py-4 text-center">
          {t('subtitle')}
        </div>
        <div className="mt-6">
          <div className="text-center mb-4 font-light text-sm text-neutral-500 dark:text-neutral-400">
            {t('install.on')}
          </div>
          <Install />
        </div>
      </motion.div>
    </div>
  )
}
