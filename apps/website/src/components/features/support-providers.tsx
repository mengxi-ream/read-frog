'use client'

import type { Provider } from '@/utils/constants/providers'
import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Container } from '@/components/container'
import { InfiniteScroller } from '@/components/motion/infinite-scroller'
import { ProgressTabs } from '@/components/motion/progress-tabs'
import { Wallet } from '@/components/motion/wallet-animation'
import ProviderIcon from '@/components/provider-icon'
import { useHydration } from '@/hooks/useHydration'
import { CUSTOM_PROVIDER_ITEMS, NON_CUSTOM_LLM_PROVIDER_ITEMS, PURE_PROVIDERS_ITEMS } from '@/utils/constants/providers'

enum PROVIDER_TYPES_ENUM {
  NON_CUSTOM_LLM_PROVIDER = 'NON_CUSTOM_LLM_PROVIDER',
  CUSTOM_PROVIDER = 'CUSTOM_PROVIDER',
  PURE_PROVIDER = 'PURE_PROVIDER',
}

const PROVIDER_TYPES = [PROVIDER_TYPES_ENUM.NON_CUSTOM_LLM_PROVIDER, PROVIDER_TYPES_ENUM.CUSTOM_PROVIDER, PROVIDER_TYPES_ENUM.PURE_PROVIDER] as const

export function SupportProviders() {
  const t = useTranslations('features.supportProviders')

  const providerTypeNameMap: Record<PROVIDER_TYPES_ENUM, string> = {
    NON_CUSTOM_LLM_PROVIDER: t('nonCustomProvider'),
    CUSTOM_PROVIDER: t('customProvider'),
    PURE_PROVIDER: t('pureProvider'),
  }

  const [activeProviderIndex, setActiveProviderIndex] = useState(0)

  const providerTabs = PROVIDER_TYPES.map(type => ({
    id: type,
    label: providerTypeNameMap[type],
  }))

  const activeProviderType = PROVIDER_TYPES[activeProviderIndex]

  return (
    <section className="w-full bg-zinc-150 dark:bg-zinc-850 border-t border-zinc-200 dark:border-zinc-800 flex-auto md:h-fit">
      <Container className="h-full py-15 md:py-30 flex flex-col md:grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-stretch">
        <div className="flex flex-col h-fit md:h-full gap-6 md:gap-12">
          <div className="flex flex-col h-fit gap-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t('title')}
            </h1>
            <span className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {t('explanation')}
            </span>
          </div>
          <ProgressTabs items={providerTabs} activeIndex={activeProviderIndex} setActiveIndex={setActiveProviderIndex} />
        </div>
        <div className="flex justify-center items-center py-0 h-60 md:h-100">
          {activeProviderType === PROVIDER_TYPES_ENUM.NON_CUSTOM_LLM_PROVIDER ? <NonCustomLLMProviders /> : <></>}
          {activeProviderType === PROVIDER_TYPES_ENUM.CUSTOM_PROVIDER ? <CustomProviders /> : <></>}
          {activeProviderType === PROVIDER_TYPES_ENUM.PURE_PROVIDER ? <PureProviders /> : <></>}
        </div>
      </Container>
    </section>
  )
}

function ProviderMotionLogo({ logo, id }: Provider) {
  const { resolvedTheme } = useTheme()
  const isHydrated = useHydration()
  const isDark = isHydrated && resolvedTheme === 'dark'

  return (
    <motion.div whileHover={{ scale: 1.3 }}>
      <ProviderIcon logo={logo(isDark)} name={id} className="mx-4" size="xl" />
    </motion.div>
  )
}

function NonCustomLLMProviders() {
  const providers = Object.values(NON_CUSTOM_LLM_PROVIDER_ITEMS)

  const thirdPartSeparatorIndexOfProvider = Math.floor(providers.length / 3)
  const firstProviders = providers.slice(0, thirdPartSeparatorIndexOfProvider)
  const secondProviders = providers.slice(thirdPartSeparatorIndexOfProvider, thirdPartSeparatorIndexOfProvider * 2)
  const thirdProviders = providers.slice(thirdPartSeparatorIndexOfProvider * 2)

  return (
    <div className="w-full h-full flex flex-col justify-center py-0 md:gap-8">
      <InfiniteScroller className="py-4" repeatCount={3} cardSequence={firstProviders} renderCard={ProviderMotionLogo} />
      <InfiniteScroller className="py-4" repeatCount={3} reverse cardSequence={secondProviders} renderCard={ProviderMotionLogo} />
      <InfiniteScroller className="py-4" repeatCount={3} cardSequence={thirdProviders} renderCard={ProviderMotionLogo} />
    </div>
  )
}

function CustomProviders() {
  const providers = Object.values(CUSTOM_PROVIDER_ITEMS)

  const wallet = CUSTOM_PROVIDER_ITEMS.customProvider
  const coins = providers.filter(provider => provider.id !== wallet.id)

  return (
    <div className="w-full h-full py-4">
      <Wallet wallet={<ProviderMotionLogo {...wallet} />} coins={coins.map(coin => <ProviderMotionLogo key={coin.id} {...coin} />)} />
    </div>
  )
}

function PureProviders() {
  return (
    <div className="w-full h-full flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <ProviderMotionLogo {...PURE_PROVIDERS_ITEMS.microsoft} />
        </div>
        <div className="absolute bottom-0 left-0 transform -translate-x-1/2 translate-y-1/2">
          <ProviderMotionLogo {...PURE_PROVIDERS_ITEMS.google} />
        </div>
        <div className="absolute bottom-0 right-0 transform translate-x-1/2 translate-y-1/2">
          <ProviderMotionLogo {...PURE_PROVIDERS_ITEMS.deeplx} />
        </div>
      </div>
    </div>
  )
}
