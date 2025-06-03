import type { LLMTranslateProviderNames } from '@/types/config/provider'
import { generateText } from 'ai'

import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@/types/config/languages'
import { isPureTranslateProvider } from '@/types/config/provider'
import { globalConfig } from '../config/config'
import { Sha256Hex } from '../hash'
import { sendMessage } from '../message'
import { getTranslateLinePrompt } from '../prompts/translate-line'
import { getTranslateModel } from '../provider'

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
    // const { text } = await generateText({
    //   model,
    //   prompt: getTranslateLinePrompt(
    //     LANG_CODE_TO_EN_NAME[globalConfig.language.targetCode],
    //     cleanSourceText,
    //   ),
    // })
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
  // Compare cleaned versions to determine if translation is the same
  return cleanSourceText === translatedText ? '' : translatedText
}

export async function aiTranslate(provider: LLMTranslateProviderNames, modelString: string, prompt: string) {
  const model = await getTranslateModel(provider, modelString)
  const { text } = await generateText({
    model,
    prompt,
  })
  return text
}

export async function googleTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
): Promise<string> {
  const params = {
    client: 'gtx',
    sl: fromLang,
    tl: toLang,
    dt: 't',
    strip: 1,
    nonced: 1,
    q: encodeURIComponent(sourceText),
  }

  const queryString = Object.keys(params)
    .map(key => `${key}=${params[key as keyof typeof params]}`)
    .join('&')

  const resp = await fetch(
    `https://translate.googleapis.com/translate_a/single?${queryString}`,
    {
      method: 'GET',
    },
  ).catch((error) => {
    throw new Error(`Network error during translation: ${error.message}`)
  })

  if (!resp.ok) {
    const errorText = await resp
      .text()
      .catch(() => 'Unable to read error response')
    throw new Error(
      `Translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    )
  }

  try {
    const result = await resp.json()

    // Google Translate API returns nested arrays where result[0] contains
    // arrays of translation chunks, and the first element of each chunk
    // is the translated text
    if (!Array.isArray(result) || !Array.isArray(result[0])) {
      throw new TypeError('Unexpected response format from translation API')
    }

    // Combine all translation chunks
    const translatedText = result[0]
      .filter(Array.isArray)
      .map(chunk => chunk[0])
      .filter(Boolean)
      .join('')

    return translatedText
  }
  catch (error) {
    throw new Error(
      `Failed to parse translation response: ${(error as Error).message}`,
    )
  }
}

export async function microsoftTranslate(
  sourceText: string,
  fromLang: string,
  toLang: string,
): Promise<string> {
  // If fromLang is 'auto', use empty string as Microsoft's API expects
  const effectiveFromLang = fromLang === 'auto' ? '' : fromLang

  // Get a valid token
  const token = await refreshMicrosoftToken()

  const resp = await fetch(
    `https://api-edge.cognitive.microsofttranslator.com/translate?from=${effectiveFromLang}&to=${toLang}&api-version=3.0&includeSentenceLength=true&textType=html`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': token,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify([{ Text: sourceText }]),
    },
  ).catch((error) => {
    throw new Error(
      `Network error during Microsoft translation: ${error.message}`,
    )
  })

  if (!resp.ok) {
    const errorText = await resp
      .text()
      .catch(() => 'Unable to read error response')
    throw new Error(
      `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    )
  }

  try {
    const result = await resp.json()

    if (!Array.isArray(result) || !result[0]?.translations?.[0]?.text) {
      throw new Error(
        'Unexpected response format from Microsoft translation API',
      )
    }

    return result[0].translations[0].text
  }
  catch (error) {
    throw new Error(
      `Failed to parse Microsoft translation response: ${(error as Error).message}`,
    )
  }
}

async function refreshMicrosoftToken(): Promise<string> {
  try {
    const resp = await fetch('https://edge.microsoft.com/translate/auth')

    if (!resp.ok) {
      throw new Error(
        `Failed to refresh Microsoft token: ${resp.status} ${resp.statusText}`,
      )
    }

    return await resp.text()
  }
  catch (error) {
    throw new Error(
      `Error refreshing Microsoft token: ${(error as Error).message}`,
    )
  }
}
