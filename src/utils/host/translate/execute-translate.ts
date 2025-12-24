import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import type { ArticleContent } from '@/types/content'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@read-frog/definitions'
import { isLLMTranslateProviderConfig, isNonAPIProvider, isPureAPIProvider } from '@/types/config/provider'
import { aiTranslate } from './api/ai'
import { deeplxTranslate } from './api/deeplx'
import { googleTranslate } from './api/google'
import { microsoftTranslate } from './api/microsoft'

export async function executeTranslate(
  text: string,
  langConfig: Config['language'],
  providerConfig: ProviderConfig,
  options?: {
    forceBackgroundFetch?: boolean
    isBatch?: boolean
    content?: ArticleContent
  },
) {
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
    if (provider === 'google-translate') {
      translatedText = await googleTranslate(text, sourceLang, targetLang)
    }
    else if (provider === 'microsoft-translate') {
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
