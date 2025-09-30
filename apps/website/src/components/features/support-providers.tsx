'use client'

import type { Provider } from '@/utils/constants/providers'
import { cn } from '@repo/ui/lib/utils'
import { LayoutGroup, motion } from 'motion/react'
import { useState } from 'react'
import { Container } from '@/components/container'
import ProviderIcon from '@/components/provider-icon'
import { CUSTOM_PROVIDER_ITEMS, NON_CUSTOM_LLM_PROVIDER_ITEMS, PURE_PROVIDERS_ITEMS } from '@/utils/constants/providers'
import { InfiniteScroller } from '../motion/Infinite-scroller'

enum PROVIDER_TYPES_ENUM {
  NON_CUSTOM_LLM_PROVIDER = 'NON_CUSTOM_LLM_PROVIDER',
  CUSTOM_PROVIDER = 'CUSTOM_PROVIDER',
  PURE_PROVIDER = 'PURE_PROVIDER',
}

const PROVIDER_TYPES = [PROVIDER_TYPES_ENUM.NON_CUSTOM_LLM_PROVIDER, PROVIDER_TYPES_ENUM.CUSTOM_PROVIDER, PROVIDER_TYPES_ENUM.PURE_PROVIDER] as const

const providerTypeNameMap: Record<PROVIDER_TYPES_ENUM, string> = {
  NON_CUSTOM_LLM_PROVIDER: 'LLM 提供商',
  CUSTOM_PROVIDER: 'OpenAI 兼容自定义提供商',
  PURE_PROVIDER: '纯翻译提供商',
}

export function SupportProviders() {
  const [activeProviderType, setActiveProviderType] = useState('NON_CUSTOM_LLM_PROVIDER')

  return (
    <section className="w-full bg-zinc-150 dark:bg-zinc-850 flex-auto md:h-fit">
      <Container className="h-full md:py-16 flex flex-col md:grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-stretch">
        <div className="flex flex-col h-fit md:h-full gap-6 md:gap-12">
          <div className="flex flex-col h-fit gap-6">
            <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              支持多种提供商
            </h1>
            <span className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Read Frog 可无缝接入多家大模型服务。你可以根据场景选择更合适的提供商：如全文翻译、阅读等。我们为不同 AI 提供统一的体验与一致的快捷操作。
            </span>
          </div>
          <LayoutGroup id="supportProviderLayoutGroup">
            <div className="flex flex-col items-start justify-center">
              {PROVIDER_TYPES.map(providerType => (
                <div key={providerType} className="relative flex items-center">
                  {activeProviderType === providerType && (
                    <motion.div
                      layoutId="supportAiActiveTab"
                      className="absolute -left-4 w-1 h-6 bg-primary rounded-full"
                    />
                  )}
                  <span
                    onClick={() => setActiveProviderType(providerType)}
                    className={cn(
                      'px-3 py-2 text-md font-medium transition-colors cursor-pointer',
                      activeProviderType === providerType
                        ? 'text-primary dark:text-primary'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                    )}
                  >
                    {providerTypeNameMap[providerType]}
                  </span>
                </div>
              ))}
            </div>
          </LayoutGroup>
        </div>
        <div className="flex justify-center items-center py-0 md:py-28 h-70 md:h-130 ">
          <div className="w-full">
            {activeProviderType === PROVIDER_TYPES_ENUM.NON_CUSTOM_LLM_PROVIDER ? <NonCustomLLMProviders /> : <></>}
            {activeProviderType === PROVIDER_TYPES_ENUM.CUSTOM_PROVIDER ? <CustomProviders /> : <></>}
            {activeProviderType === PROVIDER_TYPES_ENUM.PURE_PROVIDER ? <PureProviders /> : <></>}
          </div>
        </div>
      </Container>
    </section>
  )
}

function ProviderMotionLogo({ logo, name }: Provider) {
  return (
    <motion.div whileHover={{ scale: 1.3 }}>
      <ProviderIcon logo={logo(false)} name={name} className="mx-4" size="xl" />
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
    <div className="relative h-full flex flex-col justify-center gap-8 md:gap-16">
      <InfiniteScroller
        repeatCount={3}
        className="py-2"
        cardSequence={firstProviders}
        renderCard={ProviderMotionLogo}
      />
      <InfiniteScroller
        repeatCount={3}
        className="py-2"
        reverse
        cardSequence={secondProviders}
        renderCard={ProviderMotionLogo}
      />
      <InfiniteScroller
        repeatCount={3}
        className="py-2"
        cardSequence={thirdProviders}
        renderCard={ProviderMotionLogo}
      />
    </div>
  )
}

function CustomProviders() {
  const providers = Object.values(CUSTOM_PROVIDER_ITEMS)

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 md:grid-rows-1 md:grid-cols-4 gap-y-24 gap-x-0 md:gap-16">
      {providers.map(provider => (
        <div key={provider.id} className="flex flex-col items-center justify-center">
          <ProviderMotionLogo {...provider} />
        </div>
      ))}
    </div>
  )
}

function PureProviders() {
  return (
    <div className="h-full flex items-center justify-center">
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
