import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@/types/config/languages'
import { isPureTranslateProvider } from '@/types/config/provider'
import { globalConfig } from '../../config/config'
import { Sha256Hex } from '../../hash'
import { sendMessage } from '../../message'
import { getTranslateLinePrompt } from '../../prompts/translate-line'

export async function translateText(sourceText: string) {
  if (!globalConfig) {
    throw new Error('No global config when translate text')
  }
  const provider = globalConfig.translate.provider
  const modelString = globalConfig.translate.models[provider]?.model

  // replace /\u200B/g is for Feishu, it's a zero-width space
  const cleanSourceText = sourceText.replace(/\u200B/g, '').trim()

  let translatedText = ''

  if (isPureTranslateProvider(provider)) {
    const sourceLang = globalConfig.language.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[globalConfig.language.sourceCode] ?? 'auto')
    const targetLang = ISO6393_TO_6391[globalConfig.language.targetCode]
    if (!targetLang) {
      throw new Error('Invalid target language code')
    }
    translatedText = await sendMessage('enqueueRequest', {
      type: `${provider}Translate`,
      params: { text: cleanSourceText, fromLang: sourceLang, toLang: targetLang },
      scheduleAt: Date.now(),
      hash: Sha256Hex(cleanSourceText, provider, sourceLang, targetLang),
    })
  }
  else if (modelString) {
    const targetLang = LANG_CODE_TO_EN_NAME[globalConfig.language.targetCode]
    if (!targetLang) {
      throw new Error('Invalid target language code')
    }
    const prompt = getTranslateLinePrompt(targetLang, cleanSourceText)
    const text = await sendMessage('enqueueRequest', {
      type: 'aiTranslate',
      params: {
        provider,
        modelString,
        prompt,
      },
      scheduleAt: Date.now(),
      hash: Sha256Hex(cleanSourceText, provider, modelString, targetLang),
    })
    // Some deep thinking models, such as deepseek, return the thinking process. Therefore,
    // the thinking process in the <think></think> tag needs to be filtered out and only the result is returned
    const [, extracted = text] = text.match(/<\/think>([\s\S]*)/) || []
    translatedText = extracted
  }
  translatedText = translatedText.trim()

  return cleanSourceText === translatedText ? '' : translatedText
}
