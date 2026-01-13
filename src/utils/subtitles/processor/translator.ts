import type { SubtitlesFragment } from '../types'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { getLocalConfig } from '@/utils/config/storage'
import { Sha256Hex } from '@/utils/hash'
import { buildHashComponents } from '@/utils/host/translate/translate-text'
import { sendMessage } from '@/utils/message'

export interface TranslateContext {
  enableContext: boolean
  videoTitle: string
  subtitlesTextContent: string
}

async function initializeContext(
  config: Config,
  providerConfig: ProviderConfig | undefined,
  fragments: SubtitlesFragment[],
): Promise<TranslateContext> {
  const enableContext = !!config?.translate.enableAIContentAware
  let videoTitle = ''
  let subtitlesTextContent = ''

  const isLLM = providerConfig && isLLMTranslateProviderConfig(providerConfig)

  if (isLLM && enableContext) {
    videoTitle = document.title || ''

    if (fragments.length > 0) {
      subtitlesTextContent = fragments.map(s => s.text).join('\n')
    }
  }

  return { enableContext, videoTitle, subtitlesTextContent }
}

async function translateSingleSubtitle(
  text: string,
  langConfig: Config['language'],
  providerConfig: ProviderConfig,
  context: TranslateContext,
): Promise<string> {
  const hashComponents = await buildHashComponents(
    text,
    providerConfig,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    context.enableContext,
    { title: context.videoTitle, textContent: context.subtitlesTextContent },
  )

  return await sendMessage('enqueueSubtitlesTranslateRequest', {
    text,
    langConfig,
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    videoTitle: context.videoTitle,
    subtitlesContext: context.subtitlesTextContent,
  })
}

export async function translateSubtitles(
  fragments: SubtitlesFragment[],
): Promise<SubtitlesFragment[]> {
  const config = await getLocalConfig()
  if (!config) {
    return fragments.map(f => ({ ...f, translation: '' }))
  }

  const providerId = config.translate.providerId
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)

  if (!providerConfig) {
    return fragments.map(f => ({ ...f, translation: '' }))
  }

  const context = await initializeContext(config, providerConfig, fragments)
  const langConfig = config.language

  const translationPromises = fragments.map(fragment =>
    translateSingleSubtitle(fragment.text, langConfig, providerConfig, context),
  )

  const translations = await Promise.all(translationPromises)

  return fragments.map((fragment, index) => ({
    ...fragment,
    translation: translations[index],
  }))
}
