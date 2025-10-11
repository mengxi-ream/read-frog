'use client'

import { useTranslations } from 'next-intl'
import { Install } from '@/components/install'
import HeroHighlight from './components/hero-highlight'

export function Recall() {
  const t = useTranslations('recall')
  return (
    <section className="w-full">
      <HeroHighlight>
        <div
          className="max-w-6xl py-32 px-8 flex items-center justify-center flex-col gap-12"
        >
          <h1 className="text-4xl font-bold text-center">
            {t('title')}
          </h1>
          <span className="text-center text-lg text-zinc-700 dark:text-zinc-300 text-wrap">
            {t('description')}
          </span>
          <Install />
        </div>
      </HeroHighlight>
    </section>
  )
}
