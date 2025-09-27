import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME, LANG_CODE_TO_LOCALE_NAME } from '@repo/definitions'
import { toast } from 'sonner'
import { isAPIProviderConfig, isLLMTranslateProviderConfig, isNonAPIProvider, isPureAPIProvider } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { getFinalSourceCode } from '@/utils/config/languages'
import { logger } from '@/utils/logger'
import { getConfigFromStorage } from '../../config/config'
import { Sha256Hex } from '../../hash'
import { sendMessage } from '../../message'
import { aiTranslate } from './api/ai'
import { deeplxTranslate } from './api/deeplx'
import { googleTranslate } from './api/google'
import { microsoftTranslate } from './api/microsoft'

export async function translateText(text: string) {
  const config = await getConfigFromStorage()
  if (!config) {
    throw new Error('No global config when translate text')
  }
  const providerId = config.translate.providerId
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)

  if (!providerConfig) {
    throw new Error(`No provider config for id ${providerId} when translate text`)
  }

  const langConfig = config.language

  return await sendMessage('enqueueTranslateRequest', {
    text,
    langConfig,
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex(
      text,
      JSON.stringify(providerConfig),
      getFinalSourceCode(langConfig.sourceCode, langConfig.detectedCode),
      langConfig.targetCode,
    ),
  })
}

export async function executeTranslate(text: string, langConfig: Config['language'], providerConfig: ProviderConfig, options?: { forceBackgroundFetch?: boolean, isBatch?: boolean }) {
  const cleanText = text.replace(/\u200B/g, '').trim()
  if (cleanText === '') {
    return ''
  }

  const { provider } = providerConfig
  let translatedText = ''

  if (isNonAPIProvider(provider)) {
    const sourceLang = langConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[langConfig.sourceCode] ?? 'auto')
    const targetLang = ISO6393_TO_6391[langConfig.targetCode]
    if (!targetLang) {
      throw new Error(`Invalid target language code: ${langConfig.targetCode}`)
    }
    if (provider === 'google') {
      translatedText = await googleTranslate(text, sourceLang, targetLang)
    }
    else if (provider === 'microsoft') {
      translatedText = await microsoftTranslate(text, sourceLang, targetLang)
    }
  }
  else if (isPureAPIProvider(provider)) {
    const sourceLang = langConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[langConfig.sourceCode] ?? 'auto')
    const targetLang = ISO6393_TO_6391[langConfig.targetCode]
    if (!targetLang) {
      throw new Error(`Invalid target language code: ${langConfig.targetCode}`)
    }
    if (provider === 'deeplx') {
      translatedText = await deeplxTranslate(text, sourceLang, targetLang, providerConfig, options)
    }
  }
  else if (isLLMTranslateProviderConfig(providerConfig)) {
    const targetLangName = LANG_CODE_TO_EN_NAME[langConfig.targetCode]
    translatedText = await aiTranslate(text, targetLangName, providerConfig, options)
  }
  else {
    throw new Error(`Unknown provider: ${provider}`)
  }

  return translatedText.trim()
}

export function validateTranslationConfig(config: Pick<Config, 'providersConfig' | 'translate' | 'language'>): boolean {
  const { providersConfig, translate: translateConfig, language: languageConfig } = config
  const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
  if (!providerConfig) {
    return false
  }

  if (languageConfig.sourceCode === languageConfig.targetCode) {
    toast.error(i18n.t('translation.sameLanguage'))
    logger.info('validateTranslationConfig: returning false (same language)')
    return false
  }
  else if (languageConfig.sourceCode === 'auto' && languageConfig.detectedCode === languageConfig.targetCode) {
    toast.warning(i18n.t('translation.autoModeSameLanguage', [
      LANG_CODE_TO_LOCALE_NAME[languageConfig.detectedCode] ?? languageConfig.detectedCode,
    ]))
  }

  // check if the API key is configured
  if (isAPIProviderConfig(providerConfig) && !providerConfig.apiKey?.trim() && !['deeplx', 'ollama'].includes(providerConfig.provider)) {
    toast.error(i18n.t('noAPIKeyConfig.warning'))
    logger.info('validateTranslationConfig: returning false (no API key)')
    return false
  }

  return true
}
